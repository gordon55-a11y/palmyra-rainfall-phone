import { canonicalDays, emptyLog, mergeDays, readingFromText, round1, withDays } from "./merge.mjs";
import { pastRain } from "./past.mjs";

function pendingDays(pending) {
  const days = {};
  const ordered = (pending || []).slice().sort((a, b) => String(a.savedAt).localeCompare(String(b.savedAt)));
  for (const item of ordered) {
    days[item.date] = {
      mm: item.mm,
      note: item.note || "",
      source: "phone",
      savedAt: item.savedAt,
    };
  }
  return days;
}

function stampName(iso) {
  return `rain-log-${iso.replace(/:/g, "").replace(/-/g, "")}.json`;
}

export function createSync({
  drive,
  store,
  now = () => new Date().toISOString(),
  online = () => true,
}) {
  let state = {
    log: emptyLog(now()),
    book: null,
    etag: null,
    pending: [],
    warning: "",
    needsSignIn: false,
  };

  function view() {
    const overlaid = mergeDays((state.log && state.log.days) || {}, pendingDays(state.pending));
    return {
      log: { ...(state.log || emptyLog(now())), days: overlaid },
      book: state.book,
      pending: state.pending.map((item) => ({ ...item })),
      warning: state.warning || "",
      needsSignIn: Boolean(state.needsSignIn),
      offline: !online(),
      past: pastRain(state.book, overlaid, now().slice(0, 10)),
    };
  }

  async function persist() {
    await store.save({
      log: state.log,
      book: state.book,
      etag: state.etag,
      pending: state.pending,
      warning: state.warning,
      needsSignIn: state.needsSignIn,
    });
  }

  function noteReach(error) {
    if (error?.name === "UnreadableRainError") {
      state.warning = error.message;
      return;
    }
    if (error?.name === "SignInNeededError" || error?.code === "auth") {
      state.needsSignIn = true;
      return;
    }
    state.warning = "Could not reach the rain file. Your readings are still on this phone.";
  }

  async function pruneBackups() {
    let names = [];
    try {
      names = await drive.listBackups();
    } catch {
      return;
    }
    const sorted = (names || []).filter((name) => /^rain-log-/.test(name)).sort();
    const extra = sorted.slice(0, Math.max(0, sorted.length - 30));
    for (const name of extra) {
      try { await drive.deleteBackup(name); } catch { /* leave the spare copy */ }
    }
  }

  async function flush() {
    if (!online()) return view();
    if (!state.pending.length) return pull();
    for (let attempt = 0; attempt < 3; attempt += 1) {
      let got;
      try {
        got = await drive.getLog();
      } catch (error) {
        noteReach(error);
        await persist();
        return view();
      }
      if (got.status === 404) {
        state.warning = "The rain file was not found in OneDrive. Nothing new was created.";
        await persist();
        return view();
      }
      if (!got.ok) {
        state.warning = "Could not reach the rain file. Your readings are still on this phone.";
        await persist();
        return view();
      }
      const remoteDays = got.body.days || {};
      const merged = mergeDays(remoteDays, pendingDays(state.pending));
      const changed = canonicalDays(merged) !== canonicalDays(remoteDays);
      if (!changed) {
        state.log = withDays(remoteDays, got.body.updatedAt || now());
        state.etag = got.etag || state.etag;
        state.pending = [];
        state.needsSignIn = false;
        state.warning = "";
        await persist();
        return view();
      }
      const backup = await drive.putBackup(stampName(now()), got.raw || `${JSON.stringify(got.body, null, 2)}\n`);
      if (!backup.ok) {
        state.warning = "Could not make a backup, so nothing was saved.";
        await persist();
        return view();
      }
      let put;
      try {
        put = await drive.putLog(withDays(merged, now()), got.etag);
      } catch (error) {
        noteReach(error);
        await persist();
        return view();
      }
      if (put.ok) {
        state.log = withDays(merged, now());
        state.etag = put.etag || state.etag;
        state.pending = [];
        state.needsSignIn = false;
        state.warning = "";
        await persist();
        await pruneBackups();
        return view();
      }
      if (put.status === 412) continue;
      state.warning = "Could not save. Your readings are still on this phone.";
      await persist();
      return view();
    }
    state.warning = "The rain file kept changing. Your readings are still on this phone.";
    await persist();
    return view();
  }

  async function pull() {
    if (!online()) return view();
    if (state.pending.length) return flush();
    let got;
    try {
      got = await drive.getLog();
    } catch (error) {
      noteReach(error);
      await persist();
      return view();
    }
    if (!got.ok) return view();
    state.log = withDays(got.body.days || {}, got.body.updatedAt || now());
    state.etag = got.etag || state.etag;
    state.needsSignIn = false;
    try {
      const book = await drive.getBook();
      if (book) state.book = book;
    } catch (error) {
      noteReach(error);
    }
    await persist();
    return view();
  }

  async function init() {
    const saved = await store.load();
    if (saved && saved.log) {
      state = {
        log: saved.log,
        book: saved.book || null,
        etag: saved.etag || null,
        pending: Array.isArray(saved.pending) ? saved.pending : [],
        warning: saved.warning || "",
        needsSignIn: Boolean(saved.needsSignIn),
      };
    }
    if (online()) {
      try {
        if (state.pending.length) await flush();
        else await pull();
      } catch (error) {
        noteReach(error);
        await persist();
      }
    }
    return view();
  }

  async function queue(date, mm, note) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return { ...view(), ok: false, error: "Pick a valid date." };
    }
    state.pending.push({
      date,
      mm: round1(mm),
      note: String(note || "").trim().slice(0, 200),
      source: "phone",
      savedAt: now(),
    });
    state.warning = "";
    await persist();
    if (!online()) return { ...view(), ok: true, waiting: true };
    await flush();
    return { ...view(), ok: true, waiting: state.pending.length > 0 };
  }

  async function saveText(date, raw, note) {
    const parsed = readingFromText(raw, { dry: false });
    if (!parsed.ok) return { ...view(), ok: false, error: parsed.error };
    return queue(date, parsed.mm, note);
  }

  async function saveDry(date, note) {
    const parsed = readingFromText("", { dry: true });
    return queue(date, parsed.mm, note);
  }

  return { init, view, saveText, saveDry, flush, pull };
}
