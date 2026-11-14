<?php

namespace ZionPrivacy\Frontend;

final class BannerLocalization
{
    public const HANDLE = 'zion-privacy-banner-i18n';

    public static function enqueue(): void
    {
        wp_register_script(self::HANDLE, ZION_PRIVACY_URL.'assets/banner-i18n.js', ['wp-i18n'], ZION_PRIVACY_VERSION, true);
        wp_set_script_translations(self::HANDLE, 'zion-privacy-client', ZION_PRIVACY_DIR.'languages');
        wp_enqueue_script(self::HANDLE);
    }
}
