# Zion Privacy Client

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
- HMAC request signing compatible with the Laravel API;
- encrypted-at-rest storage for the issued installation credential;
- API REST bridge with nonce and capability protection;
- OAuth redirect/exchange contract owned by the API, with no Google or Facebook secrets in the plugin;
- cookie banner with essential, analytics, marketing and preferences consent states;
- consent analytics stored first in a local WordPress table and synchronized every 15 minutes to the API;
- a native WordPress Dashboard donut widget for accepted, rejected and partially accepted choices;
- local category overrides for cookie inventory entries;
- documentation and changelog for each project checkpoint.

### Integration status

The client contains the WordPress-side contract for the secure connection flow. The Google and
Facebook buttons redirect to the API-owned OAuth endpoints
`/api/v1/oauth/{provider}/start` and `/api/v1/oauth/token`; those server-side OAuth endpoints
must be enabled in the companion Zion Privacy API before connection can complete. The plugin
does not store provider secrets and does not complete OAuth locally.

## Installation

1. Install the plugin in `wp-content/plugins/zion-privacy-client`.
2. Run `composer install --no-dev`.
3. Run `npm ci && npm run build`.
4. Activate **Zion Privacy Client** in WordPress.
5. Open **Zion Privacy → Dashboard** and connect the account with Google or Facebook. The production API URL is fixed in the plugin.

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

The plugin requires WordPress 6.4+ and PHP 8.1+.

## Application settings

The **Zion Privacy → Settings** page keeps the production API URL fixed and exposes the controls that are useful for this client:

- live scan refresh interval and API request timeout;
- default scan mode and scenario for new scan forms;
- public banner cookie metadata cache duration;
- consent analytics collection toggle.

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
