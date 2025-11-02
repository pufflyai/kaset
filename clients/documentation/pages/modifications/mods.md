---
title: Mods
---

:::warning
Draft
:::

# Mods

“Permissionless mods” let users reshape the client experience—overriding styles, adjusting UI flows, or interposing on runtime behavior—even when no official API exists. Because Kaset is client‑side only, it cannot change server logic or privileges; it can only influence assets and behavior that reach the browser.

> Use responsibly. Mods run with first‑party privileges on the page they target.

## Workspace layout

Each workspace has exactly one mods root and one staging area:

```
/staged/                       # unminified JS/CSS staged in OPFS (editable)
/mods/
  default/                     # default mod set applied
    manifest.json
    patch.js
    css_override.css
    assets/                    # images, HTML snippets, templates...
```

- `/staged`: Kaset fetches static assets (JS/CSS) and writes pretty‑printed copies into OPFS for editing. You change these, not the live network files.
- `/mods/<...>`: Self‑contained mod packages. Each contains a manifest.json plus optional patch.js, css_override.css, and assets/.

## Manifest schema (minimal)

```json
{
  "id": "default",
  "name": "Default Workspace Mods",
  "load": { "phase": "post-hydration", "order": 10 },
  "overrides": {
    "js": ["patch.js"], // loaded after app boot
    "css": ["css_override.css"] // injected last
  },
  "network": {
    "block_third_party": true, // see “Network policy” below
    "allowed_hosts": ["api.example.com", "static.examplecdn.com"],
    "report_only": false // if true, logs instead of blocks
  },
  "staged": {
    "/assets/app.js": "/staged/app.unmin.js",
    "/assets/app.css": "/staged/app.unmin.css"
  }
}
```

**Load phases**

- `pre-hydration`: prefer CSS‑only tweaks and non-structural DOM hints.
- `post-hydration`: JS behavior patches (avoids SSR mismatch spam).

**Order**: Lower numbers run first; resolve conflicts deterministically.

## How Kaset applies mods

1. **Stage (OPFS)**  
   Kaset pulls site assets and writes readable copies to `/staged`. Kasets edits these files in OPFS.

2. **Sync (overlay snapshot)**  
   On save, Kaset emits a **snapshot** of changed files into a `caches` entry (e.g., `caches.open('kaset-overlay')`). The SW (below) can serve from this overlay without needing direct OPFS access.

3. **Serve (Service Worker overlay)**  
   A Kaset‑owned Service Worker (SW) intercepts requests within scope and:
   - Serves overlayed resources from the `kaset-overlay` cache if present.
   - Falls back to network for others.
   - Enforces the workspace **network policy** (e.g., third‑party blocking).

4. **Runtime injection**  
   After the app hydrates, Kaset injects `css_override.css` and runs `patch.js` idempotently.

5. **Toggle & revert**  
   Mods can be turned on/off per workspace/target. Reverting clears the overlay cache and disables runtime injection.

## 🔴 Global kill switch

A workspace‑wide **“Disable All Mods”** switch helps recover instantly from breakage.

**Activation paths**

- **UI**: a persistent “Kaset • Mods On/Off” toggle.
- **Query param**: `?kaset=off` (disables for this load) and `?kaset=on`.
- **Hash**: `#kaset:off` (useful when query params are stripped).
- **Keyboard**: hold `Esc` for 2 seconds during page load (optional).

**Implementation notes**

- Persist a boolean (e.g., `indexedDB('kaset').settings.disableAll = true`).
- The page script and SW should both consult this flag:
  - **Page**: skip injecting CSS/JS when disabled.
  - **SW**: bypass overlay + network policy and proxy all fetches through to network (or revert to a “report‑only” posture).
- Provide a **one‑shot bypass**: if disabled via URL param/hash, don’t persist—just skip mods for that navigation.

## Network policy: “block third‑party by default”

Blocking third‑party requests by default reduces tracking and surprises and makes the runtime more deterministic.

### Behavior

- If `block_third_party: true` in `manifest.json`, the SW denies requests where the request’s **eTLD+1** differs from the page’s eTLD+1 (e.g., `example.com` vs `metrics.other.com`), unless the hostname matches `allowed_hosts`.
- Non‑HTTP(S) schemes (`blob:`, `data:`) are **not** blocked, but can be optionally disallowed per mod.

### SW sketch

```js
// kaset-sw.js (simplified)
const STATE = {
  disabledAll: false,
  policies: {
    /* populated from manifest(s) */
  },
};

self.addEventListener("message", (e) => {
  if (e.data?.type === "KASET_SET_DISABLED") STATE.disabledAll = !!e.data.value;
  if (e.data?.type === "KASET_SET_POLICIES") STATE.policies = e.data.value;
});

const etld1 = (h) => h.split(".").slice(-2).join("."); // naive; use PSL in prod

async function fetchFromOverlayOrNetwork(req) {
  const cache = await caches.open("kaset-overlay");
  const hit = await cache.match(req, { ignoreSearch: false });
  return hit || fetch(req);
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (!/^https?:$/.test(url.protocol)) return; // let it pass

  event.respondWith(
    (async () => {
      if (STATE.disabledAll) return fetch(event.request);

      const {
        block_third_party,
        allowed_hosts = [],
        report_only,
      } = STATE.policies[url.origin] || STATE.policies["*"] || {};

      // Overlay first
      const overlay = await caches.open("kaset-overlay");
      const cached = await overlay.match(event.request);
      if (cached) return cached;

      // Network policy
      if (block_third_party) {
        const same = etld1(url.hostname) === etld1(self.location.hostname);
        const whitelisted = allowed_hosts.some((h) => url.hostname === h || url.hostname.endsWith("." + h));
        const allowed = same || whitelisted;
        if (!allowed) {
          if (report_only) {
            console.warn("[Kaset] Third-party (report-only):", url.href);
            return fetch(event.request);
          }
          return new Response("", { status: 451, statusText: "Blocked by Kaset policy" });
        }
      }

      return fetch(event.request);
    })(),
  );
});
```

## PatchJS (behavioral mods)

Principles:

- **Idempotent**: set a guard; repeat calls are no‑ops.
- **Scoped**: namespace globals (`window.__kaset_mod_<id>`).
- **Hydration‑aware**: avoid structural DOM edits before hydration; prefer CSS early, JS late.
- **Surgical re‑apply**: use `MutationObserver` with throttling and attribute guards (`data-kaset-done`).

Minimal pattern:

```js
// /mods/default/patch.js
export function apply() {
  if (window.__kaset_default_applied) return;
  window.__kaset_default_applied = true;

  const run = () => {
    const banner = document.querySelector('[data-upsell="promo"]');
    if (banner && !banner.dataset.kasetHidden) {
      banner.style.display = "none";
      banner.dataset.kasetHidden = "1";
    }
  };

  queueMicrotask(run);

  const mo = new MutationObserver(() => {
    if (window.__kaset_rAF) cancelAnimationFrame(window.__kaset_rAF);
    window.__kaset_rAF = requestAnimationFrame(run);
  });

  mo.observe(document.body, { childList: true, subtree: true });
}
```

## CSS overrides

Keep it late‑loaded and token‑friendly:

```css
/* /mods/default/css_override.css */
:root {
  /* prefer tokens used by the app if available */
  --brand-accent: #444;
  --focus-ring: 2px solid rgba(0, 0, 0, 0.6);
}

header .upsell-banner {
  display: none !important;
}
a:focus-visible,
button:focus-visible {
  outline: var(--focus-ring);
  outline-offset: 2px;
}
```

---

_IMPLEMENTATION NOTES_

## Edge cases to consider

- **DOM churn by app code** → Reapply narrowly; tag nodes with `data-kaset-*` after mutating.
- **Conflicting patches** → Use `load.order`; name‑space functions; avoid monkey‑patch unless wrapped and reversible.
- **Infinite loops** → Don’t mutate ancestors watched by your own observer; throttle; attribute‑guard writes.
- **SSR mismatch** → Defer structural changes until `post-hydration`. Use CSS early for visual changes.
- **CSP/SRI** → If `integrity` blocks injection, prefer SW overlay of the original asset (replace content without changing the tag).

## Operational guidance (short)

- **Granularity**: Prefer a small number of well‑scoped mods to a giant “kitchen‑sink.”
- **Layering**: Use `default/` for universal tweaks; add domain‑specific folders for app‑specific behavior.
- **Recovery**: Keep the 🔴 kill switch reachable even when the target app is broken: URL param/hash + SW consult + UI toggle.

## Reference mods

Here are small, self‑contained examples you can drop into `/mods/<target-id>/`.

### 1) Clean Header / Anti‑Upsell (UI tidying)

**manifest.json**

```json
{
  "id": "ui-cleanup",
  "load": { "phase": "post-hydration", "order": 20 },
  "overrides": { "js": ["patch.js"], "css": ["css_override.css"] }
}
```

**css_override.css**

```css
header .upsell-banner,
aside .trial-nag {
  display: none !important;
}
```

**patch.js**

```js
export function apply() {
  if (window.__kaset_ui_cleanup) return;
  window.__kaset_ui_cleanup = true;

  const hide = (sel) =>
    document.querySelectorAll(sel).forEach((n) => {
      if (!n.dataset.kasetHidden) {
        n.style.display = "none";
        n.dataset.kasetHidden = "1";
      }
    });

  const run = () => hide("header .upsell-banner, aside .trial-nag");
  run();

  new MutationObserver(() => queueMicrotask(run)).observe(document.body, { childList: true, subtree: true });
}
```

### 2) Keyboard Shortcuts (productivity)

**manifest.json**

```json
{
  "id": "keys",
  "load": { "phase": "post-hydration", "order": 30 },
  "overrides": { "js": ["patch.js"] }
}
```

**patch.js**

```js
export function apply() {
  if (window.__kaset_keys) return;
  window.__kaset_keys = true;

  addEventListener(
    "keydown",
    (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.metaKey || e.ctrlKey)
        return;

      // j/k to navigate list items
      if (e.key === "j") {
        document.querySelector('[data-nav="next"]')?.click();
        e.preventDefault();
      }
      if (e.key === "k") {
        document.querySelector('[data-nav="prev"]')?.click();
        e.preventDefault();
      }

      // g then g: go top
      if (e.key === "g") {
        const t = (window.__kaset_t = (window.__kaset_t || 0) + 1);
        setTimeout(() => (window.__kaset_t = 0), 450);
        if (t === 2) {
          scrollTo({ top: 0, behavior: "smooth" });
          e.preventDefault();
        }
      }
    },
    { passive: false },
  );
}
```

### 3) Accessibility Boost (focus ring + skip link)

**manifest.json**

```json
{
  "id": "a11y",
  "matches": ["*://*.example.com/*"],
  "load": { "phase": "pre-hydration", "order": 5 },
  "overrides": { "css": ["css_override.css"], "js": ["patch.js"] }
}
```

**css_override.css**

```css
a:focus-visible,
button:focus-visible,
[tabindex]:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 3px;
}
```

**patch.js**

```js
export function apply() {
  if (window.__kaset_a11y) return;
  window.__kaset_a11y = true;

  const skip = document.createElement("a");
  skip.href = "#main";
  skip.textContent = "Skip to content";
  skip.style.position = "absolute";
  skip.style.left = "-9999px";
  skip.addEventListener("focus", () => {
    skip.style.left = "8px";
    skip.style.top = "8px";
  });
  skip.addEventListener("blur", () => {
    skip.style.left = "-9999px";
  });
  document.body.prepend(skip);

  if (!document.getElementById("main")) {
    const main = document.querySelector("main") || document.body;
    main.id = "main";
  }
}
```

### 4) Dark Mode (token‑based override)

**manifest.json**

```json
{
  "id": "dark-mode",
  "load": { "phase": "pre-hydration", "order": 8 },
  "overrides": { "css": ["css_override.css"] }
}
```

**css_override.css**

```css
:root {
  color-scheme: dark;
  --bg: #0f1115;
  --fg: #e6e6e6;
  --muted: #a0a4ab;
  --elev: #171a21;
  --accent: #8ab4f8;
}
html,
body {
  background: var(--bg);
  color: var(--fg);
}
.card,
.modal,
.dropdown {
  background: var(--elev) !important;
}
a {
  color: var(--accent);
}
```

### 5) Network Minimalist (enforces third‑party block with allowlist)

**manifest.json**

```json
{
  "id": "net-minimal",
  "load": { "phase": "post-hydration", "order": 1 },
  "overrides": {},
  "network": {
    "block_third_party": true,
    "allowed_hosts": ["api.example.com", "static.examplecdn.com", "fonts.gstatic.com"],
    "report_only": false
  }
}
```

**Notes**

- This mod doesn’t inject UI; it just contributes policy.
- Combine with other mods; SW merges policies (most restrictive wins unless explicitly relaxed).
