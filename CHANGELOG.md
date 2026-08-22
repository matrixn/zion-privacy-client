# Changelog

### Commit 37 — Sync configurable branding and website copyright

- Persisted the API-provided Powered by URL and per-website copyright preference during OAuth connection and website refreshes.
- Added a safe fallback to `https://zion3d.ro` when the API branding response is missing or invalid.
- Made both the public consent banner and preferences modal honor the website copyright setting and use the configured branding URL.
- Bumped plugin version to `0.1.32`.

### Commit 36 — Add public banner branding

- Added a subtle `Powered by ZionPrivacy` footer to the public consent banner, matching the existing branded footer in the preferences modal.
- Linked the branding to `https://zion3d.ro` in a new tab with isolated banner styling.
- Bumped plugin version to `0.1.31`.

### Commit 35 — Raise consent host stacking context

- Applied the maximum practical z-index to the Shadow DOM host itself, not only its internal modal elements.
- Made the host transparent to pointer events outside the consent UI while preserving interaction with the modal and floating cookie launcher.
- Bumped plugin version to `0.1.30`.

### Commit 34 — Refined top-right navigation toolbar

- Replaced the stacked top-right controls with a horizontal toolbar containing the API status pill and compact icon actions.
- Added spacing, consistent button surfaces and light-theme contrast so the controls no longer overlap or resemble a vertical stack.
- Bumped plugin version to `0.1.29`.

### Commit 33 — Compact consent actions in navigation

- Replaced the top-right theme, renew-consent and banner-preview labels with compact icon-only buttons so the navigation remains clean at narrow widths.
- Preserved accessible labels and native tooltips for every action.
- Bumped plugin version to `0.1.28`.

### Commit 32 — Keep custom banner text out of preferences modal

- Removed the custom banner message from the preferences modal so the modal shows only its standard instructions and enabled legal links.
- Changed the top-right consent and theme actions to compact icon-only buttons with accessible labels and tooltips.
- Bumped plugin version to `0.1.27`.

### Commit 31 — Expanded banner positions and quick consent actions

- Added top centered, bottom centered, top right and top left banner positions in the admin settings and public banner CSS.
- Made full-width top and bottom positions span the complete browser width without applying the maximum-width setting.
- Made the maximum-width field optional; leaving it blank lets compact and centered layouts use the available viewport width.
- Added `Renew consents` and `View banner` actions below the API status and theme switcher in the plugin navigation bar.
- Raised the consent banner host and preferences modal to the highest practical browser stacking level.
- Bumped plugin version to `0.1.26`.

### Commit 30 — Fixed consent preferences modal scrolling

- Made the preferences modal header and footer fixed while only the cookie category content scrolls vertically.
- Moved the custom banner message and all enabled legal links into the fixed modal header beneath the preference instructions.
- Removed the residual base-banner strip that remained visible behind the modal and kept the configured action buttons and `Powered by ZionPrivacy` branding fixed in the footer.
- Bumped plugin version to `0.1.25`.

### Commit 29 — Floating cookie preferences launcher and legal link targets

- Added a floating cookie icon that remains available after any consent choice and opens the preferences modal again from a configurable browser corner.
- Added modal footer actions using the configured banner labels, legal links and a branded `Powered by ZionPrivacy` link to `https://zion3d.ro`.
- Fixed the modal close control alignment and added `_self`, `_blank`, `_parent` and `_top` targets for legal links.
- Selecting a legal page now copies its WordPress page title into the editable link label automatically.
- Bumped plugin version to `0.1.24`.

### Commit 28 — Site-local cookie category overrides and AI route fix

- Added an explicit Save action and success notification when changing a cookie category; saved overrides remain local to this WordPress website and are reapplied after future scans.
- Fixed the WordPress REST AI identification route by exposing its callback as a valid public handler.
- Bumped plugin version to `0.1.23`.

### Commit 27 — Configurable legal links in the consent banner

- Added independent Privacy Policy, Terms and Conditions and Cookie Policy switches in the Consent banner design settings.
- Added WordPress page selectors and editable link labels for each legal document; enabled links are rendered together in the public banner and the live preview.
- Added a protected page-list endpoint for the admin UI and preserved compatibility with the existing single privacy-policy link setting.
- Bumped plugin version to `0.1.22`.

### Commit 26 — Dashboard consent intelligence and policy controls

- Expanded the plugin dashboard with website connection status, regulation, Worldwide targeting, forced public banner preview, cookie summary details, consent trends, scan pageview chart and recent anonymized consent logs.
- Added GDPR, US State Laws and GDPR + US State Laws regulation choices; the public banner changes its consent selector defaults and legal action labels accordingly.
- Added Consent log settings with an audit-purpose help tooltip and anonymous visitor identifiers; no names, emails or IP addresses are collected.
- Added Renew user consents, which increments the banner policy version so returning visitors see the banner again while previous consent history remains preserved.
- Added public preview mode at `?zion_priv_preview=true`, including when the banner is disabled or an older consent decision exists.
- Bumped plugin version to `0.1.21`.

## Unreleased

### Commit 25 — Stop active scans

- Replaced Run with Stop for queued and active scans in the plugin Scans table.
- Added confirmation and AJAX handling for cancellation while keeping partial scanner results.
- Added the cancelled status styling and bumped the plugin version to `0.1.20`.

### Commit 23 — Solid, high-contrast button states

- Replaced ambiguous button gradients with readable solid surfaces, explicit borders and visible hover/active feedback across dark and light themes.
- Kept primary, secondary and destructive actions visually distinct without sacrificing contrast.

### Commit 24 — Scan controls and protected cookie AI identification

- Added representative icons to scan actions, redesigned the destructive action state for clearer contrast and added visible last-scan and last-successful-scan timestamps.
- Refreshing scans now clears the existing table before the fresh API response is rendered.
- Added a cookie AI identification action that reuses the API knowledge database first and shows a Pro+ requirement for Free accounts; the API remains the authoritative server-side entitlement check.
- Added AI source/status presentation and kept refresh/cache behavior intact.

### Commit 22 — Dashboard visual polish, theme switcher and local cookie cache

- Replaced the Dashboard Cookie summary legend with a responsive category donut chart and improved the Website connection card with a visible site identity and status badge.
- Added a professional dark-first blue/orange theme system with a light variant, a menu theme switcher and `localStorage` persistence.
- Added a WordPress database-backed cookie snapshot with saved timestamp, manual refresh, periodic refresh and stale-cache fallback when the API is temporarily unavailable.
- Added an hourly WP-Cron refresh for the local cookie snapshot and removed the scheduled event on plugin deactivation.
- Bumped the plugin version to 0.1.18.

### Commit 21 — Plan-aware scan limits and live entitlement usage

- Displayed real scan usage in the Dashboard plan cards, including latest pages, total pages, website usage and completed/failed scan counts.
- Added API usage fields for completed pages, cookies and scans so the plugin no longer presents entitlements without their current consumption.
- Updated the API scan flow to use the connected user’s package limit before the global scanner default, while keeping per-site scanner overrides available.
- Bumped the plugin version to 0.1.17.

### Commit 20 — Runtime metadata and Google-only connection UI

- Sent WordPress and PHP runtime versions with OAuth exchange and every authenticated API request so the API can display current client compatibility data.
- Removed Facebook connection buttons from the plugin dashboard and Settings screens while preserving the provider implementation in code and API configuration.
- Bumped the plugin version to 0.1.16.

### Commit 19 — Notifications below the page header

- Moved plugin toast notifications into the normal page flow directly below the title and subtitle.
- Prevented notifications from covering the Zion Privacy navigation or blocking controls underneath it.
- Kept the existing pause-on-hover, click-to-copy and progress timer behavior, with responsive full-width placement on small screens.

### Commit 18 — Unified admin action buttons

- Moved Reset design below the banner accordions, directly before Save banner settings.
- Added spacing and a divider between the final settings section and the action row.
- Reworked primary, secondary and destructive admin buttons with a unified gradient surface, hover lift, focus ring and active states across all plugin pages.

### Commit 17 — Banner reset and button hover controls

- Added a server-side Reset design action that restores all consent banner defaults without changing application or connection settings.
- Added configurable button hover animations for the banner and cookie preferences modal: enable/disable, effect, duration and scale.
- Connected the hover settings to the live preview and the isolated public banner.

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
### Commit 23 — Solid, high-contrast button states

- Replaced gradients from admin and consent-banner buttons with clear solid action colors for neutral, primary and destructive actions.
- Added consistent readable text contrast, keyboard focus rings and subtle hover/pressed feedback in dark and light themes.
- Kept the configured consent-banner colors intact while preventing inherited site backgrounds or gradients from reducing button legibility.
