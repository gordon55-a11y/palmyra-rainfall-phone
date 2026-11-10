/** One day at a time. A newer savedAt wins. Readings are not added. */

export function round1(value) {
  return Math.floor(Number(value) * 10 + 0.5) / 10;
}

export function parseSavedAt(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

export function isNewer(candidate, current) {
  const left = parseSavedAt(candidate && candidate.savedAt);
  const right = parseSavedAt(current && current.savedAt);
  if (left == null) return false;
  if (right == null) return true;
  return left > right;
}

export function mergeDays(existing, incoming) {
  const merged = { ...(existing || {}) };
  for (const [iso, rec] of Object.entries(incoming || {})) {
    if (!merged[iso] || isNewer(rec, merged[iso])) merged[iso] = { ...rec };
  }
  return merged;
}

export function emptyLog(updatedAt) {
  return {
    app: "palmyra-rainfall",
    version: 1,
    station: "Vryburg Palmyra",
    updatedAt: updatedAt || "",
    days: {},
  };
}

export function publicLog(days, updatedAt) {
  const sorted = {};
  for (const iso of Object.keys(days || {}).sort()) sorted[iso] = days[iso];
  return emptyLog(updatedAt);
}

export function withDays(days, updatedAt) {
  const log = emptyLog(updatedAt);
  log.days = {};
  for (const iso of Object.keys(days || {}).sort()) log.days[iso] = days[iso];
  return log;
}

/** Blank is not a reading. Zero is a dry day. */
export function readingFromText(raw, { dry = false } = {}) {
  if (dry) return { ok: true, mm: 0 };
  if (raw == null) return { ok: false, error: "That reading is blank. Type the millimetres, or tap Save as dry." };
  const text = String(raw).trim().replace(",", ".");
  if (text === "") return { ok: false, error: "That reading is blank. Type the millimetres, or tap Save as dry." };
  if (!/^\d+(\.\d+)?$/.test(text)) {
    return { ok: false, error: "Enter millimetres as a number, or tap Save as dry." };
  }
  const mm = round1(text);
  if (!Number.isFinite(mm) || mm < 0) {
    return { ok: false, error: "Enter millimetres as a number, or tap Save as dry." };
  }
  return { ok: true, mm };
}

/** Dry days stay in the file. The month list shows rain only. */
export function rainDaysInMonth(days, monthKey) {
  return Object.keys(days || {})
    .filter((iso) => iso.startsWith(`${monthKey}-`) && Number(days[iso]?.mm) > 0)
    .sort();
}

export function canonicalDays(days) {
  const clean = {};
  for (const iso of Object.keys(days || {}).sort()) {
    const rec = days[iso] || {};
    clean[iso] = {
      mm: rec.mm,
      note: rec.note || "",
      source: rec.source,
      savedAt: rec.savedAt,
    };
  }
  return JSON.stringify(clean);
}
