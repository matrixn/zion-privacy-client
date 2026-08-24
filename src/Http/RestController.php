<?php

namespace ZionPrivacy\Http;

use ZionPrivacy\Api\ApiClient;
use ZionPrivacy\Consent\ConsentEventRepository;
use ZionPrivacy\OAuth\CallbackHandler;
use ZionPrivacy\Settings\SettingsRepository;

final class RestController
{
    public function __construct(
        private readonly SettingsRepository $settings,
        private readonly ApiClient $api,
        private readonly CallbackHandler $oauth,
        private readonly ConsentEventRepository $consents,
    ) {}

    public function register(): void
    {
        add_action('rest_api_init', [$this, 'routes']);
        add_action('zion_privacy_refresh_cookie_cache', [$this, 'refreshCookieCache']);

        if (! wp_next_scheduled('zion_privacy_refresh_cookie_cache')) {
            wp_schedule_event(time() + 300, 'hourly', 'zion_privacy_refresh_cookie_cache');
        }
    }

    public function routes(): void
    {
        register_rest_route('zion-privacy/v1', '/status', [
            'methods' => 'GET',
            'permission_callback' => [$this, 'permission'],
            'callback' => fn (): array => $this->status(),
        ]);
        register_rest_route('zion-privacy/v1', '/banner', [
            [
                'methods' => 'GET',
                'permission_callback' => [$this, 'masterPermission'],
                'callback' => fn (): array => ['success' => true, 'source' => 'wordpress', 'config' => $this->runtimeBannerConfiguration()],
            ],
            [
                'methods' => 'POST',
                'permission_callback' => [$this, 'masterPermission'],
                'callback' => [$this, 'applyMasterBanner'],
            ],
        ]);
        register_rest_route('zion-privacy/v1', '/consent', [
            'methods' => 'POST',
            'permission_callback' => '__return_true',
            'callback' => [$this, 'savePublicConsent'],
        ]);
        register_rest_route('zion-privacy/v1', '/dashboard', [
            'methods' => 'GET',
            'permission_callback' => [$this, 'permission'],
            'callback' => fn (): array|\WP_Error => $this->dashboard(),
        ]);
        register_rest_route('zion-privacy/v1', '/cookies', [
            'methods' => 'GET',
            'permission_callback' => [$this, 'permission'],
            'callback' => fn (\WP_REST_Request $request): array|\WP_Error => $this->cookies($request),
        ]);
        register_rest_route('zion-privacy/v1', '/cookies/category', [
            'methods' => 'POST',
            'permission_callback' => [$this, 'permission'],
            'callback' => [$this, 'saveCookieCategory'],
        ]);
        register_rest_route('zion-privacy/v1', '/cookies/(?P<cookie>[0-9]+)/identify', [
            'methods' => 'POST',
            'permission_callback' => [$this, 'permission'],
            'callback' => [$this, 'identifyCookie'],
        ]);
        register_rest_route('zion-privacy/v1', '/statistics', [
            'methods' => 'GET',
            'permission_callback' => [$this, 'permission'],
            'callback' => fn (): array|\WP_Error => $this->statistics(),
        ]);
        register_rest_route('zion-privacy/v1', '/scans', [
            'methods' => 'GET',
            'permission_callback' => [$this, 'permission'],
            'callback' => fn (): array|\WP_Error => $this->scans(),
        ]);
        register_rest_route('zion-privacy/v1', '/account', [
            'methods' => 'GET',
            'permission_callback' => [$this, 'permission'],
            'callback' => fn (): array|\WP_Error => $this->account(),
        ]);
        register_rest_route('zion-privacy/v1', '/websites/(?P<website>[\\w-]+)/scans', [
            'methods' => 'POST',
            'permission_callback' => [$this, 'permission'],
            'callback' => [$this, 'createScan'],
        ]);
        register_rest_route('zion-privacy/v1', '/websites/(?P<website>[\\w-]+)/scans/(?P<scan>[\\w-]+)', [
            [
                'methods' => 'PATCH',
                'permission_callback' => [$this, 'permission'],
                'callback' => [$this, 'updateScan'],
            ],
            [
                'methods' => 'DELETE',
                'permission_callback' => [$this, 'permission'],
                'callback' => [$this, 'deleteScan'],
            ],
        ]);
        register_rest_route('zion-privacy/v1', '/scans/(?P<scan>[\\w-]+)/run', [
            'methods' => 'POST',
            'permission_callback' => [$this, 'permission'],
            'callback' => [$this, 'runScan'],
        ]);
        register_rest_route('zion-privacy/v1', '/scans/(?P<scan>[\\w-]+)/stop', [
            'methods' => 'POST',
            'permission_callback' => [$this, 'permission'],
            'callback' => [$this, 'stopScan'],
        ]);
        register_rest_route('zion-privacy/v1', '/settings', [
            [
                'methods' => 'GET',
                'permission_callback' => [$this, 'permission'],
                'callback' => fn (): array => $this->publicSettings(),
            ],
            [
                'methods' => 'POST',
                'permission_callback' => [$this, 'permission'],
                'callback' => [$this, 'saveSettings'],
            ],
        ]);
        register_rest_route('zion-privacy/v1', '/settings/pages', [
            'methods' => 'GET',
            'permission_callback' => [$this, 'permission'],
            'callback' => fn (): array => $this->pages(),
        ]);
        register_rest_route('zion-privacy/v1', '/settings/reset-banner', [
            'methods' => 'POST',
            'permission_callback' => [$this, 'permission'],
            'callback' => [$this, 'resetBanner'],
        ]);
        register_rest_route('zion-privacy/v1', '/settings/renew-consents', [
            'methods' => 'POST',
            'permission_callback' => [$this, 'permission'],
            'callback' => [$this, 'renewConsents'],
        ]);
        register_rest_route('zion-privacy/v1', '/settings/troubleshooting', [
            [
                'methods' => 'GET',
                'permission_callback' => [$this, 'permission'],
                'callback' => fn (): array => $this->troubleshooting(),
            ],
            [
                'methods' => 'POST',
                'permission_callback' => [$this, 'permission'],
                'callback' => [$this, 'runMaintenance'],
            ],
        ]);
        register_rest_route('zion-privacy/v1', '/connect', [
            'methods' => 'POST',
            'permission_callback' => [$this, 'permission'],
            'callback' => [$this, 'connect'],
        ]);
        register_rest_route('zion-privacy/v1', '/disconnect', [
            'methods' => 'POST',
            'permission_callback' => [$this, 'permission'],
            'callback' => function (): array {
                $this->settings->clearCredentials();

                return ['connected' => false];
            },
        ]);
    }

    public function permission(): bool
    {
        return current_user_can('manage_options');
    }

    public function masterPermission(\WP_REST_Request $request): bool
    {
        $credentials = $this->settings->credentials();
        $client = sanitize_text_field((string) $request->get_header('X-Zion-Master-Client'));
        $key = sanitize_text_field((string) $request->get_header('X-Zion-Master-Key'));
        $timestamp = (string) $request->get_header('X-Zion-Master-Timestamp');
        $nonce = sanitize_text_field((string) $request->get_header('X-Zion-Master-Nonce'));
        $signature = sanitize_text_field((string) $request->get_header('X-Zion-Master-Signature'));
        $path = (string) $request->get_header('X-Zion-Master-Path');

        if ($client === '' || $key === '' || $timestamp === '' || $nonce === '' || $signature === '' || $path === ''
            || ! ctype_digit($timestamp) || abs(time() - (int) $timestamp) > 300
            || ! hash_equals((string) ($credentials['installation_uuid'] ?? ''), $client)
            || ! hash_equals((string) ($credentials['key_id'] ?? ''), $key)
            || empty($credentials['secret'])) {
            return false;
        }

        $nonceKey = 'zion_privacy_master_nonce_'.md5($client.'|'.$nonce);
        if (get_transient($nonceKey)) {
            return false;
        }

        $rawBody = $request->get_method() === 'GET' ? '' : (string) $request->get_body();
        $canonical = implode("\n", [$request->get_method(), $path, $timestamp, $nonce, $rawBody]);
        $expected = hash_hmac('sha256', $canonical, (string) $credentials['secret']);
        if (! hash_equals($expected, $signature)) {
            return false;
        }

        set_transient($nonceKey, 1, 5 * MINUTE_IN_SECONDS);

        return true;
    }

    public function applyMasterBanner(\WP_REST_Request $request): array
    {
        $payload = $request->get_json_params();
        $this->settings->updateFromRuntimeConfig(is_array($payload['config'] ?? null) ? $payload['config'] : []);

        return [
            'success' => true,
            'source' => 'wordpress',
            'applied' => true,
            'config' => $this->runtimeBannerConfiguration(),
            'plugin_version' => ZION_PRIVACY_VERSION,
        ];
    }

    private function status(): array
    {
        $credentials = $this->settings->credentials();

        return [
            'connected' => $this->settings->isConnected(),
            'account' => $credentials['account'] ?? [],
            'site_url' => home_url('/'),
        ];
    }

    private function dashboard(): array|\WP_Error
    {
        if (! $this->settings->isConnected()) {
            return [
                'website' => null,
                'scans' => [],
                'cookies' => [],
                'stats' => $this->emptyStats(),
            ];
        }

        $websiteResponse = $this->api->get('websites', ['per_page' => 1]);

        if (is_wp_error($websiteResponse)) {
            return $websiteResponse;
        }

        $website = $this->firstData($websiteResponse);

        if (! $website) {
            return ['website' => null, 'scans' => [], 'cookies' => [], 'stats' => $this->emptyStats()];
        }

        $scansResponse = $this->api->get('websites/'.rawurlencode((string) $website['id']).'/scans', ['per_page' => 10]);
        $cookiesResponse = $this->cachedCookiesForWebsite($website);
        $accountResponse = $this->api->get('installation/account');
        $consentResponse = $this->api->get('installation/consent-statistics', ['days' => 7]);

        return [
            'website' => $website,
            'scans' => is_wp_error($scansResponse) ? [] : (array) ($scansResponse['data'] ?? []),
            'cookies' => is_wp_error($cookiesResponse) ? [] : $this->applyOverrides((array) ($cookiesResponse['data'] ?? [])),
            'cookies_synced_at' => is_wp_error($cookiesResponse) ? null : ($cookiesResponse['saved_at'] ?? null),
            'stats' => $this->statsFrom($website, $scansResponse, $cookiesResponse),
            'account' => is_wp_error($accountResponse) ? null : $accountResponse,
            'consent' => is_wp_error($consentResponse) ? null : $consentResponse,
        ];
    }

    private function cookies(\WP_REST_Request $request): array|\WP_Error
    {
        if (! $this->settings->isConnected()) {
            return ['data' => [], 'saved_at' => null, 'cached' => false, 'stale' => false];
        }

        $websiteResponse = $this->api->get('websites', ['per_page' => 1]);
        if (is_wp_error($websiteResponse)) {
            return $websiteResponse;
        }

        $website = $this->firstData($websiteResponse);
        if (! $website) {
            return ['data' => [], 'saved_at' => null, 'cached' => false, 'stale' => false];
        }

        $response = $this->cachedCookiesForWebsite($website, (string) $request->get_param('refresh') === '1');
        if (is_wp_error($response)) {
            return $response;
        }

        $accountResponse = $this->api->get('installation/account');

        return [
            'data' => $this->applyOverrides((array) ($response['data'] ?? [])),
            'saved_at' => $response['saved_at'] ?? null,
            'cached' => ! empty($response['cached']),
            'stale' => ! empty($response['stale']),
            'account' => is_wp_error($accountResponse) ? null : $accountResponse,
        ];
    }

    public function identifyCookie(\WP_REST_Request $request): array|\WP_Error
    {
        $websiteResponse = $this->api->get('websites', ['per_page' => 1]);
        if (is_wp_error($websiteResponse)) {
            return $websiteResponse;
        }

        $website = $this->firstData($websiteResponse);
        if (! $website) {
            return new \WP_Error('zion_privacy_no_website', 'No website is linked to this WordPress installation.');
        }

        $response = $this->api->post('websites/'.rawurlencode((string) $website['id']).'/cookies/'.rawurlencode((string) $request['cookie']).'/identify');

        if (is_wp_error($response)) {
            return $response;
        }

        $this->mergeIdentifiedCookieIntoCache($website, $response);

        return $response;
    }

    private function statistics(): array|\WP_Error
    {
        $dashboard = $this->dashboard();

        return is_wp_error($dashboard) ? $dashboard : [
            'website' => $dashboard['website'],
            'stats' => $dashboard['stats'],
            'scans' => $dashboard['scans'],
        ];
    }

    private function scans(): array|\WP_Error
    {
        if (! $this->settings->isConnected()) {
            return ['website' => null, 'data' => [], 'account' => null];
        }

        $websiteResponse = $this->api->get('websites', ['per_page' => 1]);

        if (is_wp_error($websiteResponse)) {
            return $websiteResponse;
        }

        $website = $this->firstData($websiteResponse);

        if (! $website) {
            return ['website' => null, 'data' => [], 'account' => null];
        }

        $scansResponse = $this->api->get('websites/'.rawurlencode((string) $website['id']).'/scans', ['per_page' => 100]);
        $accountResponse = $this->api->get('installation/account');

        if (is_wp_error($scansResponse)) {
            return $scansResponse;
        }

        return [
            'website' => $website,
            'data' => (array) ($scansResponse['data'] ?? []),
            'account' => is_wp_error($accountResponse) ? null : $accountResponse,
        ];
    }

    public function account(): array|\WP_Error
    {
        return $this->api->get('installation/account');
    }

    public function refreshCookieCache(): void
    {
        if (! $this->settings->isConnected()) {
            return;
        }

        $websiteResponse = $this->api->get('websites', ['per_page' => 1]);
        $website = is_wp_error($websiteResponse) ? null : $this->firstData($websiteResponse);

        if ($website) {
            $this->cachedCookiesForWebsite($website, true);
        }
    }

    private function cachedCookiesForWebsite(array $website, bool $force = false): array|\WP_Error
    {
        $cache = $this->settings->cookieCache();
        $websiteId = (string) ($website['id'] ?? '');
        $hasCache = $websiteId !== ''
            && (string) ($cache['website_id'] ?? '') === $websiteId
            && is_array($cache['data'] ?? null);
        $savedAt = (int) ($cache['saved_at_timestamp'] ?? 0);
        $freshUntil = time() - ($this->settings->bannerCookieCacheMinutes() * MINUTE_IN_SECONDS);

        if (! $force && $hasCache && $savedAt >= $freshUntil) {
            return [
                'data' => $cache['data'],
                'saved_at' => $cache['saved_at'] ?? null,
                'cached' => true,
                'stale' => false,
            ];
        }

        $response = $this->api->get('websites/'.rawurlencode($websiteId).'/cookies');
        if (is_wp_error($response)) {
            if ($hasCache) {
                return [
                    'data' => $cache['data'],
                    'saved_at' => $cache['saved_at'] ?? null,
                    'cached' => true,
                    'stale' => true,
                ];
            }

            return $response;
        }

        $data = (array) ($response['data'] ?? []);
        $this->settings->saveCookieCache($websiteId, $data);
        $saved = $this->settings->cookieCache();

        return [
            'data' => $data,
            'saved_at' => $saved['saved_at'] ?? null,
            'cached' => false,
            'stale' => false,
        ];
    }

    public function createScan(\WP_REST_Request $request): array|\WP_Error
    {
        return $this->api->post('websites/'.rawurlencode((string) $request->get_param('website')).'/scans', (array) $request->get_json_params());
    }

    public function updateScan(\WP_REST_Request $request): array|\WP_Error
    {
        return $this->api->patch('websites/'.rawurlencode((string) $request->get_param('website')).'/scans/'.rawurlencode((string) $request->get_param('scan')), (array) $request->get_json_params());
    }

    public function deleteScan(\WP_REST_Request $request): array|\WP_Error
    {
        return $this->api->delete('websites/'.rawurlencode((string) $request->get_param('website')).'/scans/'.rawurlencode((string) $request->get_param('scan')));
    }

    public function runScan(\WP_REST_Request $request): array|\WP_Error
    {
        return $this->api->post('scans/'.rawurlencode((string) $request->get_param('scan')).'/run');
    }

    public function stopScan(\WP_REST_Request $request): array|\WP_Error
    {
        return $this->api->post('scans/'.rawurlencode((string) $request->get_param('scan')).'/cancel');
    }

    private function publicSettings(): array
    {
        $settings = $this->settings->all();

        return [
            'banner_enabled' => (bool) $settings['banner_enabled'],
            'banner_design' => $settings['banner_design'],
            'banner_logo_url' => (string) $settings['banner_logo_url'],
            'banner_regulation' => $settings['banner_regulation'],
            'banner_title' => $settings['banner_title'],
            'banner_message' => $settings['banner_message'],
            'banner_accept_label' => $settings['banner_accept_label'],
            'banner_reject_label' => $settings['banner_reject_label'],
            'banner_reject_all_label' => $settings['banner_reject_all_label'],
            'banner_customize_label' => $settings['banner_customize_label'],
            'banner_save_label' => $settings['banner_save_label'],
            'banner_show_accept' => (bool) $settings['banner_show_accept'],
            'banner_show_reject' => (bool) $settings['banner_show_reject'],
            'banner_show_reject_all' => (bool) $settings['banner_show_reject_all'],
            'banner_show_customize' => (bool) $settings['banner_show_customize'],
            'banner_show_save_preferences' => (bool) $settings['banner_show_save_preferences'],
            'banner_show_cookie_details' => (bool) $settings['banner_show_cookie_details'],
            'banner_show_category_counts' => (bool) $settings['banner_show_category_counts'],
            'banner_show_privacy_link' => (bool) $settings['banner_show_privacy_link'],
            'banner_privacy_link_label' => (string) $settings['banner_privacy_link_label'],
            'banner_show_cookie_launcher' => (bool) ($settings['banner_show_cookie_launcher'] ?? true),
            'banner_show_privacy_link' => (bool) $settings['banner_show_privacy_link'],
            'banner_privacy_link_label' => $settings['banner_privacy_link_label'],
            'banner_show_privacy_policy_link' => (bool) $settings['banner_show_privacy_policy_link'],
            'banner_privacy_policy_page_id' => (int) $settings['banner_privacy_policy_page_id'],
            'banner_privacy_policy_link_label' => $settings['banner_privacy_policy_link_label'],
            'banner_show_terms_link' => (bool) $settings['banner_show_terms_link'],
            'banner_terms_page_id' => (int) $settings['banner_terms_page_id'],
            'banner_terms_link_label' => $settings['banner_terms_link_label'],
            'banner_show_cookie_policy_link' => (bool) $settings['banner_show_cookie_policy_link'],
            'banner_cookie_policy_page_id' => (int) $settings['banner_cookie_policy_page_id'],
            'banner_cookie_policy_link_label' => $settings['banner_cookie_policy_link_label'],
            'banner_selector_title' => $settings['banner_selector_title'],
            'banner_selector_message' => $settings['banner_selector_message'],
            'banner_position' => $settings['banner_position'],
            'banner_launcher_position' => $settings['banner_launcher_position'],
            'banner_policy_link_target' => $settings['banner_policy_link_target'],
            'banner_width' => (int) $settings['banner_width'],
            'banner_radius' => (int) $settings['banner_radius'],
            'banner_font_size' => (int) $settings['banner_font_size'],
            'banner_use_site_font' => (bool) $settings['banner_use_site_font'],
            'banner_shadow' => (bool) $settings['banner_shadow'],
            'banner_button_hover_enabled' => (bool) $settings['banner_button_hover_enabled'],
            'banner_button_hover_effect' => $settings['banner_button_hover_effect'],
            'banner_button_hover_duration' => (int) $settings['banner_button_hover_duration'],
            'banner_button_hover_scale' => (int) $settings['banner_button_hover_scale'],
            'banner_background_color' => $settings['banner_background_color'],
            'banner_text_color' => $settings['banner_text_color'],
            'banner_muted_color' => $settings['banner_muted_color'],
            'banner_primary_color' => $settings['banner_primary_color'],
            'banner_primary_text_color' => $settings['banner_primary_text_color'],
            'banner_secondary_color' => $settings['banner_secondary_color'],
            'banner_secondary_text_color' => $settings['banner_secondary_text_color'],
            'banner_border_color' => $settings['banner_border_color'],
            'scan_poll_interval_seconds' => (int) $settings['scan_poll_interval_seconds'],
            'api_timeout_seconds' => (int) $settings['api_timeout_seconds'],
            'default_scan_mode' => $settings['default_scan_mode'],
            'default_scan_scenario' => $settings['default_scan_scenario'],
            'banner_cookie_cache_minutes' => (int) $settings['banner_cookie_cache_minutes'],
            'consent_tracking_enabled' => $this->settings->consentTrackingEnabled(),
            'banner_reject_redirect_enabled' => (bool) $settings['banner_reject_redirect_enabled'],
            'banner_reject_redirect_url' => (string) $settings['banner_reject_redirect_url'],
            'banner_privacy_url' => (string) $settings['banner_privacy_url'],
            'consent_revision' => (int) $settings['consent_revision'],
            'consent_renewed_at' => $settings['consent_renewed_at'],
            'connected' => $this->settings->isConnected(),
            'account' => $this->settings->credentials()['account'] ?? [],
        ];
    }

    private function runtimeBannerConfiguration(): array
    {
        $settings = $this->settings->all();
        $width = (int) ($settings['banner_width'] ?? 0);

        return [
            'version' => max(1, (int) ($settings['consent_revision'] ?? 1)),
            'banner' => [
                'enabled' => (bool) $settings['banner_enabled'],
                'design' => (string) $settings['banner_design'],
                'logo_url' => (string) $settings['banner_logo_url'],
                'position' => str_replace('-', '_', (string) $settings['banner_position']),
                'full_width' => $width === 0,
                'maximum_width' => $width > 0 ? $width : null,
                'show_customize' => (bool) $settings['banner_show_customize'],
                'show_cookie_details' => (bool) $settings['banner_show_cookie_details'],
                'show_category_counts' => (bool) $settings['banner_show_category_counts'],
                'show_privacy_link' => (bool) $settings['banner_show_privacy_link'],
                'privacy_link_label' => (string) $settings['banner_privacy_link_label'],
                'privacy_url' => (string) ($settings['banner_privacy_url'] ?: apply_filters('zion_privacy_privacy_policy_url', get_privacy_policy_url())),
                'title' => (string) $settings['banner_title'],
                'message' => (string) $settings['banner_message'],
                'regulation' => (string) $settings['banner_regulation'],
                'accept_label' => (string) $settings['banner_accept_label'],
                'reject_label' => (string) $settings['banner_reject_label'],
                'reject_all_label' => (string) $settings['banner_reject_all_label'],
                'customize_label' => (string) $settings['banner_customize_label'],
                'save_label' => (string) $settings['banner_save_label'],
                'show_accept' => (bool) $settings['banner_show_accept'],
                'show_reject' => (bool) $settings['banner_show_reject'],
                'show_reject_all' => (bool) $settings['banner_show_reject_all'],
                'show_save_preferences' => (bool) $settings['banner_show_save_preferences'],
                'selector_title' => (string) $settings['banner_selector_title'],
                'selector_message' => (string) $settings['banner_selector_message'],
                'policy_link_target' => (string) $settings['banner_policy_link_target'],
                'links' => $this->masterBannerPolicyLinks($settings),
                'background' => (string) $settings['banner_background_color'],
                'text' => (string) $settings['banner_text_color'],
                'muted' => (string) $settings['banner_muted_color'],
                'primary' => (string) $settings['banner_primary_color'],
                'primary_text' => (string) $settings['banner_primary_text_color'],
                'secondary' => (string) $settings['banner_secondary_color'],
                'secondary_text' => (string) $settings['banner_secondary_text_color'],
                'border' => (string) $settings['banner_border_color'],
                'radius' => (int) $settings['banner_radius'],
                'font_size' => (int) $settings['banner_font_size'],
                'use_site_font' => (bool) $settings['banner_use_site_font'],
                'shadow' => (bool) $settings['banner_shadow'],
                'show_cookie_launcher' => (bool) ($settings['banner_show_cookie_launcher'] ?? true),
                'launcher_position' => str_replace('-', '_', (string) $settings['banner_launcher_position']),
                'hover_enabled' => (bool) $settings['banner_button_hover_enabled'],
                'hover_effect' => (string) $settings['banner_button_hover_effect'],
                'hover_duration' => (int) $settings['banner_button_hover_duration'],
                'hover_scale' => (int) $settings['banner_button_hover_scale'],
                'reject_redirect_enabled' => (bool) $settings['banner_reject_redirect_enabled'],
                'reject_redirect_url' => (string) $settings['banner_reject_redirect_url'],
                'show_powered_by' => (bool) $this->settings->branding()['copyright_enabled'],
                'powered_by_url' => $this->settings->branding()['powered_by_url'] ?? SettingsRepository::DEFAULT_POWERED_BY_URL,
            ],
            'categories' => [
                'necessary' => ['enabled' => true, 'required' => true, 'label' => 'Necessary', 'description' => 'Always active for core website functionality.'],
                'preferences' => ['enabled' => true, 'required' => false, 'label' => 'Preferences', 'description' => 'Remember choices that improve your experience.'],
                'analytics' => ['enabled' => true, 'required' => false, 'label' => 'Analytics', 'description' => 'Help us understand how the website is used.'],
                'marketing' => ['enabled' => true, 'required' => false, 'label' => 'Marketing', 'description' => 'Support relevant advertising and campaign measurement.'],
            ],
            'integrations' => ['google_consent_mode' => false, 'telemetry' => (bool) $settings['consent_tracking_enabled']],
        ];
    }

    private function masterBannerPolicyLinks(array $settings): array
    {
        $remote = (array) ($settings['banner_remote_policy_links'] ?? []);
        $remoteByKey = [];
        foreach ($remote as $link) {
            if (is_array($link) && ! empty($link['key'])) {
                $remoteByKey[(string) $link['key']] = $link;
            }
        }

        $definitions = [
            ['key' => 'privacy_policy', 'enabled' => 'banner_show_privacy_policy_link', 'page' => 'banner_privacy_policy_page_id', 'label' => 'banner_privacy_policy_link_label', 'default' => 'Privacy policy'],
            ['key' => 'terms', 'enabled' => 'banner_show_terms_link', 'page' => 'banner_terms_page_id', 'label' => 'banner_terms_link_label', 'default' => 'Terms and Conditions'],
            ['key' => 'cookie_policy', 'enabled' => 'banner_show_cookie_policy_link', 'page' => 'banner_cookie_policy_page_id', 'label' => 'banner_cookie_policy_link_label', 'default' => 'Cookie policy'],
        ];

        $links = [];
        foreach ($definitions as $definition) {
            $pageId = (int) ($settings[$definition['page']] ?? 0);
            $url = $pageId > 0 ? get_permalink($pageId) : '';
            $url = is_string($url) ? $url : '';
            $pageTitle = $pageId > 0
                ? html_entity_decode((string) get_the_title($pageId), ENT_QUOTES, get_bloginfo('charset') ?: 'UTF-8')
                : '';
            $label = trim((string) ($settings[$definition['label']] ?? ''));
            if ($pageTitle !== '' && ($label === '' || $label === $definition['default'])) {
                $label = $pageTitle;
            }

            $native = [
                'key' => $definition['key'],
                'label' => $label !== '' ? $label : ($pageTitle !== '' ? $pageTitle : $definition['default']),
                'url' => $url,
                'target' => (string) $settings['banner_policy_link_target'],
                'enabled' => ! empty($settings[$definition['enabled']]) && $url !== '',
                'page_id' => $pageId > 0 ? $pageId : null,
                'page_title' => $pageTitle,
                'source' => 'wordpress_page',
                'internal' => true,
            ];

            // Native WordPress pages are authoritative when configured. A
            // remote link is only used when the native setting has no URL,
            // which preserves external links synced from Banner Studio.
            if (empty($settings[$definition['enabled']]) || $native['enabled'] || ! isset($remoteByKey[$definition['key']])) {
                $links[] = $native;
            } elseif (! empty($remoteByKey[$definition['key']]['enabled'])) {
                $links[] = $remoteByKey[$definition['key']];
            } else {
                $links[] = $native;
            }
        }

        foreach ($remoteByKey as $key => $link) {
            if (! in_array($key, array_column($definitions, 'key'), true) && ! empty($link['enabled'])) {
                $links[] = $link;
            }
        }

        return $links;
    }

    private function pages(): array
    {
        $pages = get_posts([
            'post_type' => 'page',
            'post_status' => ['publish', 'private', 'draft'],
            'posts_per_page' => 100,
            'orderby' => ['menu_order' => 'ASC', 'title' => 'ASC'],
            'order' => 'ASC',
        ]);

        return [
            'data' => array_map(static fn (\WP_Post $page): array => [
                'id' => $page->ID,
                'title' => html_entity_decode(get_the_title($page), ENT_QUOTES, get_bloginfo('charset') ?: 'UTF-8'),
                'url' => (string) get_permalink($page),
                'status' => $page->post_status,
            ], $pages),
        ];
    }

    public function saveSettings(\WP_REST_Request $request): array
    {
        $this->settings->update((array) $request->get_json_params());

        return $this->publicSettings();
    }

    public function resetBanner(): array
    {
        $this->settings->resetBanner();

        return $this->publicSettings();
    }

    public function renewConsents(): array
    {
        $this->settings->renewConsents();

        return $this->publicSettings();
    }

    public function troubleshooting(): array
    {
        return $this->diagnostics();
    }

    public function runMaintenance(\WP_REST_Request $request): array|\WP_Error
    {
        $action = sanitize_key((string) $request->get_param('action'));

        if (! in_array($action, ['check_rest', 'check_api', 'run_all', 'clear_cache', 'clear_transients', 'clear_all'], true)) {
            return new \WP_Error('zion_privacy_invalid_maintenance_action', 'Unknown troubleshooting action.', ['status' => 400]);
        }

        $cleared = match ($action) {
            'clear_cache' => ['cookie_cache' => $this->settings->clearCookieCache()],
            'clear_transients' => ['master_transients_deleted' => $this->settings->clearMasterTransients()],
            'clear_all' => $this->settings->clearTroubleshootingCache(),
            default => [],
        };

        return [
            'success' => true,
            'action' => $action,
            'cleared' => $cleared,
            ...$this->diagnostics($action),
        ];
    }

    private function diagnostics(string $focus = 'run_all'): array
    {
        $routes = rest_get_server()->get_routes();
        $bannerRoute = $routes['/zion-privacy/v1/banner'] ?? null;
        $routeMethods = is_array($bannerRoute)
            ? array_values(array_unique(array_map(static fn (array $endpoint): string => implode(',', (array) ($endpoint['methods'] ?? [])), $bannerRoute)))
            : [];
        $cache = $this->settings->cookieCache();
        $shouldCheckApi = in_array($focus, ['run_all', 'check_api'], true);
        $api = $shouldCheckApi
            ? [
                'status' => 'not_connected',
                'message' => 'Connect this WordPress installation to test the API.',
            ]
            : [
                'status' => 'skipped',
                'message' => 'API check was skipped for this maintenance action.',
            ];

        if ($shouldCheckApi && $this->settings->isConnected()) {
            $response = $this->api->get('installation/account');
            if (is_wp_error($response)) {
                $api = [
                    'status' => 'failed',
                    'message' => $response->get_error_message(),
                    'code' => $response->get_error_code(),
                    'details' => $response->get_error_data(),
                ];
            } else {
                $api = [
                    'status' => 'ok',
                    'message' => 'Signed API request completed successfully.',
                    'account' => is_array($response['account'] ?? null) ? ($response['account']['email'] ?? $response['account']['name'] ?? null) : null,
                ];
            }
        }

        $credentials = $this->settings->credentials();
        $routeAvailable = is_array($bannerRoute);

        return [
            'focus' => $focus,
            'checked_at' => gmdate('c'),
            'checks' => [
                'plugin' => [
                    'status' => 'ok',
                    'message' => 'Zion Privacy Client is loaded.',
                    'version' => ZION_PRIVACY_VERSION,
                ],
                'rest' => [
                    'status' => $routeAvailable ? 'ok' : 'failed',
                    'message' => $routeAvailable ? 'Banner REST route is registered.' : 'Banner REST route is not registered. Reactivate/update the plugin or check REST filters.',
                    'endpoint' => rest_url('zion-privacy/v1/banner'),
                    'methods' => $routeMethods,
                    'route_registered' => $routeAvailable,
                ],
                'api' => $api,
                'credentials' => [
                    'status' => $this->settings->isConnected() ? 'ok' : 'not_connected',
                    'installation_uuid' => (string) ($credentials['installation_uuid'] ?? ''),
                    'key_id' => $this->masked((string) ($credentials['key_id'] ?? '')),
                ],
                'runtime' => [
                    'status' => 'ok',
                    'wordpress' => get_bloginfo('version'),
                    'php' => PHP_VERSION,
                    'multisite' => is_multisite(),
                    'rest_url' => rest_url(),
                ],
                'cache' => [
                    'status' => ! empty($cache['data']) ? 'present' : 'empty',
                    'cookie_count' => is_array($cache['data'] ?? null) ? count($cache['data']) : 0,
                    'saved_at' => $cache['saved_at'] ?? null,
                ],
            ],
        ];
    }

    private function masked(string $value): string
    {
        if ($value === '') {
            return '—';
        }

        return str_repeat('•', max(0, strlen($value) - 5)).substr($value, -5);
    }

    public function savePublicConsent(\WP_REST_Request $request): array|\WP_Error
    {
        $token = sanitize_text_field((string) $request->get_param('token'));
        if ($token === '' || ! hash_equals($this->settings->publicConsentToken(), $token)) {
            return new \WP_Error('zion_privacy_invalid_consent_token', 'The consent event token is invalid.', ['status' => 403]);
        }

        $origin = (string) ($request->get_header('Origin') ?: $request->get_header('Referer'));
        $originHost = wp_parse_url($origin, PHP_URL_HOST);
        $siteHost = wp_parse_url(home_url('/'), PHP_URL_HOST);
        if ($originHost && $siteHost && strtolower((string) $originHost) !== strtolower((string) $siteHost)) {
            return new \WP_Error('zion_privacy_invalid_consent_origin', 'The consent event origin is invalid.', ['status' => 403]);
        }

        if (! $this->consents->record((array) $request->get_json_params())) {
            return new \WP_Error('zion_privacy_invalid_consent_event', 'The consent event could not be stored.', ['status' => 422]);
        }

        return ['saved' => true];
    }

    public function connect(\WP_REST_Request $request): array|\WP_Error
    {
        $url = $this->oauth->connectionUrl((string) ($request->get_param('provider') ?: 'google'));

        return is_wp_error($url) ? $url : ['url' => $url];
    }

    public function saveCookieCategory(\WP_REST_Request $request): array|\WP_Error
    {
        $identity = sanitize_text_field((string) $request->get_param('identity'));
        $category = sanitize_key((string) $request->get_param('category'));
        $allowed = ['necessary', 'preferences', 'analytics', 'marketing', 'security', 'personalization', 'unknown'];

        if ($identity === '' || ! in_array($category, $allowed, true)) {
            return new \WP_Error('zion_privacy_invalid_cookie_category', 'A valid cookie identity and category are required.', ['status' => 422]);
        }

        $this->settings->setCookieOverride($identity, $category);

        return ['saved' => true, 'identity' => $identity, 'category' => $category];
    }

    private function firstData(array $response): ?array
    {
        $data = $response['data'][0] ?? null;

        if (is_array($data) && is_array($data['branding'] ?? null)) {
            $this->settings->saveBranding($data['branding']);
        }

        return is_array($data) ? $data : null;
    }

    private function mergeIdentifiedCookieIntoCache(array $website, array $response): void
    {
        $cookie = $response['data'] ?? null;
        $cache = $this->settings->cookieCache();
        $websiteId = (string) ($website['id'] ?? '');

        if (! is_array($cookie)
            || $websiteId === ''
            || (string) ($cache['website_id'] ?? '') !== $websiteId
            || ! is_array($cache['data'] ?? null)) {
            return;
        }

        $cookieIdentity = implode('|', [
            (string) ($cookie['name'] ?? ''),
            (string) ($cookie['domain'] ?? ''),
            (string) ($cookie['path'] ?? ''),
        ]);
        $changed = false;

        foreach ($cache['data'] as $index => $item) {
            if (! is_array($item)) {
                continue;
            }

            $itemIdentity = implode('|', [
                (string) ($item['name'] ?? ''),
                (string) ($item['domain'] ?? ''),
                (string) ($item['path'] ?? ''),
            ]);
            $sameId = isset($cookie['id'], $item['id'])
                && (string) $cookie['id'] === (string) $item['id'];

            if ($sameId || ($cookieIdentity !== '||' && $cookieIdentity === $itemIdentity)) {
                $cache['data'][$index] = array_merge($item, $cookie);
                $changed = true;
                break;
            }
        }

        if ($changed) {
            $this->settings->saveCookieCache($websiteId, array_values($cache['data']));
        }
    }

    private function statsFrom(array $website, array|\WP_Error $scansResponse, array|\WP_Error $cookiesResponse): array
    {
        $scans = is_wp_error($scansResponse) ? [] : (array) ($scansResponse['data'] ?? []);
        $cookies = is_wp_error($cookiesResponse) ? [] : $this->applyOverrides((array) ($cookiesResponse['data'] ?? []));
        $completed = array_values(array_filter($scans, static fn (array $scan): bool => ($scan['status'] ?? '') === 'completed'));
        $durations = array_values(array_filter(array_map(static function (array $scan): ?int {
            if (empty($scan['started_at']) || empty($scan['finished_at'])) {
                return null;
            }

            $start = strtotime((string) $scan['started_at']);
            $finish = strtotime((string) $scan['finished_at']);

            return $start && $finish ? max(0, $finish - $start) : null;
        }, $completed)));

        return [
            'total_cookies' => count($cookies),
            'categories' => array_count_values(array_map(static fn (array $cookie): string => (string) ($cookie['category'] ?? 'unknown'), $cookies)),
            'pages_scanned' => (int) ($completed[0]['page_count'] ?? 0),
            'scans_count' => count($scans),
            'successful_scans' => count($completed),
            'average_duration_seconds' => $durations ? (int) round(array_sum($durations) / count($durations)) : null,
            'last_successful_scan_at' => $website['last_successful_scan_at'] ?? null,
        ];
    }

    private function emptyStats(): array
    {
        return [
            'total_cookies' => 0,
            'categories' => [],
            'pages_scanned' => 0,
            'scans_count' => 0,
            'successful_scans' => 0,
            'average_duration_seconds' => null,
            'last_successful_scan_at' => null,
        ];
    }

    private function applyOverrides(array $cookies): array
    {
        $overrides = [];

        foreach ($this->settings->cookieOverrides() as $override) {
            if (is_array($override) && isset($override['identity'], $override['category'])) {
                $overrides[hash('sha256', (string) $override['identity'])] = (string) $override['category'];
            }
        }

        return array_map(static function (array $cookie) use ($overrides): array {
            $identity = implode('|', [(string) ($cookie['name'] ?? ''), (string) ($cookie['domain'] ?? ''), (string) ($cookie['path'] ?? '')]);
            $hash = hash('sha256', $identity);

            if (isset($overrides[$hash])) {
                $cookie['category'] = $overrides[$hash];
                $cookie['classification_source'] = 'local_override';
            }

            return $cookie;
        }, $cookies);
    }
}
