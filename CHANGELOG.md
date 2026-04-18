# Changelog

All notable changes to this project will be documented in this file.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2026-04-17

### Added
- Initial release
- `resolveIdentitySignals(cookieOverride?)` — resolves buyeruid, eids, deviceId,
  gdpr, usPrivacy, dnt, lmt from browser cookies
- `patchBidRequest(bidRequest, cookieOverride?)` — patches an OpenRTB bid request in place
- `parseCookies(cookieString?)` — utility cookie parser
- Four-tier identity fallback: synced buyer → universal ID → first-party → anonymous
- 15+ identity sources: TTD UID1/UID2, Criteo, Google, Index Exchange, Xandr/AppNexus,
  Rubicon/Magnite, PubMatic, LiveRamp RampID, ID5, pubcid, Lotame, Tapad, MediaWallah,
  DeepIntent, Adobe ECID, Amplitude
- OneTrust consent group parsing (C0002/C0003/C0004)
- IAB TCF v2 string extraction from euconsent-v2 and CMP cookies
- IAB US Privacy string resolution with OneTrust inference fallback
- GDPR detection via OneTrust geolocation, euconsent-v2, and GPC flag
- AMCV_ cookie percent-encoding handled (safeDecode before MCMID extraction)
- UMD / ESM / CJS build targets via Rollup + Terser (~2.2 kB gzip each)
- 56-test Jest suite with jsdom environment
- GitHub Actions CI/CD: lint → test (Node 18/20/22 matrix) → build → size-limit → publish
- pnpm as package manager (v9) with frozen-lockfile installs in CI
- `scripts/test.mjs` wrapper for portable ESM Jest invocation across Node versions
- Dependabot for automated weekly dependency updates
