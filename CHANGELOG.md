# Changelog

## Unreleased

### Commit 8 — Full-height admin workspace

- Extended the plugin workspace across the full WordPress content height and removed the unused white footer area.
- Fixed the horizontal navigation bar at the top of the available viewport and kept the API connection status anchored in the same position regardless of page content height.

### Commit 7 — Live scans and consent banner workspace

- Added automatic AJAX polling on the Scans page while a scan is active, so page and cookie counts update as the scanner progresses.
- Reworked the plugin navigation into a horizontal bar with relevant WordPress Dashicons and added the dedicated Consent banner page.
- Moved banner settings out of Settings into a live editor with an interactive preview and cookie-category customization dialog.
- Added cookie metadata to the public banner's Customize dialog, including category, name, description and vendor where available.
- Added a Refresh cookies AJAX action to the plugin cookie inventory.

### Commit 6 — Scan scheduling workspace

- Added an AJAX scan creation and editing modal with manual and automatic modes.
- Added daily, weekly and monthly recurrence controls, including a one-year date picker and the API's last-valid-day behavior for short months.
- Added scan actions for edit, delete with confirmation, run with confirmation and refresh, with floating notifications for each result.
- Added the connected account plan and entitlement usage card to the dashboard.
- Added API bridge methods for PATCH, DELETE, scan actions and account limits.

### Commit 5 — Standalone admin workspace

- Replaced the WordPress submenu pages with a standalone Zion Privacy vertical navigation workspace.
- Added the AJAX-powered Scans page with refresh and complete scan history for the linked website.
- Added floating notifications with five-second auto-dismiss, hover pause and click-to-copy behavior.
- Added a dark indigo, cyan and violet admin visual system with responsive navigation, cards and status badges.

### Commit 4 — OAuth handler and Settings layout

- Fixed the WordPress REST OAuth handler visibility so the Google/Facebook connection endpoint is accepted by WordPress.
- Removed the provider-secrets sentence from the connection banner.
- Reworked the Settings layout with responsive cards, stacked headings/descriptions and consistent action spacing.

### Commit 2 — Synology release and deployment workflow

- Added the adapted Synology deployment script with WSL build support, SSH key validation, dry-run mode, timestamped backups and rollback handling.
- Added `bin/build-release.sh` for the production Composer/React release stage and `bin/build.sh` as a compatibility entry point.
- Added the WordPress distribution `readme.txt` and verified that the compiled admin bundle is included in release archives.
- Added VS Code tasks for deployment, dry-run validation and deployment without tests.

### Commit 1 — plugin foundation

- Initialized the standalone WordPress client repository.
- Added the Zion Privacy plugin bootstrap, Composer PSR-4 autoloading and WordPress service container.
- Added a React/TypeScript admin shell with Dashboard, Cookies, Statistics and Settings navigation.
- Added the HMAC API client, encrypted credential vault, REST bridge and API-owned OAuth exchange contract.
- Added the initial consent banner and local cookie-category override storage.
- Added English project documentation and development commands.
