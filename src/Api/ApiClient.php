<?php

namespace ZionPrivacy\Api;

use ZionPrivacy\Settings\SettingsRepository;

final class ApiClient
{
    public function __construct(private readonly SettingsRepository $settings) {}

    public function get(string $path, array $query = []): array|\WP_Error
    {
        return $this->request('GET', $path, [], $query);
    }

    public function post(string $path, array $body = []): array|\WP_Error
    {
        return $this->request('POST', $path, $body);
    }

    public function request(string $method, string $path, array $body = [], array $query = []): array|\WP_Error
    {
        if (! $this->settings->isConnected()) {
            return new \WP_Error('zion_privacy_not_connected', 'Connect this WordPress site to the Zion Privacy API first.');
        }

        $credentials = $this->settings->credentials();
        $url = add_query_arg($query, $this->settings->apiBaseUrl().'/api/v1/'.ltrim($path, '/'));
        $rawBody = in_array($method, ['GET', 'HEAD'], true) ? '' : (string) wp_json_encode($body);
        $timestamp = (string) time();
        $nonce = wp_generate_uuid4();
        $requestPath = (string) wp_parse_url($url, PHP_URL_PATH);
        $canonical = implode("\n", [$method, $requestPath, $timestamp, $nonce, $rawBody]);

        $response = wp_remote_request($url, [
            'method' => $method,
            'timeout' => 20,
            'headers' => [
                'Accept' => 'application/json',
                'Content-Type' => 'application/json',
                'X-Zion-Client' => (string) $credentials['installation_uuid'],
                'X-Zion-Key' => (string) $credentials['key_id'],
                'X-Zion-Timestamp' => $timestamp,
                'X-Zion-Nonce' => $nonce,
                'X-Zion-Signature' => hash_hmac('sha256', $canonical, (string) $credentials['secret']),
            ],
            'body' => $rawBody,
        ]);

        if (is_wp_error($response)) {
            return $response;
        }

        $status = wp_remote_retrieve_response_code($response);
        $decoded = json_decode((string) wp_remote_retrieve_body($response), true);

        if ($status < 200 || $status >= 300) {
            return new \WP_Error(
                'zion_privacy_api_error',
                (string) ($decoded['message'] ?? 'The Zion Privacy API returned an error.'),
                ['status' => $status, 'response' => $decoded],
            );
        }

        return is_array($decoded) ? $decoded : [];
    }

    public function exchangeOAuthCode(string $code, string $state): array|\WP_Error
    {
        if (trim($this->settings->apiBaseUrl()) === '') {
            return new \WP_Error('zion_privacy_api_url_missing', 'Set the Zion Privacy API URL first.');
        }

        $response = wp_remote_post($this->settings->apiBaseUrl().'/api/v1/oauth/token', [
            'timeout' => 20,
            'headers' => ['Accept' => 'application/json'],
            'body' => [
                'code' => $code,
                'state' => $state,
                'site_url' => home_url('/'),
                'callback_url' => admin_url('admin.php?page=zion-privacy-settings'),
                'plugin_version' => ZION_PRIVACY_VERSION,
            ],
        ]);

        if (is_wp_error($response)) {
            return $response;
        }

        $status = wp_remote_retrieve_response_code($response);
        $decoded = json_decode((string) wp_remote_retrieve_body($response), true);

        if ($status < 200 || $status >= 300 || ! is_array($decoded)) {
            return new \WP_Error('zion_privacy_oauth_exchange_failed', 'The API could not complete the account connection.', ['status' => $status]);
        }

        return $decoded;
    }
}
