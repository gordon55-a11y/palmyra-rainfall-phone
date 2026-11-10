/** Past Rain from the rainfall book plus the rain log. The book is not shipped in this page. */

import { round1 } from "./merge.mjs";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function logMm(rec) {
  if (!rec || typeof rec !== "object") return null;
  const mm = rec.mm;
  if (typeof mm === "boolean" || typeof mm !== "number") return null;
  return mm;
}

export function bookIndex(raw) {
  const months = {};
  for (const row of (raw && raw.months) || []) {
    const mm = row[1];
    const flag = row[2] || "";
    months[row[0]] = { mm: mm == null ? null : Number(mm), flag };
  }
  const rainByMonth = {};
  for (const row of (raw && raw.rain) || []) {
    const iso = row[0];
    const key = iso.slice(0, 7);
    if (!rainByMonth[key]) rainByMonth[key] = {};
    rainByMonth[key][iso] = Number(row[1]);
  }
  const farm = new Set(((raw && raw.station && raw.station.farmFilled) || []));
  return { months, rainByMonth, farm };
}

function loggedInMonth(logDays, key) {
  const logged = {};
  for (const [iso, rec] of Object.entries(logDays || {})) {
    if (iso.startsWith(`${key}-`)) {
      const mm = logMm(rec);
      if (mm != null) logged[iso] = mm;
    }
  }
  return logged;
}

function farmOnly(book, key) {
  const info = book.months[key];
  if (!info || info.mm == null) return false;
  if (info.flag !== "farm" && !book.farm.has(key)) return false;
  return !book.rainByMonth[key];
}

function mergedMonth(book, logDays, key) {
  const info = book.months[key];
  const bookDays = { ...(book.rainByMonth[key] || {}) };
  const logged = loggedInMonth(logDays, key);
  if (farmOnly(book, key) && !Object.keys(logged).length) return { merged: null, total: Number(info.mm), known: true };
  if (!Object.keys(bookDays).length && !Object.keys(logged).length) {
    if (info && info.mm != null && info.flag !== "pending" && info.flag !== "missing") {
      return { merged: {}, total: Number(info.mm), known: true };
    }
    return { merged: {}, total: null, known: false };
  }
  const merged = { ...bookDays, ...logged };
  const total = Object.values(merged).reduce((sum, mm) => sum + mm, 0);
  return { merged, total, known: true };
}

function sumThroughDay(merged, dayLimit) {
  let total = 0;
  for (const [iso, mm] of Object.entries(merged || {})) {
    if (Number(iso.slice(8, 10)) <= dayLimit) total += mm;
  }
  return total;
}

function seasonYearFor(startYear, month) {
  return month >= 7 ? startYear : startYear + 1;
}

function walkUntil(startYear, cutoffMonth) {
  const rows = [];
  let year = startYear;
  let month = 7;
  for (;;) {
    rows.push({ year, month, key: `${year}-${String(month).padStart(2, "0")}` });
    if (month === cutoffMonth && year === seasonYearFor(startYear, cutoffMonth)) break;
    month += 1;
    if (month === 13) {
      month = 1;
      year += 1;
    }
  }
  return rows;
}

export function isCompleteSeason(book, startYear) {
  let year = startYear;
  let month = 7;
  for (let i = 0; i < 12; i += 1) {
    const info = book.months[`${year}-${String(month).padStart(2, "0")}`];
    if (!info || info.mm == null || info.flag === "pending" || info.flag === "missing") return false;
    month += 1;
    if (month === 13) {
      month = 1;
      year += 1;
    }
  }
  return true;
}

export function completeSeasonYears(book, beforeStartYear) {
  const starts = new Set();
  for (const key of Object.keys(book.months)) {
    const year = Number(key.slice(0, 4));
    const month = Number(key.slice(5, 7));
    starts.add(month >= 7 ? year : year - 1);
  }
  return [...starts].filter((year) => year < beforeStartYear && isCompleteSeason(book, year)).sort((a, b) => a - b);
}

export function seasonTotal(book, logDays, startYear) {
  let total = 0;
  let year = startYear;
  let month = 7;
  for (let i = 0; i < 12; i += 1) {
    const got = mergedMonth(book, logDays, `${year}-${String(month).padStart(2, "0")}`);
    if (!got.known || got.total == null) return null;
    total += got.total;
    month += 1;
    if (month === 13) {
      month = 1;
      year += 1;
    }
  }
  return round1(total);
}

function seasonName(startYear) {
  return `${startYear}/${String(startYear + 1).slice(2)}`;
}

export function rankedSeasons(book, logDays, beforeStartYear, limit = 10) {
  const rows = [];
  for (const start of completeSeasonYears(book, beforeStartYear)) {
    const total = seasonTotal(book, logDays, start);
    if (total == null) continue;
    rows.push({ season: seasonName(start), mm: total });
  }
  const driest = rows.slice().sort((a, b) => a.mm - b.mm || a.season.localeCompare(b.season)).slice(0, limit);
  const wettest = rows.slice().sort((a, b) => b.mm - a.mm || a.season.localeCompare(b.season)).slice(0, limit);
  return { driest, wettest };
}

function totalThrough(book, logDays, startYear, cutoffMonth, cutoffDay) {
  let total = 0;
  const missing = [];
  for (const row of walkUntil(startYear, cutoffMonth)) {
    const got = mergedMonth(book, logDays, row.key);
    const atEnd = row.month === cutoffMonth && row.year === seasonYearFor(startYear, cutoffMonth);
    if (!got.known || got.total == null) {
      missing.push(MONTHS[row.month - 1]);
      if (atEnd) break;
      continue;
    }
    if (atEnd) {
      if (!got.merged) missing.push(MONTHS[row.month - 1]);
      else total += sumThroughDay(got.merged, cutoffDay);
      break;
    }
    total += got.total;
  }
  return { total: round1(total), missing };
}

function average(values) {
  if (!values.length) return null;
  return round1(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export function pastRain(rawBook, logDays, today) {
  if (!rawBook) return null;
  const book = rawBook.months && rawBook.rainByMonth ? rawBook : bookIndex(rawBook);
  const todayDate = typeof today === "string" ? new Date(`${today}T12:00:00Z`) : today;
  const y = todayDate.getUTCFullYear();
  const m = todayDate.getUTCMonth() + 1;
  const d = todayDate.getUTCDate();
  const startYear = m >= 7 ? y : y - 1;
  const completes = completeSeasonYears(book, startYear);
  const months = [];
  let year = startYear;
  let month = 7;
  while (year < y || (year === y && month <= m)) {
    const key = `${year}-${String(month).padStart(2, "0")}`;
    const got = mergedMonth(book, logDays, key);
    const current = year === y && month === m;
    let shown = null;
    if (got.known && got.total != null) {
      if (current && got.merged) shown = round1(sumThroughDay(got.merged, d));
      else if (!current) shown = round1(got.total);
    }
    const samples = [];
    for (const start of completes) {
      const histYear = seasonYearFor(start, month);
      const hist = mergedMonth(book, logDays, `${histYear}-${String(month).padStart(2, "0")}`);
      if (!hist.known || hist.total == null) continue;
      if (current && hist.merged) samples.push(sumThroughDay(hist.merged, d));
      else if (!current) samples.push(hist.total);
    }
    months.push({
      name: MONTHS[month - 1],
      key,
      mm: shown,
      known: shown != null,
      soFar: current,
      average: average(samples),
    });
    month += 1;
    if (month === 13) {
      month = 1;
      year += 1;
    }
  }
  const toDate = [];
  for (const start of completes) {
    const value = totalThrough(book, logDays, start, m, d);
    if (!value.missing.length) toDate.push(value.total);
  }
  const season = totalThrough(book, logDays, startYear, m, d);
  const last = totalThrough(book, logDays, startYear - 1, m, d);
  const point = `${d} ${SHORT[m - 1]}`;
  const ranks = rankedSeasons(book, logDays, startYear);
  return {
    seasonLabel: seasonName(startYear),
    seasonStart: `${startYear}-07-01`,
    seasonEnd: `${startYear + 1}-06-30`,
    asOfText: point,
    seasonMm: season.total,
    seasonAverage: average(toDate),
    seasonCount: completes.length,
    averageLabel: `average of ${completes.length} seasons`,
    lastSeasonMm: last.missing.length ? null : last.total,
    lastSeasonText: `Last season by ${point}`,
    missingMonths: season.missing,
    months,
    driest: ranks.driest,
    wettest: ranks.wettest,
  };
}
