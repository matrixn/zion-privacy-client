<?php

namespace ZionPrivacy\Admin;

use ZionPrivacy\Settings\SettingsRepository;

final class AdminMenu
{
    public function __construct(private readonly SettingsRepository $settings) {}

    public function register(): void
    {
        add_action('admin_menu', [$this, 'registerPages']);
        add_action('admin_enqueue_scripts', [$this, 'enqueueAssets']);
    }

    public function registerPages(): void
    {
        add_menu_page(
            'Zion Privacy',
            'Zion Privacy',
            'manage_options',
            'zion-privacy',
            [$this, 'renderPage'],
            'dashicons-shield-alt',
            80,
        );

    }

    public function enqueueAssets(string $hook): void
    {
        if (! str_contains($hook, 'zion-privacy')) {
            return;
        }

        $scriptFile = file_exists(ZION_PRIVACY_DIR.'build/admin.js') ? 'admin.js' : 'index.tsx.js';
        $assetFile = file_exists(ZION_PRIVACY_DIR.'build/admin.asset.php')
            ? ZION_PRIVACY_DIR.'build/admin.asset.php'
            : ZION_PRIVACY_DIR.'build/index.tsx.asset.php';
        $asset = file_exists($assetFile) ? require $assetFile : ['dependencies' => ['wp-element'], 'version' => ZION_PRIVACY_VERSION];

        wp_enqueue_style('zion-privacy-admin', ZION_PRIVACY_URL.'assets/admin.css', [], ZION_PRIVACY_VERSION);
        wp_enqueue_style('dashicons');
        wp_enqueue_script(
            'zion-privacy-admin',
            ZION_PRIVACY_URL.'build/'.$scriptFile,
            $asset['dependencies'],
            $asset['version'],
            true,
        );
        wp_localize_script('zion-privacy-admin', 'ZionPrivacyAdmin', [
            'restUrl' => esc_url_raw(rest_url('zion-privacy/v1/')),
            'nonce' => wp_create_nonce('wp_rest'),
            'page' => sanitize_key((string) ($_GET['view'] ?? 'dashboard')),
            'connected' => $this->settings->isConnected(),
            'version' => ZION_PRIVACY_VERSION,
            'scanPollIntervalSeconds' => $this->settings->scanPollIntervalSeconds(),
            'defaultScanMode' => $this->settings->all()['default_scan_mode'],
            'defaultScanScenario' => $this->settings->all()['default_scan_scenario'],
            'cookieCacheMinutes' => $this->settings->bannerCookieCacheMinutes(),
        ]);
    }

    public function renderPage(): void
    {
        echo '<div class="wrap zion-privacy-wrap"><div id="zion-privacy-admin"></div></div>';
    }
}
