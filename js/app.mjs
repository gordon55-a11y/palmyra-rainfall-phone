import { createAuth } from "./auth.mjs";
import { createGraphDrive } from "./graph.mjs";
import { pastRain } from "./past.mjs";
import { idbStore } from "./store.mjs";
import { createSync } from "./sync.mjs";
import { johannesburgNow, johannesburgToday } from "./time.mjs";

const $ = (id) => document.getElementById(id);
let sync = null;
let auth = null;
let view = null;

function mmText(value) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  const n = Math.round(Number(value) * 10) / 10;
  return `${Number.isInteger(n) ? String(n) : n.toFixed(1)} mm`;
}

function shortDate(iso) {
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return `${Number(iso.slice(8, 10))} ${months[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
}

function showStatus(kind, title, detail) {
  const el = $("status");
  el.hidden = false;
  el.className = `status ${kind}`;
  el.textContent = "";
  const strong = document.createElement("strong");
  strong.textContent = title;
  el.appendChild(strong);
  if (detail) {
    const extra = document.createElement("span");
    extra.className = "detail";
    extra.textContent = detail;
    el.appendChild(extra);
  }
}

function readingWord(n) {
  return n === 1 ? "reading" : "readings";
}

function paintBanner() {
  const el = $("banner");
  el.textContent = "";
  el.className = "banner";
  el.hidden = true;
  if (!view) return;
  const n = view.pending.length;
  const offline = view.offline || navigator.onLine === false;
  if (offline) {
    el.hidden = false;
    el.classList.add("off");
    const strong = document.createElement("strong");
    strong.textContent = `Offline, ${n} ${readingWord(n)} saved on phone`;
    el.appendChild(strong);
    for (const item of view.pending) {
      const line = document.createElement("div");
      line.className = "pending-line";
      line.textContent = `${shortDate(item.date)}, ${item.mm === 0 ? "dry" : mmText(item.mm)}`;
      el.appendChild(line);
    }
    return;
  }
  if (view.needsSignIn) {
    el.hidden = false;
    el.classList.add("sign");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "banner sign";
    button.id = "sign-in";
    button.textContent = n ? `Sign in to send ${n} saved ${readingWord(n)}` : "Sign in to check the rain file";
    button.addEventListener("click", () => { void askToSignIn(); });
    el.appendChild(button);
    if (n) {
      const wait = document.createElement("span");
      wait.className = "wait";
      wait.textContent = "Still on this phone. Not sent yet.";
      el.appendChild(wait);
    }
  }
}

function paintLog() {
  const past = view && view.past;
  const days = (view && view.log && view.log.days) || {};
  const today = johannesburgToday();
  $("today-line").textContent = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Johannesburg", weekday: "long", day: "numeric", month: "long", year: "numeric",
  }).format(new Date());
  if (!$("rain-date").value) $("rain-date").value = today;
  if (past) {
    $("season-range").textContent = `July ${past.seasonStart.slice(0, 4)} to June ${past.seasonEnd.slice(0, 4)}`;
    $("season-total").textContent = mmText(past.seasonMm);
    $("season-book").hidden = false;
    $("season-book").textContent = past.seasonCount ? "Includes the rainfall book." : "";
    const current = (past.months || []).find((row) => row.soFar);
    $("month-name").textContent = current ? `${current.name} ${today.slice(0, 4)}` : "This month";
    $("month-total").textContent = current && current.known ? mmText(current.mm) : "—";
  }
  const rains = Object.entries(days).filter(([, rec]) => rec && Number(rec.mm) > 0).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  $("last-rain").textContent = rains.length ? `${shortDate(rains[0][0])} · ${mmText(rains[0][1].mm)}` : "No rain this season yet";
  const list = $("month-days");
  list.textContent = "";
  const monthKey = today.slice(0, 7);
  const rows = Object.keys(days).filter((iso) => iso.startsWith(monthKey)).sort();
  if (!rows.length) {
    const empty = document.createElement("p");
    empty.className = "empty-days";
    empty.textContent = "Nothing logged this month yet.";
    list.appendChild(empty);
  } else {
    for (const iso of rows) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "day";
      const name = document.createElement("span");
      name.textContent = shortDate(iso);
      const amount = document.createElement("span");
      amount.textContent = Number(days[iso].mm) === 0 ? "Dry" : mmText(days[iso].mm);
      button.append(name, amount);
      button.addEventListener("click", () => {
        $("rain-date").value = iso;
        $("rain-mm").value = Number(days[iso].mm) === 0 ? "0" : String(days[iso].mm);
        $("editing-note").hidden = false;
        $("editing-note").textContent = `Changing ${shortDate(iso)}`;
      });
      list.appendChild(button);
    }
  }
}

function fillRank(id, rows) {
  const list = $(id);
  list.textContent = "";
  for (const row of rows || []) {
    const line = document.createElement("div");
    line.className = "past-row";
    const name = document.createElement("div");
    name.className = "past-name";
    name.textContent = row.season;
    const figure = document.createElement("div");
    figure.className = "past-figure";
    const strong = document.createElement("strong");
    strong.textContent = mmText(row.mm);
    figure.appendChild(strong);
    line.append(name, figure);
    list.appendChild(line);
  }
}

function paintPast() {
  const past = view && view.past;
  const list = $("past-months");
  list.textContent = "";
  fillRank("past-driest", []);
  fillRank("past-wettest", []);
  if (!past) {
    $("past-total").textContent = "—";
    $("past-average").textContent = view && view.book ? "" : "The rainfall book is not on this phone yet.";
    $("past-last").textContent = "";
    return;
  }
  $("past-range").textContent = `July ${past.seasonStart.slice(0, 4)} to June ${past.seasonEnd.slice(0, 4)}`;
  $("past-total").textContent = mmText(past.seasonMm);
  $("past-average").textContent = `Average to ${past.asOfText}: ${mmText(past.seasonAverage)} (${past.averageLabel})`;
  $("past-last").textContent = `${past.lastSeasonText}: ${mmText(past.lastSeasonMm)}`;
  const names = past.missingMonths || [];
  const missing = $("past-missing");
  if (names.length) {
    missing.hidden = false;
    const joined = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
    missing.textContent = `${joined} ${names.length === 1 ? "is" : "are"} not in the book yet.`;
  } else {
    missing.hidden = true;
  }
  for (const month of past.months || []) {
    const row = document.createElement("div");
    row.className = "past-row";
    const name = document.createElement("div");
    name.className = "past-name";
    name.textContent = month.soFar ? `${month.name} so far` : month.name;
    const figure = document.createElement("div");
    figure.className = "past-figure";
    const strong = document.createElement("strong");
    strong.textContent = month.known ? mmText(month.mm) : "—";
    const avg = document.createElement("span");
    avg.textContent = month.soFar
      ? `average to ${past.asOfText} ${mmText(month.average)}`
      : `average ${mmText(month.average)}`;
    figure.append(strong, avg);
    row.append(name, figure);
    list.appendChild(row);
  }
  fillRank("past-driest", past.driest);
  fillRank("past-wettest", past.wettest);
}

function paint() {
  if (!view) return;
  paintBanner();
  paintLog();
  paintPast();
  if (view.warning && !view.offline) showStatus("failed", "Not saved", view.warning);
}

function showTab(name) {
  const logging = name !== "past";
  $("panel-log").hidden = !logging;
  $("panel-past").hidden = logging;
  $("tab-log").classList.toggle("active", logging);
  $("tab-past").classList.toggle("active", !logging);
  $("tab-log").setAttribute("aria-selected", logging ? "true" : "false");
  $("tab-past").setAttribute("aria-selected", logging ? "false" : "true");
}

async function afterSave(result) {
  view = result;
  if (!result.ok) {
    showStatus("failed", "Not saved", result.error || "The rain file was not written.");
    paint();
    return;
  }
  if (result.waiting || view.offline || view.needsSignIn) {
    $("status").hidden = true;
    paint();
    return;
  }
  showStatus("saved", "Saved", "");
  paint();
}

async function askToSignIn() {
  if (!auth) return;
  try { await auth.signIn(); } catch { /* stay on the page */ }
}

function previewView() {
  if (location.hostname !== "localhost" && location.hostname !== "127.0.0.1") return null;
  const raw = sessionStorage.getItem("palmyra-preview");
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

async function boot() {
  const preview = previewView();
  if (preview) {
    view = preview;
    if (!view.past && view.book && view.log) {
      view.past = pastRain(view.book, view.log.days || {}, preview.today || johannesburgToday());
    }
    paint();
    return;
  }
  auth = await createAuth();
  const drive = createGraphDrive({ fetch: window.fetch.bind(window), getToken: () => auth.getToken() });
  sync = createSync({
    drive,
    store: idbStore(),
    now: johannesburgNow,
    online: () => navigator.onLine !== false,
  });
  view = await sync.init();
  paint();
}

$("tab-log").addEventListener("click", () => showTab("log"));
$("tab-past").addEventListener("click", () => showTab("past"));
$("rain-form").addEventListener("submit", (event) => {
  event.preventDefault();
  if (!sync) return;
  void sync.saveText($("rain-date").value, $("rain-mm").value, "").then(afterSave);
});
$("save-dry").addEventListener("click", () => {
  if (!sync) return;
  void sync.saveDry($("rain-date").value, "").then(afterSave);
});
$("mark-dry").addEventListener("click", () => {
  if (!sync) return;
  const iso = $("rain-date").value;
  if (!iso) return;
  const day = Number(iso.slice(8, 10));
  void (async () => {
    let last = view;
    for (let n = 1; n <= day; n += 1) {
      const key = `${iso.slice(0, 8)}${String(n).padStart(2, "0")}`;
      if (view && view.log && view.log.days && view.log.days[key]) continue;
      last = await sync.saveDry(key, "Marked dry");
      view = last;
    }
    afterSave(last);
  })();
});

window.addEventListener("online", () => {
  if (!sync) return;
  void sync.flush().then((next) => { view = next; paint(); });
});
window.addEventListener("offline", () => {
  if (!view) return;
  view = { ...view, offline: true };
  paint();
});
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible" || !sync) return;
  if (navigator.onLine === false) return;
  void sync.pull().then((next) => { view = next; paint(); });
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js", { updateViaCache: "none" }).catch(() => {});
}

boot();
