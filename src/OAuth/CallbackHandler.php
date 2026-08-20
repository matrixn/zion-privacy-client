<?php

namespace ZionPrivacy\OAuth;

use ZionPrivacy\Api\ApiClient;
use ZionPrivacy\Settings\SettingsRepository;

final class CallbackHandler
{
    public function __construct(
        private readonly SettingsRepository $settings,
        private readonly ApiClient $api,
    ) {}

    public function register(): void
    {
        add_action('admin_init', [$this, 'handleCallback']);
    }

    public function connectionUrl(string $provider): string|\WP_Error
    {
        $provider = in_array($provider, ['google', 'facebook'], true) ? $provider : 'google';

        if (trim($this->settings->apiBaseUrl()) === '') {
            return new \WP_Error('zion_privacy_api_url_missing', 'Set the Zion Privacy API URL first.');
        }

        $state = wp_generate_uuid4();
        set_transient('zion_privacy_oauth_state_'.$state, ['provider' => $provider], 10 * MINUTE_IN_SECONDS);

        return add_query_arg([
            'provider' => $provider,
            'state' => $state,
            'client_callback' => admin_url('admin.php?page=zion-privacy-settings'),
            'site_url' => home_url('/'),
        ], $this->settings->apiBaseUrl().'/api/v1/oauth/'.$provider.'/start');
    }

    public function handleCallback(): void
    {
        if (! is_admin() || ! current_user_can('manage_options') || empty($_GET['zion_privacy_oauth_code'])) {
            return;
        }

        $code = sanitize_text_field(wp_unslash((string) $_GET['zion_privacy_oauth_code']));
        $state = sanitize_text_field(wp_unslash((string) ($_GET['state'] ?? '')));
        $stateData = get_transient('zion_privacy_oauth_state_'.$state);
        delete_transient('zion_privacy_oauth_state_'.$state);

        if (! is_array($stateData)) {
            $this->redirectWithNotice('error', 'The OAuth state expired. Please start the connection again.');
        }

        $response = $this->api->exchangeOAuthCode($code, $state);

        if (is_wp_error($response)) {
            $this->redirectWithNotice('error', $response->get_error_message());
        }

        $credentials = is_array($response['credentials'] ?? null)
            ? $response['credentials']
            : (is_array($response['data']['credentials'] ?? null) ? $response['data']['credentials'] : []);

        if (! isset($credentials['installation_uuid'], $credentials['key_id'], $credentials['secret'])) {
            $this->redirectWithNotice('error', 'The API returned an incomplete installation credential.');
        }

        $this->settings->saveCredentials($credentials + [
            'account' => $response['account'] ?? ($response['data']['account'] ?? []),
        ]);
        $this->redirectWithNotice('success', 'Zion Privacy account connected.');
    }

    private function redirectWithNotice(string $type, string $message): never
    {
        wp_safe_redirect(add_query_arg([
            'page' => 'zion-privacy-settings',
            'zion_privacy_notice' => $type,
            'zion_privacy_message' => rawurlencode($message),
        ], admin_url('admin.php')));
        exit;
    }
}
