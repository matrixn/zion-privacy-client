<?php

namespace ZionPrivacy\Frontend;

use ZionPrivacy\Api\ApiClient;
use ZionPrivacy\Settings\SettingsRepository;

final class ConsentBanner
{
    public function __construct(
        private readonly SettingsRepository $settings,
        private readonly ApiClient $api,
    ) {}

    public function register(): void
    {
        add_action('wp_enqueue_scripts', [$this, 'enqueue']);
    }

    public function enqueue(): void
    {
        $settings = $this->settings->all();
        $preview = isset($_GET['zion_priv_preview']) && sanitize_key((string) $_GET['zion_priv_preview']) === 'true';

        if (is_admin() || (empty($settings['banner_enabled']) && ! $preview)) {
            return;
        }

        $branding = $this->settings->branding();

        wp_enqueue_script('zion-privacy-banner', ZION_PRIVACY_URL.'assets/banner.js', [], ZION_PRIVACY_VERSION, true);
        wp_localize_script('zion-privacy-banner', 'ZionPrivacyBanner', [
            'styleUrl' => ZION_PRIVACY_URL.'assets/banner.css?ver='.rawurlencode(ZION_PRIVACY_VERSION),
            'title' => $settings['banner_title'],
            'preview' => $preview,
            'regulation' => $settings['banner_regulation'],
            'message' => $settings['banner_message'],
            'acceptLabel' => $settings['banner_accept_label'],
            'rejectLabel' => $settings['banner_reject_label'],
            'customizeLabel' => $settings['banner_customize_label'],
            'saveLabel' => $settings['banner_save_label'],
            'showCustomize' => (bool) $settings['banner_show_customize'],
            'showCookieDetails' => (bool) $settings['banner_show_cookie_details'],
            'showCategoryCounts' => (bool) $settings['banner_show_category_counts'],
            'showPrivacyLink' => (bool) $settings['banner_show_privacy_link'],
            'privacyLinkLabel' => $settings['banner_privacy_link_label'],
            'policyLinks' => $this->policyLinks($settings),
            'selectorTitle' => $settings['banner_selector_title'],
            'selectorMessage' => $settings['banner_selector_message'],
            'position' => $settings['banner_position'],
            'launcherPosition' => $settings['banner_launcher_position'],
            'policyLinkTarget' => $settings['banner_policy_link_target'],
            'width' => (int) $settings['banner_width'],
            'radius' => (int) $settings['banner_radius'],
            'fontSize' => (int) $settings['banner_font_size'],
            'useSiteFont' => (bool) $settings['banner_use_site_font'],
            'shadow' => (bool) $settings['banner_shadow'],
            'hoverEnabled' => (bool) $settings['banner_button_hover_enabled'],
            'hoverEffect' => $settings['banner_button_hover_effect'],
            'hoverDuration' => (int) $settings['banner_button_hover_duration'],
            'hoverScale' => (int) $settings['banner_button_hover_scale'],
            'colors' => [
                'background' => $settings['banner_background_color'],
                'text' => $settings['banner_text_color'],
                'muted' => $settings['banner_muted_color'],
                'primary' => $settings['banner_primary_color'],
                'primaryText' => $settings['banner_primary_text_color'],
                'secondary' => $settings['banner_secondary_color'],
                'secondaryText' => $settings['banner_secondary_text_color'],
                'border' => $settings['banner_border_color'],
            ],
            'privacyUrl' => (string) apply_filters('zion_privacy_privacy_policy_url', get_privacy_policy_url()),
            'storageKey' => 'zion_privacy_consent_v'.max(1, (int) $settings['consent_revision']),
            'consentUrl' => esc_url_raw(rest_url('zion-privacy/v1/consent')),
            'consentToken' => $this->settings->publicConsentToken(),
            'consentTrackingEnabled' => $this->settings->consentTrackingEnabled(),
            'poweredByUrl' => $branding['powered_by_url'],
            'showPoweredBy' => $branding['copyright_enabled'],
            'cookies' => $this->cookies(),
        ]);
    }

    private function policyLinks(array $settings): array
    {
        $links = [];
        $definitions = [
            [
                'key' => 'privacy_policy',
                'enabled' => 'banner_show_privacy_policy_link',
                'page' => 'banner_privacy_policy_page_id',
                'label' => 'banner_privacy_policy_link_label',
                'fallback' => '',
            ],
            [
                'key' => 'terms',
                'enabled' => 'banner_show_terms_link',
                'page' => 'banner_terms_page_id',
                'label' => 'banner_terms_link_label',
                'fallback' => '',
            ],
            [
                'key' => 'cookie_policy',
                'enabled' => 'banner_show_cookie_policy_link',
                'page' => 'banner_cookie_policy_page_id',
                'label' => 'banner_cookie_policy_link_label',
                'fallback' => '',
            ],
        ];

        foreach ($definitions as $definition) {
            if (empty($settings[$definition['enabled']])) {
                continue;
            }

            $pageUrl = ! empty($settings[$definition['page']]) ? get_permalink((int) $settings[$definition['page']]) : $definition['fallback'];
            if (! is_string($pageUrl) || $pageUrl === '') {
                continue;
            }

            $links[] = [
                'key' => $definition['key'],
                'label' => (string) ($settings[$definition['label']] ?? ucfirst(str_replace('_', ' ', $definition['key']))),
                'url' => (string) $pageUrl,
            ];
        }

        return $links;
    }

    private function cookies(): array
    {
        if (! $this->settings->isConnected()) {
            return [];
        }

        $cacheKey = 'zion_privacy_banner_cookies_'.md5(home_url('/'));
        $cached = get_transient($cacheKey);

        if (is_array($cached)) {
            return $cached;
        }

        $websites = $this->api->get('websites', ['per_page' => 1]);
        $websiteId = $websites['data'][0]['id'] ?? null;

        if (! is_string($websiteId) || $websiteId === '') {
            return [];
        }

        $response = $this->api->get('websites/'.rawurlencode($websiteId).'/cookies');
        $cookies = is_wp_error($response) ? [] : array_map(static function (array $cookie): array {
            $displayName = ! empty($cookie['display_name']) ? $cookie['display_name'] : ($cookie['name'] ?? 'Unknown cookie');
            $description = ! empty($cookie['description']) ? $cookie['description'] : ($cookie['purpose'] ?? 'No description available.');

            return [
                'name' => (string) $displayName,
                'technical_name' => (string) ($cookie['name'] ?? ''),
                'category' => (string) ($cookie['category'] ?? 'unknown'),
                'description' => (string) $description,
                'vendor' => (string) ($cookie['vendor'] ?? ''),
            ];
        }, (array) ($response['data'] ?? []));

        set_transient($cacheKey, $cookies, $this->settings->bannerCookieCacheMinutes() * MINUTE_IN_SECONDS);

        return $cookies;
    }
}
