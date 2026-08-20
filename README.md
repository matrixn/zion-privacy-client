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
5. Open **Zion Privacy → Settings**, enter the public Zion Privacy API URL and connect the account.

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
