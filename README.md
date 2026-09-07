# CORS Unlock

A lightweight Chrome extension (Manifest V3) that unblocks CORS errors for local development — no `chrome.debugger`, no visible "debugging this browser" banner.
## How it works
**1. Baseline rule (site-wide)**
When enabled, a `declarativeNetRequest` dynamic rule stamps every `xhr`/`sub_frame`/`main_frame` response with:
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET,POST,PUT,DELETE,OPTIONS`
- `Access-Control-Allow-Headers: *`

This covers most CORS errors — anything that isn't a credentialed request.

**2. Per-tab rule (credentialed requests)**
Browsers reject `Access-Control-Allow-Origin: *` on requests sent with cookies (`credentials: "include"`). The spec requires the *exact* request origin echoed back, plus `Access-Control-Allow-Credentials: true`.

Since `declarativeNetRequest` can't read a request's origin dynamically, the extension already knows it — from the tab's own URL. So a second rule, scoped to that specific `tabId` (higher priority than the baseline rule), sets the exact origin + credentials header. No `chrome.debugger`, no banner.

**3. Keeping the per-tab rule in sync**
The rule has to exist *before* the page's own scripts fire their first request, or it's too late. To catch that early:
- `src/background/hook.js` is injected at `document_start` (before page scripts run) and immediately messages the background service worker with the tab's origin.
- `chrome.tabs.onUpdated` / `onActivated` re-sync the rule as a backup (covers SPA navigation, tab switches).
- `chrome.tabs.onRemoved` cleans up the rule when a tab closes.

**4. Blacklist**
Sites added to the blacklist (via the popup) are excluded from both the baseline rule (`excludedInitiatorDomains`) and the per-tab rule — the rule is explicitly removed, not just skipped, so blacklisting takes effect immediately without needing a new tab.

**5. Icon + toggle state**
`corsEnabled` in `chrome.storage.local` is the single source of truth. Any change re-runs `initState()`, which rebuilds the baseline rule and updates the toolbar icon. `chrome.runtime.onStartup` / `onInstalled` re-run this on browser launch so the icon doesn't go stale after a restart.

## Usage
1. Click the extension icon, flip the toggle **ON**.
2. If a request was already in flight before the toggle/tab load completed, reload the page once — the rule needs to exist *before* the request fires.
3. To exclude a site, open the popup on that site and click **Blacklist this site**.

## Known limitations
- **One reload may be needed** after opening a new tab — this is a `declarativeNetRequest` timing constraint, not a bug. A rule can't retroactively apply to a request that already went out.
- **No live, arbitrary-origin reflection** — the extension reflects the *current tab's* origin, not any origin dynamically. This avoids needing `chrome.debugger` (and its banner) but means it's scoped to typical single-origin dev/test setups rather than general-purpose multi-origin proxying.

## Project structure
```
manifest.json
src/
  background/
    background.js   # DNR rules, icon/state sync, message handling
    hook.js          # injected at document_start, reports tab origin early
  settings/
    settings.html    # popup UI
    settings.css
    settings.js      # toggle + blacklist logic
assets/                # icons (on/off states)
```

## Permissions
- `storage` — persist enabled state + blacklist
- `declarativeNetRequest` — inject CORS headers
- `host_permissions: *://*/*` — apply rules on any site
- content script (`src/background/hook.js`) at `document_start` — no extra permission needed beyond host permissions