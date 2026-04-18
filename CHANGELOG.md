# Changelog

All notable changes to this project will be documented in this file.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2026-04-17

### Added
- Initial release
- `resolveIdentitySignals(cookieOverride?)` — resolves buyeruid, eids, deviceId, gdpr, usPrivacy, dnt, lmt from browser cookies
- `patchBidRequest(bidRequest, cookieOverride?)` — patches an OpenRTB bid request object in place
- `parseCookies(cookieString?)` — utility cookie parser
- Four-tier identity fallback strategy (synced buyer → universal ID → first-party → anonymous)
- Support for: TTD UID1/UID2, Criteo, Google, Index Exchange, Xandr, Rubicon, PubMatic, LiveRamp, ID5, pubcid, Lotame, Tapad, MediaWallah, DeepIntent, Adobe ECID, Amplitude
- OneTrust consent group parsing (C0002/C0003/C0004)
- IAB TCF v2 string extraction
- IAB US Privacy string resolution
- GDPR detection via OneTrust geolocation + euconsent-v2
- GPC (Global Privacy Control) detection
- UMD / ESM / CJS build targets via Rollup
- Full Jest test suite with jsdom environment
- GitHub Actions CI/CD — lint, test, build, publish to GitHub Packages
