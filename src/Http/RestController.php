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
        register_rest_route('zion-privacy/v1', '/settings/reset-banner', [
            'methods' => 'POST',
            'permission_callback' => [$this, 'permission'],
            'callback' => [$this, 'resetBanner'],
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

        return [
            'website' => $website,
            'scans' => is_wp_error($scansResponse) ? [] : (array) ($scansResponse['data'] ?? []),
            'cookies' => is_wp_error($cookiesResponse) ? [] : $this->applyOverrides((array) ($cookiesResponse['data'] ?? [])),
            'cookies_synced_at' => is_wp_error($cookiesResponse) ? null : ($cookiesResponse['saved_at'] ?? null),
            'stats' => $this->statsFrom($website, $scansResponse, $cookiesResponse),
            'account' => is_wp_error($accountResponse) ? null : $accountResponse,
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

    private function identifyCookie(\WP_REST_Request $request): array|\WP_Error
    {
        $websiteResponse = $this->api->get('websites', ['per_page' => 1]);
        if (is_wp_error($websiteResponse)) {
            return $websiteResponse;
        }

        $website = $this->firstData($websiteResponse);
        if (! $website) {
            return new \WP_Error('zion_privacy_no_website', 'No website is linked to this WordPress installation.');
        }

        return $this->api->post('websites/'.rawurlencode((string) $website['id']).'/cookies/'.rawurlencode((string) $request['cookie']).'/identify');
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

    private function publicSettings(): array
    {
        $settings = $this->settings->all();

        return [
            'banner_enabled' => (bool) $settings['banner_enabled'],
            'banner_title' => $settings['banner_title'],
            'banner_message' => $settings['banner_message'],
            'banner_accept_label' => $settings['banner_accept_label'],
            'banner_reject_label' => $settings['banner_reject_label'],
            'banner_customize_label' => $settings['banner_customize_label'],
            'banner_save_label' => $settings['banner_save_label'],
            'banner_show_customize' => (bool) $settings['banner_show_customize'],
            'banner_show_cookie_details' => (bool) $settings['banner_show_cookie_details'],
            'banner_show_category_counts' => (bool) $settings['banner_show_category_counts'],
            'banner_show_privacy_link' => (bool) $settings['banner_show_privacy_link'],
            'banner_privacy_link_label' => $settings['banner_privacy_link_label'],
            'banner_selector_title' => $settings['banner_selector_title'],
            'banner_selector_message' => $settings['banner_selector_message'],
            'banner_position' => $settings['banner_position'],
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
            'connected' => $this->settings->isConnected(),
            'account' => $this->settings->credentials()['account'] ?? [],
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

        return is_array($data) ? $data : null;
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
