/* ═══════════════════════════════════════════════════════════════════
 * api/health.js — Public health endpoint for HMA cross-system probes
 * ═══════════════════════════════════════════════════════════════════
 * v7.140.14 — added per HMA Simple System Control Standard v1.0
 *
 * Purpose:
 *   Allow Kadwar (hma.engineer) and CRM (crm.hma.engineer) to probe
 *   Basma's liveness/version without authentication. Used by the
 *   "حالة ترابط أنظمة HMA" linkage card.
 *
 * Strict guarantees (read-only by construction):
 *   - GET only (POST/PUT/DELETE → 405)
 *   - No auth, no secrets, no PII, no tokens emitted
 *   - No Redis reads or writes
 *   - No business data exposure
 *   - No imports from data.js (keeps surface tiny)
 *   - CORS restricted to the 3 HMA origins (no wildcard)
 *
 * Response shape (success):
 *   { ok: true, service: "basma", status: "healthy",
 *     version: "<x.y.z>", timestamp: "<ISO>" }
 * ═══════════════════════════════════════════════════════════════════ */

// keep in sync with INTEGRATION_SERVICE_VERSION in api/data.js (version bump touches both)
var BASMA_HEALTH_VERSION = '7.140.16';

var HEALTH_ALLOWED_ORIGINS = [
  'https://hma.engineer',
  'https://b.hma.engineer',
  'https://crm.hma.engineer',
];

function applyHealthCors(req, res) {
  var requestOrigin = (req.headers && req.headers.origin) ? String(req.headers.origin) : '';
  var allowOrigin;
  if (HEALTH_ALLOWED_ORIGINS.indexOf(requestOrigin) >= 0) {
    allowOrigin = requestOrigin;
  } else {
    // safe default: do not echo unknown origin
    allowOrigin = 'https://b.hma.engineer';
  }
  res.setHeader('Access-Control-Allow-Origin', allowOrigin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
}

export default async function handler(req, res) {
  // CORS preflight
  applyHealthCors(req, res);
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // GET only
  if (req.method !== 'GET') {
    return res.status(405).json({
      ok: false,
      error: { code: 'METHOD_NOT_ALLOWED', message: 'health endpoint accepts GET only' },
    });
  }

  // Always-safe response — no secrets, no PII, no Redis access
  return res.status(200).json({
    ok: true,
    service: 'basma',
    status: 'healthy',
    version: BASMA_HEALTH_VERSION,
    timestamp: new Date().toISOString(),
  });
}
