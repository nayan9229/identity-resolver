# Identity Resolver

> Ultralight browser cookie reader that assembles `user.buyeruid`, `user.eids[]`, device identity, and GDPR/CCPA consent signals for OpenRTB 2.5/2.6 bid requests — with a four-tier fallback strategy designed for ≥95% ad fill rate.

[![CI](https://github.com/nayan9229/identity-resolver/actions/workflows/ci-publish.yml/badge.svg)](https://github.com/nayan9229/identity-resolver/actions/workflows/ci-publish.yml)
[![npm version](https://img.shields.io/github/package-json/v/nayan9229/identity-resolver)](https://github.com/nayan9229/identity-resolver/packages)
[![Bundle size](https://img.shields.io/badge/gzip-~2.2kB-brightgreen)](https://github.com/nayan9229/identity-resolver)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## Why this exists

OpenRTB bid requests require identity and consent signals — `user.buyeruid`, `user.eids[]`, `regs.ext.gdpr`, `device.dnt` — that are scattered across a dozen different browser cookies from multiple ad tech vendors. Assembling them correctly is repetitive, error-prone, and needs graceful degradation when cookies are missing.

This package reads all relevant cookies, resolves the richest available identity signal, and returns a structured object (or directly patches your bid request) ready to send to your SSP.

**Verified against real iHeart production cookie jars.** Handles logged-in users (TTD UID1, Criteo, Google), anonymous users (first-party device ID fallback), EU users (GDPR + TCF string), and completely cookieless environments.

---

## Features

- **Four-tier identity fallback** — never blocks an impression; degrades to contextual-only
- **15+ ID sources** — TTD UID1/UID2, Criteo, Google, Index Exchange, Xandr, Rubicon, PubMatic, LiveRamp, ID5, pubcid, Lotame, Tapad, Adobe ECID, Amplitude, and more
- **Full consent coverage** — OneTrust (C0002–C0004), IAB TCF v2, US Privacy/CCPA, GPC
- **`patchBidRequest()`** — one call patches your entire OpenRTB object
- **Zero runtime dependencies** — pure browser JS
- **~2.2 kB gzip** — UMD, ESM, and CJS builds via Rollup + Terser
- **Universal** — `<script>` tag, ESM `import`, or CJS `require()`
- **Testable** — pass any raw cookie string for SSR or unit testing

---

## Identity tier strategy

| Tier | Signal | `buyeruid` source | eCPM impact |
|------|--------|-------------------|-------------|
| **1** | Synced buyer cookies (`pbjs_unifiedID`, `cto_bidid`, `__gads`, …) | Buyer's own user ID | Maximum |
| **2** | Universal IDs (`__uid2_advertising_token`, `_lr_env`, `id5id`, …) | Privacy-preserving cross-site ID | Strong cookieless |
| **3** | First-party publisher IDs (`DEVICE_ID`, Adobe ECID, …) | Publisher device ID | Contextual + frequency cap |
| **4** | Anonymous | `null` | Contextual only — **still fills** |

---

## Installation

### pnpm (recommended)

```bash
pnpm add @nayan9229/identity-resolver
```

Add to `.npmrc` to point at GitHub Packages:

```
@YOUR_GITHUB_ORG:registry=https://npm.pkg.github.com
```

### npm / yarn

```bash
npm install @nayan9229/identity-resolver
yarn add @nayan9229/identity-resolver
```

### CDN / `<script>` tag (no build step)

```html
<!-- Pin to a specific release (recommended for production)-->
<script src="https://cdn.jsdelivr.net/gh/nayan9229/identity-resolver@1.0.0/dist/index.umd.js"></script>
<script>
  const { resolveIdentitySignals, patchBidRequest } = OpenRTBIdentityResolver;
</script>

<!-- Always latest -->
<script src="https://cdn.jsdelivr.net/gh/nayan9229/identity-resolver@latest/dist/index.umd.js"></script>
```

> **Note:** jsDelivr serves files directly from the GitHub repository. The `dist/` folder is intentionally committed to the repo (not gitignored) so jsDelivr can find it. The CI workflow rebuilds and re-commits `dist/` automatically on every release — you never need to manually commit built files.

---

## Quick start

### Option A — patch your bid request directly

```js
import { patchBidRequest } from '@nayan9229/identity-resolver';

const bidRequest = {
  id: 'req-abc123',
  at: 1,
  imp: [{
    id: '1',
    banner: { format: [{ w: 300, h: 250 }, { w: 300, h: 600 }] },
    bidfloor: 0.50,
    secure: 1,
  }],
  site: { domain: 'yoursite.com', page: 'https://yoursite.com/article/1' },
};

// Adds user.buyeruid, user.eids, regs.ext.gdpr, regs.ext.us_privacy,
// device.dnt, device.lmt, device.ext.deviceId in one call
patchBidRequest(bidRequest);

sendToPubMatic(bidRequest);
```

### Option B — get signals and apply manually

```js
import { resolveIdentitySignals } from '@nayan9229/identity-resolver';

const signals = resolveIdentitySignals();

console.log(signals.buyeruid);     // 'd222bb05-ac06-422e-90e3-9244552fb1f9'
console.log(signals.tierLabel);    // 'synced_buyer'
console.log(signals.gdpr);         // 0
console.log(signals.usPrivacy);    // '1---'
console.log(signals.eids);         // [{ source: 'adserver.org', uids: [...] }, ...]
```

### Option C — `<script>` tag (no bundler)

```html
<script src="https://cdn.jsdelivr.net/gh/nayan9229/identity-resolver@1.0.0/dist/index.umd.js"></script>
<script>
  var signals = OpenRTBIdentityResolver.resolveIdentitySignals();
  console.log('Tier:', signals.tierLabel, '| buyeruid:', signals.buyeruid);
</script>
```

---

## API reference

### `resolveIdentitySignals(cookieOverride?)`

| Parameter | Type | Description |
|-----------|------|-------------|
| `cookieOverride` | `string` (optional) | Raw cookie string for SSR / testing. Omit to read `document.cookie`. |

Returns `IdentitySignals`:

```ts
interface IdentitySignals {
  buyeruid:             string | null;   // primary buyer-side user ID
  eids:                 Eid[]  | null;   // OpenRTB 2.6 user.eids array
  deviceId:             string | null;
  deviceIdSource:       string | null;
  gdpr:                 0 | 1;
  tcfString:            string | null;
  usPrivacy:            string;
  dnt:                  0 | 1;
  lmt:                  0 | 1;
  consentGroups:        ConsentGroups | null;
  advertisingConsented: boolean | null;
  identityTier:         1 | 2 | 3 | 4;
  tierLabel:            'synced_buyer' | 'universal_id' | 'first_party' | 'anonymous';
  eidSources:           string[];
  cookieCount:          number;
}
```

### `patchBidRequest(bidRequest, cookieOverride?)`

Patches an OpenRTB bid request in place. Returns the same object. Existing fields are preserved.

| Path written | Value |
|-------------|-------|
| `user.buyeruid` | Resolved buyer user ID |
| `user.eids` | EID array |
| `user.ext.consent` | TCF string (EU only) |
| `regs.ext.gdpr` | `0` or `1` |
| `regs.ext.us_privacy` | IAB US Privacy string |
| `device.dnt` | `0` or `1` |
| `device.lmt` | `0` or `1` |
| `device.ext.deviceId` | Device ID |

### `parseCookies(cookieString?)`

```js
parseCookies('foo=bar; baz=qux'); // → { foo: 'bar', baz: 'qux' }
```

---

## Supported identity sources

### Tier 1 — Synced buyer IDs

| Cookie | EID domain |
|--------|-----------|
| `pbjs_unifiedID` → TDID | `adserver.org` |
| `cto_bidid` | `criteo.com` |
| `__gads` | `google.com` |
| `_ixxId` / `IXUser` | `indexexchange.com` |
| `uuid2` / `anj` | `appnexus.com` |
| `rpx` / `khaos` | `rubiconproject.com` |
| `KRTBCOOKIE_80` / `PUBMDCID` | `pubmatic.com` |

### Tier 2 — Universal IDs

| Cookie | EID domain |
|--------|-----------|
| `__uid2_advertising_token` | `uidapi.com` |
| `_lr_env` / `liverampId` | `liveramp.com` |
| `id5id` / `pbjs_id5id` | `id5-sync.com` |
| `_pubcid` / `pbjs_sharedID` | `pubcid.org` |
| `_cc_id` / `panoramaId` | `lotame.com` |
| `TapAd_TS` / `TapAd_DID` | `tapad.com` |
| `_mwb_id` | `mediawallah.com` |
| `_di_id` | `deepintent.com` |

### Tier 3 — First-party IDs

| Source | EID domain |
|--------|-----------|
| `DEVICE_ID` / `device_id` / `deviceId` | Publisher domain |
| `AMCV_*` → MCMID | `adobedc.net` |
| Amplitude `ab.storage.deviceId.*` | — |
| `_scor_uid` | `scorecardresearch.com` |

---

## Development

```bash
# Install dependencies
pnpm install

# Run tests
pnpm test

# Run tests with coverage report
pnpm run test:coverage

# Watch mode build
pnpm run build:watch

# Lint
pnpm run lint

# Check bundle sizes (must stay under 3 kB each)
pnpm run size
```

---

## Building

```bash
pnpm run build
```

Outputs in `dist/`:

| File | Format | Use case |
|------|--------|---------|
| `index.umd.js` | UMD minified | `<script>` tag, CDN |
| `index.esm.js` | ESM minified | Webpack, Rollup, Vite |
| `index.cjs` | CJS minified | Node.js, Jest |

---

## CI/CD

```
push / PR → main
  └── ci job  (Node 18, 20, 22 matrix)
        ├── pnpm install --frozen-lockfile
        ├── pnpm run lint
        ├── pnpm run test:ci  (coverage + --ci flag)
        ├── pnpm run build
        └── pnpm run size     (fails if > 3 kB)

GitHub Release (tag: v*)
  └── publish job
        ├── (all ci steps)
        ├── pnpm version <tag> --no-git-tag-version
        ├── pnpm publish --no-git-checks --provenance → GitHub Packages
        └── attach dist/ to release assets
```

---

## Publishing a new version

```bash
# 1. First release
git init && git branch -M main
git add .
git commit -m "feat: initial release"
git remote add origin https://github.com/nayan9229/identity-resolver.git
git push -u origin main

# 2. Tag and push — triggers CI publish
git tag -a v1.0.0 -m "v1.0.0"
git push origin v1.0.0

# 3. Create GitHub Release (triggers publish job)
gh release create v1.0.0 \
  --title "v1.0.0" \
  --generate-notes \
  --latest

# --- Future releases ---

# Bump version (creates commit + tag automatically)
pnpm version patch   # 1.0.0 → 1.0.1
pnpm version minor   # 1.0.0 → 1.1.0
pnpm version major   # 1.0.0 → 2.0.0

# Push commit + tag together
git push origin main --follow-tags

# Create release (auto-generates notes from commits)
gh release create $(git describe --tags --abbrev=0) \
  --generate-notes \
  --latest
```

---

## Why pnpm?

This project uses **pnpm** over npm or Yarn for three reasons:

- **Content-addressable store** — packages are stored once globally and hard-linked into projects, saving disk space and install time
- **Strict isolation** — only explicitly declared dependencies are accessible, preventing phantom dependency bugs
- **Workspace-ready** — if this package grows into a monorepo, pnpm workspaces scale with zero config changes

---

## Contributing

1. Fork the repo
2. Create a branch: `git checkout -b feat/your-feature`
3. Edit `src/index.js`, update `test/index.test.js`
4. Run `pnpm test && pnpm run build`
5. Open a PR against `main`

Coverage must stay ≥90%. Bundle must stay under 3 kB gzip.

---

## License

[MIT](LICENSE) © YOUR_GITHUB_ORG
