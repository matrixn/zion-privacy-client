# Changelog

## Unreleased

### Commit 16 — Isolated consent banner styles

- Rendered the consent banner and cookie preferences modal inside an isolated Shadow DOM so theme CSS cannot override their layout, controls or typography.
- Added the `Use website font` setting; when disabled, the banner and modal use a neutral system font while keeping all other styles isolated.
- Loaded the banner stylesheet inside the isolated component instead of exposing it globally on the site.

### Commit 15 — Reliable sticky consent preview

- Moved the Live preview card into a dedicated sticky wrapper so it remains visible while scrolling through the consent banner settings.
- Prevented the global WordPress card overflow rule from interfering with the sticky positioning.
- Disabled sticky positioning when the layout collapses to one column on tablet and mobile screens.

### Commit 14 — Sticky consent banner preview

- Kept the Live preview card visible while scrolling through the consent banner settings on desktop.
- Disabled sticky positioning when the layout collapses to one column on tablet and mobile screens.

### Commit 13 — Consent banner design studio

- Added accordion-based banner configuration for behavior, layout, content, buttons, cookie selector and appearance.
- Added configurable button labels, Customize visibility, cookie details/counts visibility and selector copy.
- Added configurable position, width, radius, shadow, font size, text colors, button colors and border color.
- Connected all values to the live preview and the public consent banner, with safe defaults and server-side sanitization.

### Commit 12 — Settings layout

- Placed the API connection and connection details cards side by side on desktop.
- Kept application behavior full width and preserved the responsive single-column layout on smaller screens.

### Commit 11 — Consent analytics

- Added local consent event storage for accepted, rejected and partially accepted banner choices.
- Added periodic 15-minute HMAC synchronization from WordPress to the API with retry-safe UUIDs.
- Added the WordPress Dashboard consent trends widget with a donut chart and 30-day totals.
- Added the consent tracking switch to plugin Settings and a public token/origin-validated event endpoint.

### Commit 10 — Application settings

- Added live scan refresh interval, API timeout, default scan mode, default scenario and banner cookie-cache settings to the plugin Settings page.
- Connected those values to the AJAX scan workflow, API client and public banner metadata cache.
- Added explanatory controls and bounded values so settings remain safe for the WordPress site.

### Commit 9 — WordPress menu offset

- Anchored the fixed Zion Privacy navigation after the WordPress admin menu instead of allowing it to render underneath it.
- Added offsets for the standard 160px menu, the 36px collapsed menu and the responsive mobile layout.

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
