<?php

namespace ZionPrivacy\Settings;

use ZionPrivacy\Infrastructure\CredentialVault;

final class SettingsRepository
{
    private const API_BASE_URL = 'https://privacy-api.zion3d.ro';

    private const SETTINGS_OPTION = 'zion_privacy_settings';

    private const CREDENTIALS_OPTION = 'zion_privacy_credentials';

    private const COOKIE_OVERRIDES_OPTION = 'zion_privacy_cookie_overrides';

    public function __construct(private readonly CredentialVault $vault) {}

    public function all(): array
    {
        return wp_parse_args((array) get_option(self::SETTINGS_OPTION, []), array_merge($this->bannerDefaults(), [
            'api_base_url' => self::API_BASE_URL,
            'scan_poll_interval_seconds' => 3,
            'api_timeout_seconds' => 20,
            'default_scan_mode' => 'manual',
            'default_scan_scenario' => 'pre_consent',
            'banner_cookie_cache_minutes' => 5,
            'consent_tracking_enabled' => true,
        ]));
    }

    public function resetBanner(): void
    {
        $current = $this->all();

        foreach ($this->bannerDefaults() as $key => $value) {
            $current[$key] = $value;
        }

        update_option(self::SETTINGS_OPTION, $current, false);
    }

    public function update(array $settings): void
    {
        $current = $this->all();
        // The production API is intentionally immutable from WordPress.
        $current['api_base_url'] = self::API_BASE_URL;
        $current['banner_enabled'] = ! empty($settings['banner_enabled']);
        $current['banner_title'] = sanitize_text_field((string) ($settings['banner_title'] ?? $current['banner_title']));
        $current['banner_message'] = sanitize_textarea_field((string) ($settings['banner_message'] ?? $current['banner_message']));
        foreach (['banner_accept_label', 'banner_reject_label', 'banner_customize_label', 'banner_save_label', 'banner_privacy_link_label', 'banner_selector_title'] as $key) {
            $current[$key] = sanitize_text_field((string) ($settings[$key] ?? $current[$key]));
        }
        $current['banner_selector_message'] = sanitize_textarea_field((string) ($settings['banner_selector_message'] ?? $current['banner_selector_message']));
        foreach (['banner_show_customize', 'banner_show_cookie_details', 'banner_show_category_counts', 'banner_show_privacy_link', 'banner_use_site_font', 'banner_shadow', 'banner_button_hover_enabled'] as $key) {
            $current[$key] = ! isset($settings[$key]) || ! empty($settings[$key]);
        }
        $current['banner_position'] = $this->allowedChoice($settings, 'banner_position', ['bottom', 'top', 'bottom_right', 'bottom_left', 'center'], $current['banner_position']);
        $current['banner_button_hover_effect'] = $this->allowedChoice($settings, 'banner_button_hover_effect', ['none', 'lift', 'glow', 'lift_glow'], $current['banner_button_hover_effect']);
        $current['banner_width'] = max(520, min(1400, absint($settings['banner_width'] ?? $current['banner_width'])));
        $current['banner_radius'] = max(0, min(32, absint($settings['banner_radius'] ?? $current['banner_radius'])));
        $current['banner_font_size'] = max(12, min(20, absint($settings['banner_font_size'] ?? $current['banner_font_size'])));
        $current['banner_button_hover_duration'] = max(100, min(500, absint($settings['banner_button_hover_duration'] ?? $current['banner_button_hover_duration'])));
        $current['banner_button_hover_scale'] = max(100, min(106, absint($settings['banner_button_hover_scale'] ?? $current['banner_button_hover_scale'])));
        foreach (['banner_background_color', 'banner_text_color', 'banner_muted_color', 'banner_primary_color', 'banner_primary_text_color', 'banner_secondary_color', 'banner_secondary_text_color', 'banner_border_color'] as $key) {
            $current[$key] = sanitize_hex_color($settings[$key] ?? $current[$key]) ?: $current[$key];
        }
        $current['scan_poll_interval_seconds'] = max(1, min(30, absint($settings['scan_poll_interval_seconds'] ?? $current['scan_poll_interval_seconds'])));
        $current['api_timeout_seconds'] = max(10, min(60, absint($settings['api_timeout_seconds'] ?? $current['api_timeout_seconds'])));
        $current['default_scan_mode'] = in_array($settings['default_scan_mode'] ?? $current['default_scan_mode'], ['manual', 'automatic'], true) ? $settings['default_scan_mode'] : $current['default_scan_mode'];
        $current['default_scan_scenario'] = in_array($settings['default_scan_scenario'] ?? $current['default_scan_scenario'], ['pre_consent', 'reject_all', 'accept_all'], true) ? $settings['default_scan_scenario'] : $current['default_scan_scenario'];
        $current['banner_cookie_cache_minutes'] = max(1, min(60, absint($settings['banner_cookie_cache_minutes'] ?? $current['banner_cookie_cache_minutes'])));
        $current['consent_tracking_enabled'] = ! isset($settings['consent_tracking_enabled']) || ! empty($settings['consent_tracking_enabled']);

        update_option(self::SETTINGS_OPTION, $current, false);
    }

    private function bannerDefaults(): array
    {
        return [
            'banner_enabled' => true,
            'banner_title' => 'Your privacy matters',
            'banner_message' => 'Choose which categories of cookies you allow.',
            'banner_accept_label' => 'Accept all',
            'banner_reject_label' => 'Essential only',
            'banner_customize_label' => 'Customize',
            'banner_save_label' => 'Save preferences',
            'banner_show_customize' => true,
            'banner_show_cookie_details' => true,
            'banner_show_category_counts' => true,
            'banner_show_privacy_link' => true,
            'banner_privacy_link_label' => 'Privacy policy',
            'banner_selector_title' => 'Customize cookies',
            'banner_selector_message' => 'Choose which cookie categories you allow on this website.',
            'banner_position' => 'bottom',
            'banner_width' => 1180,
            'banner_radius' => 12,
            'banner_font_size' => 14,
            'banner_use_site_font' => true,
            'banner_shadow' => true,
            'banner_button_hover_enabled' => true,
            'banner_button_hover_effect' => 'lift_glow',
            'banner_button_hover_duration' => 180,
            'banner_button_hover_scale' => 102,
            'banner_background_color' => '#ffffff',
            'banner_text_color' => '#183153',
            'banner_muted_color' => '#52657c',
            'banner_primary_color' => '#2369d1',
            'banner_primary_text_color' => '#ffffff',
            'banner_secondary_color' => '#f1f6fc',
            'banner_secondary_text_color' => '#1e477c',
            'banner_border_color' => '#dce5f0',
        ];
    }

    public function apiBaseUrl(): string
    {
        return self::API_BASE_URL;
    }

    public function apiTimeoutSeconds(): int
    {
        return max(10, min(60, (int) $this->all()['api_timeout_seconds']));
    }

    public function scanPollIntervalSeconds(): int
    {
        return max(1, min(30, (int) $this->all()['scan_poll_interval_seconds']));
    }

    public function bannerCookieCacheMinutes(): int
    {
        return max(1, min(60, (int) $this->all()['banner_cookie_cache_minutes']));
    }

    public function consentTrackingEnabled(): bool
    {
        return ! empty($this->all()['consent_tracking_enabled']);
    }

    public function publicConsentToken(): string
    {
        return hash_hmac('sha256', home_url('/'), wp_salt('auth'));
    }

    public function credentials(): array
    {
        return $this->vault->decrypt((string) get_option(self::CREDENTIALS_OPTION, ''));
    }

    public function saveCredentials(array $credentials): void
    {
        update_option(self::CREDENTIALS_OPTION, $this->vault->encrypt($credentials), false);
    }

    public function clearCredentials(): void
    {
        delete_option(self::CREDENTIALS_OPTION);
    }

    public function isConnected(): bool
    {
        $credentials = $this->credentials();

        return $this->hasValue($credentials['installation_uuid'] ?? null)
            && $this->hasValue($credentials['key_id'] ?? null)
            && $this->hasValue($credentials['secret'] ?? null);
    }

    public function cookieOverrides(): array
    {
        return (array) get_option(self::COOKIE_OVERRIDES_OPTION, []);
    }

    public function setCookieOverride(string $identity, string $category): void
    {
        $overrides = $this->cookieOverrides();
        $overrides[hash('sha256', $identity)] = [
            'identity' => $identity,
            'category' => sanitize_key($category),
        ];

        update_option(self::COOKIE_OVERRIDES_OPTION, $overrides, false);
    }

    private function hasValue(mixed $value): bool
    {
        return is_scalar($value) && trim((string) $value) !== '';
    }

    private function allowedChoice(array $settings, string $key, array $allowed, string $fallback): string
    {
        $value = (string) ($settings[$key] ?? $fallback);

        return in_array($value, $allowed, true) ? $value : $fallback;
    }
}
