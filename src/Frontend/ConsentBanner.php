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

        if (is_admin() || empty($settings['banner_enabled'])) {
            return;
        }

        wp_enqueue_style('zion-privacy-banner', ZION_PRIVACY_URL.'assets/banner.css', [], ZION_PRIVACY_VERSION);
        wp_enqueue_script('zion-privacy-banner', ZION_PRIVACY_URL.'assets/banner.js', [], ZION_PRIVACY_VERSION, true);
        wp_localize_script('zion-privacy-banner', 'ZionPrivacyBanner', [
            'title' => $settings['banner_title'],
            'message' => $settings['banner_message'],
            'privacyUrl' => (string) apply_filters('zion_privacy_privacy_policy_url', get_privacy_policy_url()),
            'storageKey' => 'zion_privacy_consent_v1',
            'consentUrl' => esc_url_raw(rest_url('zion-privacy/v1/consent')),
            'consentToken' => $this->settings->publicConsentToken(),
            'consentTrackingEnabled' => $this->settings->consentTrackingEnabled(),
            'cookies' => $this->cookies(),
        ]);
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
