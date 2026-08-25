<?php
/**
 * Plugin Name: Zion Privacy Client
 * Plugin URI: https://github.com/matrixn/zion-privacy-client
 * Description: Connect WordPress to the Zion Privacy API for cookie scanning, privacy statistics and consent management.
 * Version: 0.1.44
 * Author: Zion Privacy
 * Requires at least: 6.5
 * Requires PHP: 8.1
 * Text Domain: zion-privacy-client
 *
 * @package ZionPrivacy
 */

defined('ABSPATH') || exit;

define('ZION_PRIVACY_VERSION', '0.1.44');
define('ZION_PRIVACY_FILE', __FILE__);
define('ZION_PRIVACY_DIR', plugin_dir_path(__FILE__));
define('ZION_PRIVACY_URL', plugin_dir_url(__FILE__));

if (file_exists(ZION_PRIVACY_DIR.'vendor/autoload.php')) {
    require_once ZION_PRIVACY_DIR.'vendor/autoload.php';
} else {
    spl_autoload_register(static function (string $class): void {
        $prefix = 'ZionPrivacy\\';

        if (! str_starts_with($class, $prefix)) {
            return;
        }

        $file = ZION_PRIVACY_DIR.'src/'.str_replace('\\', '/', substr($class, strlen($prefix))).'.php';

        if (file_exists($file)) {
            require_once $file;
        }
    });
}

if (class_exists(\Zion\WordPressLicense\Config::class) && class_exists(\Zion\WordPressLicense\LicenseManager::class)) {
    $zionPrivacyLicenseManager = new \Zion\WordPressLicense\LicenseManager(new \Zion\WordPressLicense\Config(
        apiUrl: 'https://license.zion3d.ro/api/v1',
        productSlug: 'zion-privacy-client',
        productKey: 'zion_hnhf5pqyudikt06evlookutfufqdwc96miyfvjzl',
        pluginFile: ZION_PRIVACY_FILE,
        pluginName: 'Zion Privacy Client',
        textDomain: 'zion-privacy-client',
        licenseOption: 'zion_privacy_license_key',
    ));

    register_activation_hook(ZION_PRIVACY_FILE, static function () use ($zionPrivacyLicenseManager): void {
        try {
            $zionPrivacyLicenseManager->ping(get_option('zion_privacy_license_key') ?: null);
        } catch (\Throwable) {
            // Licensing failures must not prevent the privacy client from activating.
        }
    });
}

register_activation_hook(ZION_PRIVACY_FILE, static function (): void {
    ZionPrivacy\Consent\ConsentEventRepository::install();
});

register_deactivation_hook(ZION_PRIVACY_FILE, static function (): void {
    ZionPrivacy\Consent\ConsentSync::deactivate();
    wp_clear_scheduled_hook('zion_privacy_refresh_cookie_cache');
});

add_action('plugins_loaded', static function (): void {
    (new ZionPrivacy\Plugin())->register();
});
