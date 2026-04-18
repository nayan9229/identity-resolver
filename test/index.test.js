import { resolveIdentitySignals, patchBidRequest, parseCookies } from '../src/index.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const COOKIES = {
  loggedIn: [
    'DEVICE_ID=2cfc6bd4-23a8-456b-94e7-e2e2bdf30391',
    '_scor_uid=c6e9157f37bb4b1f9e252b9b4e6f7294',
    'pbjs_unifiedID=%7B%22TDID%22%3A%22d222bb05-ac06-422e-90e3-9244552fb1f9%22%2C%22TDID_LOOKUP%22%3A%22TRUE%22%2C%22TDID_CREATED_AT%22%3A%222026-03-15T10%3A20%3A12%22%7D',
    'cto_bidid=criteo-encoded-id-abc123',
    '__gads=ID=2d0d3b0c2a8fd283:T=1774950625:RT=1776248319:S=ALNI_test',
    'AMCV_TEST%40AdobeOrg=-1124106680%7CMCIDTS%7C20559%7CMCMID%7C87997031628825130754008965872496948199%7CMCAID%7CNONE',
    'OptanonConsent=isGpcEnabled%3D0%26groups%3DBG614%3A1%2CC0003%3A1%2CC0004%3A1%2CC0002%3A1%26geolocation%3DIN%3BGJ',
  ].join('; '),

  anonymous: [
    'DEVICE_ID=b709693a-4449-4757-a6ff-d7b29490c388',
    'device_id=e25ad6ab-ee61-424e-8176-0dda93ecb76f',
    '_scor_uid=7d94620fb3eb46bfb0063a6cec3a2768',
    'OptanonConsent=isGpcEnabled%3D0%26groups%3DBG614%3A1%2CC0003%3A1%2CC0004%3A1%2CC0002%3A1%26geolocation%3DIN%3BKA',
    'usprivacy=1YNY',
    // No AMCV_ here so buyeruid cleanly falls back to DEVICE_ID for this fixture
  ].join('; '),

  euUser: [
    'euconsent-v2=CPx8ygAPx8ygAAAAAAENABEAAP_AAH_AAAqIHNtf_X__bX9j-_59__t0eY1f9_7_v20zjheds-8Nyd_X_L4Xv2MyvB36pq4KuR4Eu3LBAQdlHOHcTUmw6okVrzPsbk2Mr7NKJ7PEmnMbO2dYGH9_n1_z-ZKY7______z_v-v___________AQ',
    'DEVICE_ID=eu-device-test-001',
    'OptanonConsent=isGpcEnabled%3D0%26groups%3DC0004%3A1%26geolocation%3DDE%3BBY',
  ].join('; '),

  uid2: [
    '__uid2_advertising_token=uid2-test-token-abc',
    'DEVICE_ID=uid2-device-001',
  ].join('; '),

  empty: '',
};

// ---------------------------------------------------------------------------
// parseCookies
// ---------------------------------------------------------------------------
describe('parseCookies', () => {
  test('parses key=value pairs', () => {
    const result = parseCookies('foo=bar; baz=qux');
    expect(result).toEqual({ foo: 'bar', baz: 'qux' });
  });

  test('handles empty string', () => {
    expect(parseCookies('')).toEqual({});
  });

  test('handles undefined (falls back to document.cookie)', () => {
    Object.defineProperty(document, 'cookie', {
      get: () => 'test_key=test_val',
      configurable: true,
    });
    const result = parseCookies(undefined);
    expect(result.test_key).toBe('test_val');
  });

  test('ignores pairs without = separator', () => {
    const result = parseCookies('valid=yes; noequalssign; also=ok');
    expect(result).toEqual({ valid: 'yes', also: 'ok' });
  });

  test('trims whitespace from keys and values', () => {
    const result = parseCookies('  foo  =  bar  ');
    expect(result.foo).toBe('bar');
  });

  test('handles values containing = (e.g. base64)', () => {
    const result = parseCookies('token=abc==; other=val');
    expect(result.token).toBe('abc==');
  });
});

// ---------------------------------------------------------------------------
// Tier 1 — synced buyer IDs (logged-in user)
// ---------------------------------------------------------------------------
describe('Tier 1 — synced buyer IDs', () => {
  let signals;
  beforeEach(() => { signals = resolveIdentitySignals(COOKIES.loggedIn); });

  test('identityTier is 1', () => expect(signals.identityTier).toBe(1));
  test('tierLabel is synced_buyer', () => expect(signals.tierLabel).toBe('synced_buyer'));

  test('buyeruid is TTD TDID from pbjs_unifiedID', () => {
    expect(signals.buyeruid).toBe('d222bb05-ac06-422e-90e3-9244552fb1f9');
  });

  test('eids contains adserver.org (TTD)', () => {
    expect(signals.eidSources).toContain('adserver.org');
  });

  test('eids contains criteo.com', () => {
    expect(signals.eidSources).toContain('criteo.com');
  });

  test('eids contains google.com from __gads', () => {
    expect(signals.eidSources).toContain('google.com');
  });

  test('eids adserver.org entry has correct uid', () => {
    const ttd = signals.eids.find((e) => e.source === 'adserver.org');
    expect(ttd.uids[0].id).toBe('d222bb05-ac06-422e-90e3-9244552fb1f9');
    expect(ttd.uids[0].atype).toBe(1);
  });

  test('gdpr is 0 for IN geolocation', () => expect(signals.gdpr).toBe(0));
  test('dnt is 0', () => expect(signals.dnt).toBe(0));
  test('lmt is 0', () => expect(signals.lmt).toBe(0));
  test('cookieCount matches fixture', () => expect(signals.cookieCount).toBeGreaterThan(0));
});

// ---------------------------------------------------------------------------
// Tier 3 — first-party IDs (anonymous user)
// ---------------------------------------------------------------------------
describe('Tier 3 — first-party IDs (anonymous user)', () => {
  let signals;
  beforeEach(() => { signals = resolveIdentitySignals(COOKIES.anonymous); });

  test('identityTier is 3', () => expect(signals.identityTier).toBe(3));
  test('tierLabel is first_party', () => expect(signals.tierLabel).toBe('first_party'));

  test('buyeruid falls back to DEVICE_ID', () => {
    expect(signals.buyeruid).toBe('b709693a-4449-4757-a6ff-d7b29490c388');
  });

  test('deviceId matches DEVICE_ID cookie', () => {
    expect(signals.deviceId).toBe('b709693a-4449-4757-a6ff-d7b29490c388');
    expect(signals.deviceIdSource).toBe('DEVICE_ID');
  });

  test('usPrivacy reads explicit usprivacy cookie', () => {
    expect(signals.usPrivacy).toBe('1YNY');
  });

  test('gdpr is 0 for IN geolocation', () => expect(signals.gdpr).toBe(0));

  test('advertisingConsented is true (C0004:1)', () => {
    expect(signals.advertisingConsented).toBe(true);
  });

  test('consentGroups parses all OneTrust categories', () => {
    expect(signals.consentGroups.performance).toBe(true);
    expect(signals.consentGroups.functional).toBe(true);
    expect(signals.consentGroups.advertising).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tier 4 — anonymous (no cookies)
// ---------------------------------------------------------------------------
describe('Tier 4 — anonymous (empty cookies)', () => {
  let signals;
  beforeEach(() => { signals = resolveIdentitySignals(COOKIES.empty); });

  test('identityTier is 4', () => expect(signals.identityTier).toBe(4));
  test('tierLabel is anonymous', () => expect(signals.tierLabel).toBe('anonymous'));
  test('buyeruid is null', () => expect(signals.buyeruid).toBeNull());
  test('eids is null', () => expect(signals.eids).toBeNull());
  test('deviceId is null', () => expect(signals.deviceId).toBeNull());
  test('gdpr defaults to 0', () => expect(signals.gdpr).toBe(0));
  test('usPrivacy defaults to 1---', () => expect(signals.usPrivacy).toBe('1---'));
  test('dnt defaults to 0', () => expect(signals.dnt).toBe(0));
  test('lmt defaults to 0', () => expect(signals.lmt).toBe(0));
});

// ---------------------------------------------------------------------------
// EU user — GDPR detection
// ---------------------------------------------------------------------------
describe('EU user — GDPR detection', () => {
  let signals;
  beforeEach(() => { signals = resolveIdentitySignals(COOKIES.euUser); });

  test('gdpr is 1 for DE geolocation', () => expect(signals.gdpr).toBe(1));

  test('tcfString is populated from euconsent-v2', () => {
    expect(signals.tcfString).toBeTruthy();
    expect(signals.tcfString.startsWith('C')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tier 2 — UID2 universal ID
// ---------------------------------------------------------------------------
describe('Tier 2 — UID2 universal ID', () => {
  let signals;
  beforeEach(() => { signals = resolveIdentitySignals(COOKIES.uid2); });

  test('identityTier is 2', () => expect(signals.identityTier).toBe(2));
  test('tierLabel is universal_id', () => expect(signals.tierLabel).toBe('universal_id'));
  test('buyeruid is uid2 token', () => expect(signals.buyeruid).toBe('uid2-test-token-abc'));
  test('eids contains uidapi.com', () => expect(signals.eidSources).toContain('uidapi.com'));

  test('uidapi.com eid has correct rtiPartner ext', () => {
    const eid = signals.eids.find((e) => e.source === 'uidapi.com');
    expect(eid.uids[0].ext.rtiPartner).toBe('UID2');
  });
});

// ---------------------------------------------------------------------------
// Adobe ECID fallback
// ---------------------------------------------------------------------------
describe('Adobe ECID as deviceId fallback', () => {
  const amcvCookies = 'AMCV_ABC123%40AdobeOrg=-1124106680%7CMCMID%7C99887766554433221100%7CMCAID%7CNONE';

  test('extracts MCMID from AMCV_ cookie', () => {
    const s = resolveIdentitySignals(amcvCookies);
    expect(s.deviceId).toBe('99887766554433221100');
    expect(s.deviceIdSource).toBe('adobe_ecid');
  });

  test('includes adobedc.net in eids', () => {
    const s = resolveIdentitySignals(amcvCookies);
    expect(s.eidSources).toContain('adobedc.net');
  });
});

// ---------------------------------------------------------------------------
// patchBidRequest
// ---------------------------------------------------------------------------
describe('patchBidRequest', () => {
  test('patches user.buyeruid and user.eids', () => {
    const req = { imp: [] };
    patchBidRequest(req, COOKIES.loggedIn);
    expect(req.user.buyeruid).toBe('d222bb05-ac06-422e-90e3-9244552fb1f9');
    expect(Array.isArray(req.user.eids)).toBe(true);
  });

  test('patches regs.ext.gdpr and us_privacy', () => {
    const req = {};
    patchBidRequest(req, COOKIES.anonymous);
    expect(req.regs.ext.gdpr).toBe(0);
    expect(req.regs.ext.us_privacy).toBe('1YNY');
  });

  test('patches device.dnt and device.lmt', () => {
    const req = {};
    patchBidRequest(req, COOKIES.anonymous);
    expect(req.device.dnt).toBe(0);
    expect(req.device.lmt).toBe(0);
  });

  test('patches user.ext.consent for EU user', () => {
    const req = {};
    patchBidRequest(req, COOKIES.euUser);
    expect(req.regs.ext.gdpr).toBe(1);
    expect(req.user.ext.consent).toBeTruthy();
  });

  test('does not set buyeruid when no cookies', () => {
    const req = {};
    patchBidRequest(req, COOKIES.empty);
    expect(req.user.buyeruid).toBeUndefined();
    expect(req.user.eids).toBeUndefined();
  });

  test('returns the mutated bid request object', () => {
    const req = { imp: [{ id: '1' }] };
    const result = patchBidRequest(req, COOKIES.anonymous);
    expect(result).toBe(req);
  });

  test('preserves existing bid request fields', () => {
    const req = { id: 'br-001', imp: [{ id: '1' }], site: { domain: 'test.com' } };
    patchBidRequest(req, COOKIES.anonymous);
    expect(req.id).toBe('br-001');
    expect(req.site.domain).toBe('test.com');
  });

  test('merges device.ext without clobbering existing ext', () => {
    const req = { device: { ua: 'Mozilla/5.0', ext: { existingKey: 'keep' } } };
    patchBidRequest(req, COOKIES.anonymous);
    expect(req.device.ext.existingKey).toBe('keep');
    expect(req.device.ext.deviceId).toBe('b709693a-4449-4757-a6ff-d7b29490c388');
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------
describe('Edge cases', () => {
  test('handles malformed percent-encoding in cookie values gracefully', () => {
    expect(() => resolveIdentitySignals('bad=%GG')).not.toThrow();
  });

  test('handles malformed JSON in pbjs_unifiedID gracefully', () => {
    expect(() => resolveIdentitySignals('pbjs_unifiedID={not-valid-json')).not.toThrow();
  });

  test('does not return duplicate eids for same source', () => {
    const cookies = [
      'id5id=%7B%22universal_uid%22%3A%22id5-abc%22%7D',
      'pbjs_id5id=%7B%22uid%22%3A%22id5-xyz%22%7D',
    ].join('; ');
    const s = resolveIdentitySignals(cookies);
    const id5eids = s.eids ? s.eids.filter((e) => e.source === 'id5-sync.com') : [];
    expect(id5eids.length).toBe(1);
  });

  test('usPrivacy infers 1YNY when C0004 is rejected in OneTrust', () => {
    const cookies = 'OptanonConsent=groups%3DC0004%3A0';
    const s = resolveIdentitySignals(cookies);
    expect(s.usPrivacy).toBe('1YNY');
  });

  test('eids array is null not empty array when no IDs found', () => {
    const s = resolveIdentitySignals(COOKIES.empty);
    expect(s.eids).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Amplitude device ID fallback
// ---------------------------------------------------------------------------
describe('Amplitude device ID fallback', () => {
  test('extracts device ID from ab.storage.deviceId.* cookie', () => {
    const val = encodeURIComponent(JSON.stringify({ g: 'amp-device-abc123', e: undefined }));
    const s = resolveIdentitySignals(`ab.storage.deviceId.inst-xyz=${val}`);
    expect(s.deviceId).toBe('amp-device-abc123');
    expect(s.deviceIdSource).toBe('amplitude_device');
  });

  test('returns null deviceId when amplitude cookie value has no g field', () => {
    const val = encodeURIComponent(JSON.stringify({ other: 'val' }));
    const s = resolveIdentitySignals(`ab.storage.deviceId.inst-xyz=${val}`);
    expect(s.deviceId).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// LiveRamp RampID
// ---------------------------------------------------------------------------
describe('LiveRamp RampID — Tier 2', () => {
  test('resolves liveramp.com eid from _lr_env cookie', () => {
    const s = resolveIdentitySignals('_lr_env=rampid-token-xyz');
    expect(s.eidSources).toContain('liveramp.com');
    expect(s.identityTier).toBe(2);
    expect(s.buyeruid).toBe('rampid-token-xyz');
  });

  test('resolves liveramp.com eid from liverampId cookie', () => {
    const s = resolveIdentitySignals('liverampId=rampid-via-named-cookie');
    expect(s.eidSources).toContain('liveramp.com');
    expect(s.buyeruid).toBe('rampid-via-named-cookie');
  });
});

// ---------------------------------------------------------------------------
// ID5
// ---------------------------------------------------------------------------
describe('ID5 universal ID — Tier 2', () => {
  test('resolves id5-sync.com eid from id5id cookie', () => {
    const val = JSON.stringify({ universal_uid: 'id5-uid-abc', link_type: 2 });
    const s = resolveIdentitySignals(`id5id=${encodeURIComponent(val)}`);
    expect(s.eidSources).toContain('id5-sync.com');
    expect(s.identityTier).toBe(2);
    const eid = s.eids.find((e) => e.source === 'id5-sync.com');
    expect(eid.uids[0].ext.linkType).toBe(2);
  });

  test('resolves id5-sync.com from pbjs_id5id when id5id absent', () => {
    const val = JSON.stringify({ uid: 'pbjs-id5-uid' });
    const s = resolveIdentitySignals(`pbjs_id5id=${encodeURIComponent(val)}`);
    expect(s.eidSources).toContain('id5-sync.com');
    expect(s.buyeruid).toBe('pbjs-id5-uid');
  });

  test('id5id takes priority over pbjs_id5id — no duplicate source', () => {
    const id5val  = JSON.stringify({ universal_uid: 'id5-primary' });
    const pbjsval = JSON.stringify({ uid: 'pbjs-secondary' });
    const s = resolveIdentitySignals(
      `id5id=${encodeURIComponent(id5val)}; pbjs_id5id=${encodeURIComponent(pbjsval)}`
    );
    const id5eids = s.eids.filter((e) => e.source === 'id5-sync.com');
    expect(id5eids).toHaveLength(1);
    expect(id5eids[0].uids[0].id).toBe('id5-primary');
  });
});

// ---------------------------------------------------------------------------
// pubcid (Prebid Shared ID)
// ---------------------------------------------------------------------------
describe('pubcid — Tier 2', () => {
  test('resolves pubcid.org eid from _pubcid cookie', () => {
    const s = resolveIdentitySignals('_pubcid=pubcid-value-abc');
    expect(s.eidSources).toContain('pubcid.org');
  });

  test('resolves pubcid.org eid from pbjs_sharedID cookie', () => {
    const val = JSON.stringify({ id: 'shared-id-xyz' });
    const s = resolveIdentitySignals(`pbjs_sharedID=${encodeURIComponent(val)}`);
    expect(s.eidSources).toContain('pubcid.org');
    expect(s.buyeruid).toBe('shared-id-xyz');
  });
});

// ---------------------------------------------------------------------------
// Lotame + Tapad
// ---------------------------------------------------------------------------
describe('Lotame and Tapad — Tier 2', () => {
  test('resolves lotame.com eid from _cc_id cookie', () => {
    const s = resolveIdentitySignals('_cc_id=lotame-cc-id-abc');
    expect(s.eidSources).toContain('lotame.com');
  });

  test('resolves tapad.com eid from TapAd_DID cookie', () => {
    const s = resolveIdentitySignals('TapAd_DID=tapad-device-id-xyz');
    expect(s.eidSources).toContain('tapad.com');
  });
});
