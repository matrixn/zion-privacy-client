=== Zion Privacy Client ===
Contributors: zionprivacy
Tags: privacy, cookies, gdpr, consent, scanner
Requires at least: 6.4
Requires PHP: 8.1
Stable tag: 0.1.0
License: Proprietary

Zion Privacy Client connects WordPress to the Zion Privacy API for cookie scanning, privacy statistics and consent management.

== Description ==

The plugin provides a WordPress-native dashboard for connecting a site to Zion Privacy, reviewing discovered cookies, viewing website statistics and displaying a consent banner.

OAuth credentials remain on the Zion Privacy API. The plugin does not contain Google, Facebook, Gemini or API provider secrets. The WordPress UI currently exposes Google connection only.

== Installation ==

1. Upload the plugin directory to `wp-content/plugins/`.
2. Install the production Composer autoloader included in the release package.
3. Activate the plugin from WordPress.
4. Open `Zion Privacy` in the WordPress admin and configure the API connection.
