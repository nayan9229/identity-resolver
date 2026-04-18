/**
 * @module identity-resolver
 * @description Reads browser cookies and assembles OpenRTB 2.5/2.6
 *   user.buyeruid, user.eids[], device identity, and consent signals.
 *
 * Identity tier strategy (95% fill):
 *   Tier 1 — Synced buyer IDs  (buyeruid + eids)   highest eCPM
 *   Tier 2 — Universal IDs     (UID2, RampID, ID5)  cookieless
 *   Tier 3 — First-party IDs   (publisher device)   contextual+freq
 *   Tier 4 — Anonymous         (null)                contextual only
 */

// ---------------------------------------------------------------------------
// Cookie parser
// ---------------------------------------------------------------------------
export function parseCookies(cookieString) {
  const jar = {};
  const raw =
    cookieString !== undefined
      ? cookieString
      : typeof document !== 'undefined'
      ? document.cookie
      : '';
  if (!raw) return jar;
  raw.split(';').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx < 0) return;
    const key = pair.slice(0, idx).trim();
    const val = pair.slice(idx + 1).trim();
    if (key) jar[key] = val;
  });
  return jar;
}

// ---------------------------------------------------------------------------
// Internal utilities
// ---------------------------------------------------------------------------
function safeDecode(str) {
  if (!str) return str;
  try { return decodeURIComponent(str); } catch { return str; }
}

function safeJSON(str) {
  if (!str) return null;
  try { return JSON.parse(str); } catch { return null; }
}

function makeEid(source, id, atype, ext) {
  if (!source || !id) return null;
  const uid = { id: String(id), atype: atype || 3 };
  if (ext) uid.ext = ext;
  return { source, uids: [uid] };
}

// ---------------------------------------------------------------------------
// GDPR / TCF
// ---------------------------------------------------------------------------
const EU_CC = new Set([
  'AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU',
  'IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES',
  'SE','GB','IS','LI','NO','CH',
]);

function resolveGdpr(c) {
  if (c.gdpr !== undefined) return parseInt(c.gdpr, 10) === 1 ? 1 : 0;
  const oc = safeDecode(c.OptanonConsent || '');
  if (oc) {
    const m = oc.match(/geolocation=([A-Z]{2})/);
    if (m && EU_CC.has(m[1])) return 1;
    if (oc.includes('isGpcEnabled=1')) return 1;
  }
  if (c['euconsent-v2'] || c.euconsent) return 1;
  return 0;
}

function resolveTcfString(c) {
  return (
    (c['euconsent-v2'] && safeDecode(c['euconsent-v2'])) ||
    (c.euconsent && safeDecode(c.euconsent)) ||
    c.OTAdditionalConsentString ||
    (c._tcf_consent && safeDecode(c._tcf_consent)) ||
    null
  );
}

function resolveUsPrivacy(c) {
  if (c.usprivacy)  return c.usprivacy;
  if (c.us_privacy) return c.us_privacy;
  const oc = safeDecode(c.OptanonConsent || '');
  if (oc) {
    const m = oc.match(/C0004[^,&]*/);
    if (m && m[0].includes(':0')) return '1YNY';
  }
  return '1---';
}

// ---------------------------------------------------------------------------
// Device flags
// ---------------------------------------------------------------------------
function resolveDnt(c) {
  if (typeof navigator !== 'undefined' && navigator.doNotTrack === '1') return 1;
  if (c.dnt === '1') return 1;
  return 0;
}

function resolveLmt(c) {
  if (c.lmt !== undefined) return parseInt(c.lmt, 10) ? 1 : 0;
  if (c.att_status !== undefined) return c.att_status === '3' ? 0 : 1;
  return 0;
}

// ---------------------------------------------------------------------------
// Device ID
// ---------------------------------------------------------------------------
const DEVICE_KEYS = [
  'DEVICE_ID','device_id','deviceId',
  'pub_device_id','publisher_device_id','_device_id',
  '__adobeECID','amp_device_id',
];

function resolveDeviceId(c) {
  for (const k of DEVICE_KEYS) {
    if (c[k]) return { id: c[k], source: k };
  }
  const amcv = Object.keys(c).find((k) => k.startsWith('AMCV_'));
  if (amcv) {
    const m = safeDecode(c[amcv]).match(/MCMID\|([^|]+)/);
    if (m) return { id: m[1], source: 'adobe_ecid' };
  }
  const amp = Object.keys(c).find((k) => k.startsWith('ab.storage.deviceId.'));
  if (amp) {
    const p = safeJSON(safeDecode(c[amp]));
    if (p && p.g) return { id: p.g, source: 'amplitude_device' };
  }
  return null;
}

// ---------------------------------------------------------------------------
// EID resolution (ordered: synced → universal → first-party)
// ---------------------------------------------------------------------------
const SYNCED_SOURCES = new Set([
  'adserver.org','criteo.com','google.com','appnexus.com',
  'rubiconproject.com','pubmatic.com','indexexchange.com',
]);
const UNIVERSAL_SOURCES = new Set(['uidapi.com','liveramp.com','id5-sync.com']);

function resolveEids(c) {
  const eids = [];
  let buyeruid = null;

  function push(eid) {
    if (eid) eids.push(eid);
  }
  function claim(id) {
    if (!buyeruid && id) buyeruid = id;
  }

  // — Tier 1: Synced buyer IDs —
  const pbjsUid = safeJSON(safeDecode(c.pbjs_unifiedID || ''));
  if (pbjsUid?.TDID) { push(makeEid('adserver.org', pbjsUid.TDID, 1)); claim(pbjsUid.TDID); }

  if (c.cto_bidid) { const d = safeDecode(c.cto_bidid); push(makeEid('criteo.com', d, 1)); claim(d); }

  if (c.__gads) { const m = c.__gads.match(/ID=([^:]+)/); if (m) push(makeEid('google.com', m[1], 1)); }

  const ix = c._ixxId || c.IXUser;
  if (ix) push(makeEid('indexexchange.com', ix, 1));

  const xandr = c.uuid2 || c.anj;
  if (xandr) push(makeEid('appnexus.com', xandr, 1));

  const rubicon = c.rpx || c.khaos;
  if (rubicon) push(makeEid('rubiconproject.com', rubicon, 1));

  const pm = c.KRTBCOOKIE_80 || c.PUBMDCID;
  if (pm) push(makeEid('pubmatic.com', pm, 1));

  // — Tier 2: Universal / privacy-preserving IDs —
  const uid2 = c.__uid2_advertising_token || c.UID2 || c.uid2_token;
  if (uid2) { push(makeEid('uidapi.com', uid2, 3, { rtiPartner: 'UID2' })); claim(uid2); }

  const ramp = c._lr_env || c.liverampId;
  if (ramp) { push(makeEid('liveramp.com', ramp, 3)); claim(ramp); }

  const id5raw = safeJSON(c.id5id || '');
  if (id5raw?.universal_uid) {
    push(makeEid('id5-sync.com', id5raw.universal_uid, 3, { linkType: id5raw.link_type || 0 }));
    claim(id5raw.universal_uid);
  }

  const pbjsId5 = safeJSON(safeDecode(c.pbjs_id5id || ''));
  if (pbjsId5?.uid && !eids.find((e) => e.source === 'id5-sync.com')) {
    push(makeEid('id5-sync.com', pbjsId5.uid, 3));
  }

  const pubcid =
    c._pubcid || c.pubcid || safeJSON(safeDecode(c.pbjs_sharedID || ''))?.id;
  if (pubcid) { push(makeEid('pubcid.org', pubcid, 1)); claim(pubcid); }

  const lotame = c._cc_id || c.panoramaId;
  if (lotame) push(makeEid('lotame.com', lotame, 3));

  const tapad = c.TapAd_TS || c.TapAd_DID;
  if (tapad) push(makeEid('tapad.com', tapad, 3));

  if (c._mwb_id) push(makeEid('mediawallah.com', c._mwb_id, 3));
  if (c._di_id)  push(makeEid('deepintent.com',  c._di_id,  3));

  // — Tier 3: First-party publisher IDs —
  const amcv = Object.keys(c).find((k) => k.startsWith('AMCV_'));
  if (amcv) {
    const m = safeDecode(c[amcv]).match(/MCMID\|([^|]+)/);
    if (m) { push(makeEid('adobedc.net', m[1], 1, { type: 'ecid' })); claim(m[1]); }
  }

  const fp = c.DEVICE_ID || c.device_id;
  if (fp) { push(makeEid('iheart.com', fp, 1, { type: 'first_party' })); claim(fp); }

  if (c._scor_uid) push(makeEid('scorecardresearch.com', c._scor_uid, 1));

  return { eids: eids.filter(Boolean), buyeruid };
}

// ---------------------------------------------------------------------------
// OneTrust consent groups
// ---------------------------------------------------------------------------
function resolveConsentGroups(c) {
  const oc = safeDecode(c.OptanonConsent || '');
  if (!oc) return null;
  const m = oc.match(/groups=([^&]+)/);
  if (!m) return null;
  const groups = {};
  safeDecode(m[1]).split(',').forEach((pair) => {
    const ci = pair.indexOf(':');
    if (ci < 0) return;
    const k = pair.slice(0, ci).trim();
    if (k) groups[k] = pair.slice(ci + 1).trim() === '1';
  });
  return {
    performance:  groups.C0002 ?? null,
    functional:   groups.C0003 ?? null,
    advertising:  groups.C0004 ?? null,
    raw: groups,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Resolve all OpenRTB identity and consent signals from browser cookies.
 *
 * @param {string} [cookieOverride] Raw cookie string (for testing or SSR).
 *   Omit to read `document.cookie` automatically in the browser.
 * @returns {IdentitySignals}
 *
 * @example
 * const signals = resolveIdentitySignals();
 * // { buyeruid, eids, deviceId, gdpr, usPrivacy, dnt, lmt, ... }
 */
export function resolveIdentitySignals(cookieOverride) {
  const c = parseCookies(cookieOverride);

  const gdpr          = resolveGdpr(c);
  const tcfString     = resolveTcfString(c);
  const usPrivacy     = resolveUsPrivacy(c);
  const dnt           = resolveDnt(c);
  const lmt           = resolveLmt(c);
  const deviceResult  = resolveDeviceId(c);
  const { eids, buyeruid } = resolveEids(c);
  const consentGroups = resolveConsentGroups(c);

  const hasSynced    = eids.some((e) => SYNCED_SOURCES.has(e.source));
  const hasUniversal = eids.some((e) => UNIVERSAL_SOURCES.has(e.source));
  const tier = !buyeruid ? 4 : hasSynced ? 1 : hasUniversal ? 2 : 3;

  return {
    // OpenRTB user object
    buyeruid:             buyeruid || null,
    eids:                 eids.length ? eids : null,
    // OpenRTB device
    deviceId:             deviceResult?.id     ?? null,
    deviceIdSource:       deviceResult?.source ?? null,
    // OpenRTB regs / device flags
    gdpr,
    tcfString,
    usPrivacy,
    dnt,
    lmt,
    // Consent detail
    consentGroups,
    advertisingConsented: consentGroups?.advertising ?? null,
    // Diagnostics
    identityTier: tier,
    tierLabel:    ['', 'synced_buyer', 'universal_id', 'first_party', 'anonymous'][tier],
    eidSources:   eids.map((e) => e.source),
    cookieCount:  Object.keys(c).length,
  };
}

/**
 * Patch an OpenRTB bid request object with resolved identity signals.
 * Mutates and returns the object.
 *
 * @param {object} bidRequest  Partial OpenRTB bid request.
 * @param {string} [cookieOverride]
 * @returns {object}
 *
 * @example
 * const req = buildBidRequest();
 * patchBidRequest(req); // adds user.buyeruid, user.eids, regs, device flags
 */
export function patchBidRequest(bidRequest, cookieOverride) {
  const s = resolveIdentitySignals(cookieOverride);

  bidRequest.user ??= {};
  if (s.buyeruid) bidRequest.user.buyeruid = s.buyeruid;
  if (s.eids)     bidRequest.user.eids     = s.eids;
  if (s.tcfString) {
    bidRequest.user.ext ??= {};
    bidRequest.user.ext.consent = s.tcfString;
  }

  bidRequest.regs ??= {};
  bidRequest.regs.ext ??= {};
  bidRequest.regs.ext.gdpr       = s.gdpr;
  bidRequest.regs.ext.us_privacy = s.usPrivacy;

  bidRequest.device ??= {};
  bidRequest.device.dnt = s.dnt;
  bidRequest.device.lmt = s.lmt;
  if (s.deviceId) {
    bidRequest.device.ext ??= {};
    bidRequest.device.ext.deviceId = s.deviceId;
  }

  return bidRequest;
}
