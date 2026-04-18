# openrtb-identity-resolver

> Ultralight browser cookie reader that assembles `user.buyeruid`, `user.eids[]`, device identity, and GDPR/CCPA consent signals for OpenRTB 2.5/2.6 bid requests — with a four-tier fallback strategy designed for ≥95% ad fill rate.

[![CI](https://github.com/YOUR_GITHUB_ORG/openrtb-identity-resolver/actions/workflows/ci-publish.yml/badge.svg)](https://github.com/YOUR_GITHUB_ORG/openrtb-identity-resolver/actions/workflows/ci-publish.yml)
[![npm version](https://img.shields.io/github/package-json/v/YOUR_GITHUB_ORG/openrtb-identity-resolver)](https://github.com/YOUR_GITHUB_ORG/openrtb-identity-resolver/packages)
[![Bundle size](https://img.shields.io/badge/gzip-~1.5kB-brightgreen)](https://github.com/YOUR_GITHUB_ORG/openrtb-identity-resolver)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## Why this exists

OpenRTB bid requests require identity and consent signals — `user.buyeruid`, `user.eids[]`, `regs.ext.gdpr`, `device.dnt` — that are scattered across a dozen different browser cookies from multiple ad tech vendors. Assembling them correctly is repetitive, error-prone, and needs to handle graceful degradation when cookies are missing.

This package does exactly that: reads all relevant cookies, resolves the richest available identity signal, and returns a structured object (or directly patches your bid request) ready to send to your SSP.

**Verified against real iHeart production cookie jars.** Handles logged-in users (TTD UID1, Criteo, Google), anonymous users (first-party device ID fallback), EU users (GDPR + TCF string), and completely cookieless environments.

---

## Features

- **Four-tier identity fallback** — never blocks an impression; degrades gracefully to contextual-only
- **15+ ID sources** — TTD UID1/UID2, Criteo, Google, Index Exchange, Xandr/AppNexus, Rubicon, PubMatic, LiveRamp RampID, ID5, pubcid, Lotame, Tapad, Adobe ECID, Amplitude, and more
- **Full consent coverage** — OneTrust (C0002–C0004), IAB TCF v2, US Privacy / CCPA, GPC
- **`patchBidRequest()`** — one call patches your entire OpenRTB object
- **Zero dependencies** — no runtime deps, pure browser JS
- **Ultralight** — ~1.5 kB gzipped UMD build
- **Universal** — UMD `<script>` tag, ESM `import`, or CJS `require()`
- **Testable** — pass any raw cookie string for SSR or unit testing

---

## Identity tier strategy

The resolver walks four tiers in order and stops at the highest tier found:

| Tier | Signal | `buyeruid` source | eCPM impact |
|------|--------|-------------------|-------------|
| **1** | Synced buyer cookies (`pbjs_unifiedID`, `cto_bidid`, `__gads`, …) | Buyer's own user ID | Maximum |
| **2** | Universal IDs (`__uid2_advertising_token`, `_lr_env`, `id5id`, …) | Privacy-preserving cross-site ID | Strong cookieless |
| **3** | First-party publisher IDs (`DEVICE_ID`, Adobe ECID, …) | Publisher device ID | Contextual + frequency cap |
| **4** | Anonymous | `null` | Contextual only — **still fills** |

Tier 4 always returns a valid object. Auctions are never blocked.

---

## Installation

### npm / yarn (GitHub Packages)

```bash
# npm
npm install @YOUR_GITHUB_ORG/openrtb-identity-resolver

# yarn
yarn add @YOUR_GITHUB_ORG/openrtb-identity-resolver
```

Add to `.npmrc` to point at GitHub Packages registry:

```
@YOUR_GITHUB_ORG:registry=https://npm.pkg.github.com
```

### CDN / `<script>` tag (no build step)

```html
<!-- Latest release from GitHub Packages CDN -->
<script src="https://cdn.jsdelivr.net/gh/YOUR_GITHUB_ORG/openrtb-identity-resolver@latest/dist/index.umd.js"></script>
<script>
  const { resolveIdentitySignals, patchBidRequest } = OpenRTBIdentityResolver;
</script>
```

Or pin to a specific version:

```html
<script src="https://cdn.jsdelivr.net/gh/YOUR_GITHUB_ORG/openrtb-identity-resolver@1.0.0/dist/index.umd.js"></script>
```

---

## Quick start

### Option A — patch your bid request directly

```js
import { patchBidRequest } from '@YOUR_GITHUB_ORG/openrtb-identity-resolver';

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
// device.dnt, device.lmt, device.ext.deviceId
patchBidRequest(bidRequest);

sendToPubMatic(bidRequest);
```

### Option B — get signals and apply manually

```js
import { resolveIdentitySignals } from '@YOUR_GITHUB_ORG/openrtb-identity-resolver';

const signals = resolveIdentitySignals();

console.log(signals.buyeruid);     // 'd222bb05-ac06-422e-90e3-9244552fb1f9'
console.log(signals.tierLabel);    // 'synced_buyer'
console.log(signals.gdpr);         // 0
console.log(signals.usPrivacy);    // '1---'
console.log(signals.eids);         // [{ source: 'adserver.org', uids: [...] }, ...]

// Apply to your own bid request builder
bidReq.user.buyeruid = signals.buyeruid;
bidReq.user.eids     = signals.eids;
bidReq.regs.ext      = { gdpr: signals.gdpr, us_privacy: signals.usPrivacy };
```

### Option C — `<script>` tag (no bundler)

```html
<script src="https://cdn.jsdelivr.net/gh/YOUR_GITHUB_ORG/openrtb-identity-resolver@1.0.0/dist/index.umd.js"></script>
<script>
  window.addEventListener('DOMContentLoaded', function () {
    const { resolveIdentitySignals, patchBidRequest } = OpenRTBIdentityResolver;

    var signals = resolveIdentitySignals();
    console.log('Identity tier:', signals.tierLabel);
    console.log('Buyer UID:', signals.buyeruid);

    var bidReq = buildMyBidRequest();
    patchBidRequest(bidReq);
    sendToSSP(bidReq);
  });
</script>
```

---

## API reference

### `resolveIdentitySignals(cookieOverride?)`

Reads browser cookies and returns a structured identity + consent object.

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `cookieOverride` | `string` (optional) | Raw cookie string. Pass for server-side rendering or unit testing. Omit to read `document.cookie` automatically. |

**Returns** `IdentitySignals`

```ts
interface IdentitySignals {
  // OpenRTB user object fields
  buyeruid:             string | null;   // primary buyer-side user ID
  eids:                 Eid[]  | null;   // OpenRTB 2.6 user.eids array

  // OpenRTB device identifier
  deviceId:             string | null;   // resolved device ID
  deviceIdSource:       string | null;   // cookie key it came from

  // OpenRTB regs object fields
  gdpr:                 0 | 1;           // GDPR applies flag
  tcfString:            string | null;   // IAB TCF v2 consent string
  usPrivacy:            string;          // IAB US Privacy string e.g. "1---"

  // OpenRTB device flags
  dnt:                  0 | 1;           // Do Not Track
  lmt:                  0 | 1;           // Limit Ad Tracking (mobile)

  // Consent detail
  consentGroups:        ConsentGroups | null;
  advertisingConsented: boolean | null;  // C0004 targeting category

  // Diagnostics
  identityTier:         1 | 2 | 3 | 4;
  tierLabel:            'synced_buyer' | 'universal_id' | 'first_party' | 'anonymous';
  eidSources:           string[];        // list of EID sources resolved
  cookieCount:          number;          // total cookies parsed
}
```

---

### `patchBidRequest(bidRequest, cookieOverride?)`

Patches an OpenRTB bid request object in place with all resolved signals. Returns the same object.

```js
const req = patchBidRequest(partialBidRequest);
// req.user.buyeruid, req.user.eids, req.regs.ext.gdpr, req.regs.ext.us_privacy,
// req.device.dnt, req.device.lmt, req.device.ext.deviceId are now populated
```

Fields added:

| Path | Value |
|------|-------|
| `user.buyeruid` | Resolved buyer user ID (skipped if null) |
| `user.eids` | EID array (skipped if empty) |
| `user.ext.consent` | TCF string (EU only, skipped if null) |
| `regs.ext.gdpr` | `0` or `1` |
| `regs.ext.us_privacy` | IAB US Privacy string |
| `device.dnt` | `0` or `1` |
| `device.lmt` | `0` or `1` |
| `device.ext.deviceId` | Device ID (skipped if null) |

Existing fields on the object are **preserved**. Only the above paths are written.

---

### `parseCookies(cookieString?)`

Utility: parses a raw `document.cookie`-style string into a plain object.

```js
import { parseCookies } from '@YOUR_GITHUB_ORG/openrtb-identity-resolver';

parseCookies('foo=bar; baz=qux');
// → { foo: 'bar', baz: 'qux' }
```

---

## Supported identity sources

### Tier 1 — Synced buyer IDs

| Cookie | Source | EID domain |
|--------|--------|-----------|
| `pbjs_unifiedID` | Prebid.js → The Trade Desk UID1 | `adserver.org` |
| `cto_bidid` | Criteo | `criteo.com` |
| `__gads` | Google Ad Manager | `google.com` |
| `_ixxId` / `IXUser` | Index Exchange | `indexexchange.com` |
| `uuid2` / `anj` | Xandr / AppNexus | `appnexus.com` |
| `rpx` / `khaos` | Magnite / Rubicon | `rubiconproject.com` |
| `KRTBCOOKIE_80` / `PUBMDCID` | PubMatic | `pubmatic.com` |

### Tier 2 — Universal / privacy-preserving IDs

| Cookie | Source | EID domain |
|--------|--------|-----------|
| `__uid2_advertising_token` | UID2 (The Trade Desk open standard) | `uidapi.com` |
| `_lr_env` / `liverampId` | LiveRamp RampID | `liveramp.com` |
| `id5id` / `pbjs_id5id` | ID5 | `id5-sync.com` |
| `_pubcid` / `pbjs_sharedID` | Prebid Shared ID | `pubcid.org` |
| `_cc_id` / `panoramaId` | Lotame Panorama | `lotame.com` |
| `TapAd_TS` / `TapAd_DID` | Tapad cross-device | `tapad.com` |
| `_mwb_id` | MediaWallah | `mediawallah.com` |
| `_di_id` | DeepIntent (healthcare) | `deepintent.com` |

### Tier 3 — First-party publisher IDs

| Cookie / Source | EID domain |
|----------------|-----------|
| `DEVICE_ID`, `device_id`, `deviceId` | Publisher domain |
| `AMCV_*` → MCMID | `adobedc.net` |
| `ab.storage.deviceId.*` (Amplitude) | — |
| `_scor_uid` | `scorecardresearch.com` |

---

## Consent signals

### GDPR detection (in priority order)

1. Explicit `gdpr=1` cookie
2. OneTrust `OptanonConsent` `geolocation=` field matching EU country codes
3. Presence of `euconsent-v2` or `euconsent` cookie
4. OneTrust `isGpcEnabled=1` flag
5. Default: `0` (GDPR does not apply)

### TCF consent string

Reads from `euconsent-v2`, `euconsent`, `OTAdditionalConsentString`, or `_tcf_consent`.

### US Privacy string

Reads from `usprivacy`, `us_privacy`, or infers from OneTrust C0004 rejection (`1YNY`). Defaults to `1---`.

### OneTrust consent groups

```js
signals.consentGroups
// {
//   performance:  true,   // C0002
//   functional:   true,   // C0003
//   advertising:  true,   // C0004
//   raw: { BG614: true, C0002: true, C0003: true, C0004: true }
// }
```

---

## Testing

```bash
# Run test suite
npm test

# With coverage report
npm run test:coverage

# Test with a specific cookie string
node -e "
const { resolveIdentitySignals } = await import('./src/index.js');
console.log(resolveIdentitySignals('DEVICE_ID=test-123; usprivacy=1---'));
"
```

The test suite uses `jest-environment-jsdom` to simulate a real browser environment. All public functions accept a `cookieOverride` parameter so you can test against any cookie string without touching `document.cookie`.

---

## Building

```bash
# Single build
npm run build

# Watch mode
npm run build:watch

# Check bundle sizes
npm run size
```

Outputs in `dist/`:

| File | Format | Use case |
|------|--------|---------|
| `index.umd.js` | UMD (minified) | `<script>` tag, CDN |
| `index.esm.js` | ESM (minified) | Webpack, Rollup, Vite |
| `index.cjs` | CJS (minified) | Node.js, Jest |

Target bundle size: **< 3 kB** each (verified by `size-limit`).

---

## Publishing a new version

1. Create and push a GitHub Release with a semver tag (e.g. `v1.1.0`)
2. The CI/CD workflow automatically:
   - Runs lint + tests on Node 18, 20, 22
   - Builds all three output formats
   - Verifies bundle sizes pass the 3 kB limit
   - Stamps the package version from the release tag
   - Publishes to GitHub Packages with npm provenance
   - Attaches `dist/` files to the GitHub Release

---

## CI/CD

```
push / PR → main
  └── ci job (Node 18, 20, 22 matrix)
        ├── npm ci
        ├── eslint
        ├── jest --coverage
        ├── rollup build
        └── size-limit check

GitHub Release (tag: v*)
  └── publish job
        ├── (all ci steps)
        ├── npm version <tag>
        ├── npm publish --provenance → GitHub Packages
        └── attach dist files to release
```

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Make changes in `src/index.js`
4. Add / update tests in `test/index.test.js`
5. Run `npm test && npm run build`
6. Open a pull request against `main`

Please keep the bundle size under 3 kB and maintain ≥90% test coverage.

---

## License

[MIT](LICENSE) © YOUR_GITHUB_ORG
