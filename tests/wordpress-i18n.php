<?php
/** Exercise the real WordPress script translation loader in an isolated CLI instance. */

if (!defined('WP_CLI') || !WP_CLI || !in_array(wp_parse_url(home_url(), PHP_URL_HOST), ['localhost', '127.0.0.1', '[::1]'], true)) {
    throw new RuntimeException('This fixture requires the isolated local WordPress tests instance.');
}

define('ZION_PRIVACY_DIR', dirname(__DIR__).'/');
define('ZION_PRIVACY_URL', home_url('/wp-content/plugins/zion-privacy-client/'));
define('ZION_PRIVACY_VERSION', '0.1.48');
require_once ZION_PRIVACY_DIR.'src/Frontend/BannerLocalization.php';

$locale = static fn (): string => 'ro_RO';
add_filter('determine_locale', $locale);
try {
    \ZionPrivacy\Frontend\BannerLocalization::enqueue();
    $json = load_script_textdomain(\ZionPrivacy\Frontend\BannerLocalization::HANDLE, 'zion-privacy-client', ZION_PRIVACY_DIR.'languages');
    $data = json_decode($json ?: '', true, 512, JSON_THROW_ON_ERROR);
    if ('Anulează' !== $data['locale_data']['messages']['Cancel'][0] || 3 !== count($data['locale_data']['messages']['%d cookie detected'])) {
        throw new RuntimeException('The native WordPress loader did not resolve the Romanian catalog.');
    }
    if (!in_array('wp-i18n', wp_scripts()->registered[\ZionPrivacy\Frontend\BannerLocalization::HANDLE]->deps, true)) {
        throw new RuntimeException('The native i18n dependency is missing.');
    }
    WP_CLI::success('Native Romanian script catalog and plural forms loaded.');
} finally {
    remove_filter('determine_locale', $locale);
}
