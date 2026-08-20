<?php

namespace ZionPrivacy\Settings;

use ZionPrivacy\Infrastructure\CredentialVault;

final class SettingsRepository
{
    private const SETTINGS_OPTION = 'zion_privacy_settings';

    private const CREDENTIALS_OPTION = 'zion_privacy_credentials';

    private const COOKIE_OVERRIDES_OPTION = 'zion_privacy_cookie_overrides';

    public function __construct(private readonly CredentialVault $vault) {}

    public function all(): array
    {
        return wp_parse_args((array) get_option(self::SETTINGS_OPTION, []), [
            'api_base_url' => '',
            'banner_enabled' => true,
            'banner_title' => 'Your privacy matters',
            'banner_message' => 'Choose which categories of cookies you allow.',
        ]);
    }

    public function update(array $settings): void
    {
        $current = $this->all();
        $current['api_base_url'] = untrailingslashit(esc_url_raw((string) ($settings['api_base_url'] ?? $current['api_base_url'])));
        $current['banner_enabled'] = ! empty($settings['banner_enabled']);
        $current['banner_title'] = sanitize_text_field((string) ($settings['banner_title'] ?? $current['banner_title']));
        $current['banner_message'] = sanitize_textarea_field((string) ($settings['banner_message'] ?? $current['banner_message']));

        update_option(self::SETTINGS_OPTION, $current, false);
    }

    public function apiBaseUrl(): string
    {
        return (string) $this->all()['api_base_url'];
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

        return $this->hasValue($this->apiBaseUrl())
            && $this->hasValue($credentials['installation_uuid'] ?? null)
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
