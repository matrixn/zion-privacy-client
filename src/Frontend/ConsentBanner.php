<?php

namespace ZionPrivacy\Frontend;

use ZionPrivacy\Settings\SettingsRepository;

final class ConsentBanner
{
    public function __construct(private readonly SettingsRepository $settings) {}

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
        ]);
    }
}
