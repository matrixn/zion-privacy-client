# Zion Privacy Client

## Current release — 0.1.57

- [x] Shared native WordPress script translations for the public banner and admin preview, including Romanian categories, accessible labels, launcher, fallback descriptions and plural cookie counts.
- [x] Romanian localization for the plugin administration interface and native WordPress dashboard widget when the WordPress user locale is `ro_*`; English is used automatically for every other locale.
- [x] Configurable merchant copy takes priority; English remains the source-language fallback. Scanner-provided cookie names and descriptions remain inventory metadata.
- [x] Editable validated HEX fields accompany the native color pickers. The preferences modal and floating launcher inherit the configured palette.
- [x] Centered mobile banners and fixed preferences overlays remain within the viewport. Switches and actions retain accessible targets, keyboard focus and reduced-motion support.
- [x] The public banner and preferences modal are isolated inside a Shadow DOM boundary, with an explicit typography and component reset so theme styles cannot enlarge or reshape consent categories.
- [x] Consent payloads, required-category rules, connection credentials, licensing and classification behavior are preserved; no consent renewal is triggered by this update.
- [x] Typed native JSON preserves boolean frontend settings; disabled controls stay disabled rather than becoming empty strings.
- [x] Production packaging installs the exact Composer lock before removing development files from the ZIP.
- [x] Validation: production admin build, PHP syntax and twelve isolated Playwright cases, including Romanian labels and English fallback behavior.

```bash
npm ci
npm run build
npm run test:banner
# Requires an isolated WordPress site at localhost:8917 (override ZION_WORDPRESS_TEST_URL).
# Native catalog integration: copy this plugin source to the WordPress test container, then:
wp eval-file /absolute/path/to/zion-privacy-client/tests/wordpress-i18n.php
bash bin/build-release.sh
```

Browser tests use synthetic inventory and intercept consent submissions. They cover four viewport widths (390, 768, 1024 and 1440), Romanian plural forms, the English fallback, custom copy, consent choices and preview isolation. They do not certify legal compliance or an external API deployment. The native integration test loads the script translations through WordPress itself without activating or connecting the plugin. This repository has no configured PHPUnit suite; these checks do not claim PHPUnit or WordPress Coding Standards coverage.

## Zion licensing and releases

The plugin includes `zion/wordpress-license-sdk` `0.4.17` and is registered with the Zion licensing server as `zion-privacy-client`. Licensing and update metadata use the production endpoint `https://license.zion3d.ro/api/v1`.

Release packages are built automatically by `.github/workflows/release.yml` whenever a version tag such as `v0.1.33` is pushed. The workflow reads the product configuration from the licensing server with the repository secret `ZION_PUBLISH_TOKEN`, builds the production ZIP with Composer dependencies included and uploads the asset to the matching GitHub release.

To publish a release:

```bash
git tag v0.1.57
git push origin v0.1.57
```

The product key is used only as the SDK product identifier. The GitHub publishing token must remain a repository secret and must never be committed to the plugin.

The admin dashboard uses a dark-first blue/orange visual system with a persistent light theme option. Cookie inventory results are cached in the WordPress database, refreshed manually or periodically, and display the timestamp of the local snapshot. If the API is temporarily unavailable, the latest saved snapshot remains visible as stale data.

The supported WordPress baseline is 6.5. The admin bundle uses the classic `wp-element` JSX runtime instead of requiring the newer `react-jsx-runtime` script handle, which keeps the dashboard compatible with WordPress 6.5 installations.

Zion Privacy Client is the WordPress client for the Zion Privacy API. It provides a native WordPress administration experience for connecting a site, reviewing scanner results and showing a privacy consent banner.

The plugin is intentionally separated from the Laravel API and browser scanner:

```text
WordPress plugin
    ├── admin dashboard
    ├── cookie inventory
    ├── website statistics
    ├── API connection and HMAC client
    └── consent banner

Zion Privacy API
    ├── OAuth orchestration
    ├── website and installation identity
    ├── Playwright scanner
    ├── cookie classification and history
    └── scan statistics
```

## Current foundation

- WordPress-native PHP bootstrap with PSR-4 Composer autoloading;
- React/TypeScript admin application built with `@wordpress/scripts`;
- Dashboard, Cookies, Statistics and Settings admin pages;
- Statistics analysis workspace with consent KPIs, visitor journey, scan-performance charts, status health, category impact and recent consent activity;
- HMAC request signing compatible with the Laravel API;
- encrypted-at-rest storage for the issued installation credential;
- API REST bridge with nonce and capability protection;
- OAuth redirect/exchange contract owned by the API, with no Google or Facebook secrets in the plugin; the client UI exposes Google connection while the API keeps optional Facebook configuration;
- cookie banner with essential, analytics, marketing and preferences consent states;
- consent analytics stored first in a local WordPress table and synchronized every 15 minutes to the API;
- a native WordPress Dashboard donut widget for accepted, rejected and partially accepted choices;
- a configurable native WordPress Dashboard consent-intelligence widget with overview, visitor comparison, smart insights and category impact sections;
- AJAX-saved widget display controls so administrators can choose which statistics are visible, with single-column expansion when one panel is hidden;
- a Consent banner design studio with grouped behavior, content, action, selector and appearance controls;
- isolated consent banner and cookie preference modal styles, with an option to inherit the active website font or use a neutral system font;
- server-side banner design reset and configurable button hover effects for the public banner and cookie preferences modal;
- unified admin action button styling with consistent primary, secondary and destructive states across plugin pages;
- local category overrides for cookie inventory entries;
- documentation and changelog for each project checkpoint.

### Integration status

The client contains the WordPress-side contract for the secure connection flow. The Google button redirects to the API-owned OAuth endpoints
`/api/v1/oauth/{provider}/start` and `/api/v1/oauth/token`; those server-side OAuth endpoints
must be enabled in the companion Zion Privacy API before connection can complete. The plugin
does not store provider secrets and does not complete OAuth locally.

## Installation

1. Install the plugin in `wp-content/plugins/zion-privacy-client`.
2. Run `composer install --no-dev`.
3. Run `npm ci && npm run build`.
4. Activate **Zion Privacy Client** in WordPress.
5. Open **Zion Privacy → Dashboard** and connect the account with Google. The production API URL is fixed in the plugin.

The API owns Google/Facebook OAuth credentials. Never add provider secrets, Gemini keys or API secrets to this repository or to a WordPress frontend bundle.

## Development

```bash
composer install
npm ci
npm run build
```

For live admin development:

```bash
npm start
```

The plugin requires WordPress 6.5+ and PHP 8.1+.

## Application settings

The **Zion Privacy → Settings** page keeps the production API URL fixed and exposes the controls that are useful for this client:

- live scan refresh interval and API request timeout;
- default scan mode and scenario for new scan forms;
- public banner cookie metadata cache duration;
- consent analytics collection toggle.

The native WordPress Dashboard widget includes its own **Customize statistics** control. The selected sections are stored in WordPress and saved through AJAX. Romanian is selected automatically when the current WordPress admin user uses a Romanian locale; all other locales use English.

The **Consent banner** page provides grouped accordion sections for banner position and width, responsive presentation, text and privacy link, action labels, the Customize cookie selector, category counts and cookie descriptions. Appearance controls include background, text, muted text, border, primary and secondary button colors, button text colors, radius, font size and shadow. The live preview uses the same values that are passed to the public banner.

When the linked property is a WordPress installation, the API client Banner Studio can
request the current plugin configuration and later synchronize edited values back to this
plugin. The exchange uses the installation's existing HMAC credential and the plugin
returns an explicit `success` response only after the configuration has been validated and
stored. No WordPress configuration is considered synchronized when that confirmation is
missing or invalid.

When consent analytics is enabled, each banner choice is stored locally before it is synchronized with the API. The sync runs through a WordPress cron event every 15 minutes and retries unsent rows. The **WordPress Dashboard** widget reads the last 30 days from the API and displays accepted, rejected and partially accepted totals. No cookie values are collected; only the choice, selected categories, page URL and timestamp are sent.

## Release and Synology deployment

The release pipeline is based on the deployment workflow used by the other Zion
WordPress plugins, adapted for this client. `bin/build-release.sh` installs the
JavaScript and Composer dependencies, builds the React admin bundle, creates a
production Composer autoloader and validates the release archive. `bin/build.sh`
is a compatibility entry point for environments that use that filename.

From Windows PowerShell, run the deployment script from the repository root:

```powershell
.\deploy.ps1
```

Build and validate the package without uploading it:

```powershell
.\deploy.ps1 -DryRun
```

The default Synology target is the configured `wordpress-deploy` SSH account at
`192.168.0.10:2022`, with the key
`%USERPROFILE%\.ssh\wordpress-plugin-deploy` and WordPress plugin directory
`/volume1/www/macho.raduta.synology.me/wp-content/plugins`. These values can be
overridden with `-SynologyHost`, `-SynologyPort`, `-SynologyUser`,
`-WordPressPluginsPath` and `-SshPrivateKey`.

The deployment creates a timestamped backup of the previous plugin directory,
installs the new release atomically and retains the five most recent backups.
The `.vscode/tasks.json` file exposes tasks for normal deployment, dry-run
release validation and deployment without the PHP checks.

## API contract

The client signs API requests with:

```text
METHOD
PATH
UNIX_TIMESTAMP
NONCE
RAW_REQUEST_BODY
```

using HMAC-SHA256 and the issued installation secret. OAuth uses a one-time exchange code so the final HMAC secret is never placed in a browser URL.

## License

Proprietary Zion Privacy software. Licensing terms will be added before public distribution.
