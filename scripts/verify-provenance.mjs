#!/usr/bin/env node
/**
 * verify-provenance.mjs — provenance & freshness guardrail (Slice 1).
 *
 * A structural balancing loop at the trust boundary: it fails the build when the
 * UI could present data more authoritatively than its provenance supports.
 * Extends the existing parity-check pattern (a Node script, no new test runner).
 *
 *   T9  no NaN / Infinity / non-finite number reaches a client-facing JSON value
 *   T1  every *known* headline metric declares a unit (or explicit dimensionless)
 *   FH  freshness honesty — no "Today / LIVE / Real-time" literals in the UI
 *       (demo/historical data must never read as live)
 *
 * Exits non-zero on any failure.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const ok = (msg) => console.log(`  ✓ ${msg}`);
const bad = (id, msg) => { failures.push(`[${id}] ${msg}`); console.log(`  ✗ [${id}] ${msg}`); };

// ── T9 — no non-finite numbers in the committed JSON ────────────────────────
function scanFinite(obj, path, hits) {
  if (typeof obj === 'number') {
    if (!Number.isFinite(obj)) hits.push(`${path} = ${obj}`);
  } else if (typeof obj === 'string') {
    if (obj === 'NaN' || obj === 'Infinity' || obj === '-Infinity') hits.push(`${path} = "${obj}"`);
  } else if (Array.isArray(obj)) {
    obj.forEach((v, i) => scanFinite(v, `${path}[${i}]`, hits));
  } else if (obj && typeof obj === 'object') {
    for (const k of Object.keys(obj)) scanFinite(obj[k], path ? `${path}.${k}` : k, hits);
  }
}
console.log('T9 — non-finite numbers');
for (const f of ['src/data/generated/realData.json', 'src/data/generated/enrichedData.json']) {
  const hits = [];
  try {
    scanFinite(JSON.parse(readFileSync(join(ROOT, f), 'utf8')), '', hits);
  } catch (e) {
    bad('T9', `${f}: ${e.message}`);
    continue;
  }
  if (hits.length) bad('T9', `${f}: ${hits.length} non-finite (${hits.slice(0, 3).join(', ')}${hits.length > 3 ? ', …' : ''})`);
  else ok(`${f} — all numbers finite`);
}

// ── T1 — known headline metrics must declare a unit ─────────────────────────
// Minimal registry for Slice 1. The full registry arrives with Slice 2; this
// proves the unit-discipline pattern and guards the most-exposed numbers now.
const KNOWN_METRICS = [
  { path: 'portfolioMeta.score', unit: null },                 // dimensionless index
  { path: 'portfolioMeta.savingsPotentialPercent', unit: '%' },
  { path: 'todaysConsumption.kWh', unit: 'kWh' },
  { path: 'todaysConsumption.omr', unit: 'OMR' },
];
const get = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
console.log('T1 — units on known headline metrics');
{
  let real;
  try { real = JSON.parse(readFileSync(join(ROOT, 'src/data/generated/realData.json'), 'utf8')); } catch { real = null; }
  for (const m of KNOWN_METRICS) {
    const v = real ? get(real, m.path) : undefined;
    if (typeof v !== 'number' || !Number.isFinite(v)) bad('T1', `${m.path}: missing/non-numeric`);
    else if (m.unit === undefined) bad('T1', `${m.path}: no unit declared (use null if dimensionless)`);
    else ok(`${m.path} → ${m.unit === null ? 'dimensionless' : m.unit}`);
  }
  console.log(`  · coverage: ${KNOWN_METRICS.length} metrics (Slice 1, partial). Most headline outputs are NOT yet unit-checked — full registry lands in Slice 2. A green T1 does not mean every metric has a verified unit.`);
}

// ── FH — freshness honesty: no live/today claims in demo/historical UI ───────
// "Live" is allowed only inside the provenance primitive (it renders it for the
// 'live' mode after a freshness check).
const FORBIDDEN = /Today['’]s|Today&apos;s|\bLIVE\b|\bReal[-\s]?time\b/;
const ALLOW_FILES = new Set(['Provenance.tsx']);
console.log('FH — freshness honesty (no Today/LIVE/Real-time in UI)');
{
  const dir = join(ROOT, 'src/components');
  let flagged = 0;
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.tsx') || ALLOW_FILES.has(file)) continue;
    const text = readFileSync(join(dir, file), 'utf8');
    text.split('\n').forEach((line, i) => {
      if (FORBIDDEN.test(line)) { flagged++; bad('FH', `${file}:${i + 1} → ${line.trim().slice(0, 80)}`); }
    });
  }
  if (!flagged) ok('no Today/LIVE/Real-time claims in client UI');
}

// ── P1 — provenance source is complete; PB — tariff basis disclosed & sourced ─
console.log('P1/PB — provenance propagation');
{
  let meta = null;
  try { meta = JSON.parse(readFileSync(join(ROOT, 'src/data/generated/enrichedData.json'), 'utf8')).meta; } catch { /* handled below */ }
  if (!meta) bad('P1', 'enrichedData.meta missing');
  else {
    if (meta.generatedAt == null) bad('P1', 'meta.generatedAt missing');
    if (meta.tariffConfigYear == null) bad('P1', 'meta.tariffConfigYear missing');
    if (!meta.dataRange?.from || !meta.dataRange?.to) bad('P1', 'meta.dataRange.from/to missing');
    if (!Array.isArray(meta.notes) || !meta.notes.length) bad('P1', 'meta.notes missing/empty');
    if (meta.generatedAt && meta.dataRange?.from && meta.tariffConfigYear != null) ok('meta carries period + generatedAt + tariffConfigYear + notes');
  }
  // Every page showing a CRT bill/cost must render the basis from `tariffBasis`
  // (the single sourced disclosure) rather than hand-authoring the tariff wording.
  for (const file of ['TariffPage.tsx', 'DashboardPage.tsx']) {
    const text = readFileSync(join(ROOT, 'src/components', file), 'utf8');
    if (!text.includes('tariffBasis')) bad('PB', `${file}: CRT cost shown without a sourced tariff basis (tariffBasis)`);
    else ok(`${file} → renders sourced tariffBasis`);
  }
}

// ── result ──────────────────────────────────────────────────────────────────
console.log('');
if (failures.length) {
  console.error(`PROVENANCE CHECK FAILED — ${failures.length} issue(s).`);
  process.exit(1);
}
console.log('PROVENANCE CHECK PASSED.');
