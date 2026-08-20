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
        return wp_parse_args((array) get_option(self::SETTINGS_OPTION, []), [
            'api_base_url' => self::API_BASE_URL,
            'banner_enabled' => true,
            'banner_title' => 'Your privacy matters',
            'banner_message' => 'Choose which categories of cookies you allow.',
            'scan_poll_interval_seconds' => 3,
            'api_timeout_seconds' => 20,
            'default_scan_mode' => 'manual',
            'default_scan_scenario' => 'pre_consent',
            'banner_cookie_cache_minutes' => 5,
            'consent_tracking_enabled' => true,
        ]);
    }

    public function update(array $settings): void
    {
        $current = $this->all();
        // The production API is intentionally immutable from WordPress.
        $current['api_base_url'] = self::API_BASE_URL;
        $current['banner_enabled'] = ! empty($settings['banner_enabled']);
        $current['banner_title'] = sanitize_text_field((string) ($settings['banner_title'] ?? $current['banner_title']));
        $current['banner_message'] = sanitize_textarea_field((string) ($settings['banner_message'] ?? $current['banner_message']));
        $current['scan_poll_interval_seconds'] = max(1, min(30, absint($settings['scan_poll_interval_seconds'] ?? $current['scan_poll_interval_seconds'])));
        $current['api_timeout_seconds'] = max(10, min(60, absint($settings['api_timeout_seconds'] ?? $current['api_timeout_seconds'])));
        $current['default_scan_mode'] = in_array($settings['default_scan_mode'] ?? $current['default_scan_mode'], ['manual', 'automatic'], true) ? $settings['default_scan_mode'] : $current['default_scan_mode'];
        $current['default_scan_scenario'] = in_array($settings['default_scan_scenario'] ?? $current['default_scan_scenario'], ['pre_consent', 'reject_all', 'accept_all'], true) ? $settings['default_scan_scenario'] : $current['default_scan_scenario'];
        $current['banner_cookie_cache_minutes'] = max(1, min(60, absint($settings['banner_cookie_cache_minutes'] ?? $current['banner_cookie_cache_minutes'])));
        $current['consent_tracking_enabled'] = ! isset($settings['consent_tracking_enabled']) || ! empty($settings['consent_tracking_enabled']);

        update_option(self::SETTINGS_OPTION, $current, false);
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
}
