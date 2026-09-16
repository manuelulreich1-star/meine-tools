// Grundgerüst des Fitnessplaners: Zustand, Navigation, Fenster, Hilfsfunktionen.
// Die einzelnen Bereiche (heute.js, plan.js, …) melden sich über App.view() an.
const F = FitnessDaten;
const MONTHS = ["Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember"];
const WD_SHORT = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const TAB_KEY = "fitness-tab";

let state = F.load();

const App = (function () {
  const views = {};
  let current = "heute";
  let toastTimer = null;
  let undoFn = null;

  function view(name, def) { views[name] = def; }

  function render(name = current) {
    const def = views[name];
    if (!def) return;
    def.render(document.getElementById(`view-${name}`));
  }

  function show(name) {
    if (!views[name]) name = "heute";
    current = name;
    document.querySelectorAll(".view").forEach(v => { v.hidden = v.id !== `view-${name}`; });
    document.querySelectorAll(".tab").forEach(t => {
      const active = t.dataset.view === name;
      t.classList.toggle("active", active);
      t.setAttribute("aria-current", active ? "page" : "false");
    });
    const section = document.getElementById(`view-${name}`);
    document.getElementById("viewTitle").textContent = section.dataset.title;
    try { localStorage.setItem(TAB_KEY, name); } catch { /* egal */ }
    render(name);
    window.scrollTo(0, 0);
  }

  // Speichern und aktuelle Ansicht neu zeichnen.
  function commit() {
    F.save(state);
    render();
    if (window.Training) Training.renderIfOpen();
  }

  function toast(text, undo) {
    const el = document.getElementById("toast");
    document.getElementById("toastText").textContent = text;
    const btn = document.getElementById("toastUndo");
    btn.hidden = !undo;
    undoFn = undo || null;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; undoFn = null; }, undo ? 6000 : 2500);
  }

  // Fenster: build(body, close) füllt den Inhalt. level 2 liegt über level 1.
  function sheet(title, build, level = 1) {
    const dlg = document.getElementById(`sheet${level}`);
    dlg.querySelector(".sheet-title").textContent = title;
    const body = dlg.querySelector(".sheet-body");
    body.innerHTML = "";
    const close = () => { if (dlg.open) dlg.close(); };
    build(body, close);
    if (!dlg.open) dlg.showModal();
    body.scrollTop = 0;
    // Suchfelder direkt bereit zum Tippen, sonst bekäme der Schließen-Knopf den Fokus.
    const auto = body.querySelector("[autofocus]");
    if (auto) auto.focus();
    return close;
  }

  function confirmSheet(title, text, okLabel, onOk, level = 2) {
    sheet(title, (body, close) => {
      body.innerHTML = `
        <p class="muted">${esc(text)}</p>
        <div class="sheet-actions">
          <button type="button" class="ghost-btn" data-act="cancel">Abbrechen</button>
          <button type="button" class="danger-btn" data-act="ok">${esc(okLabel)}</button>
        </div>`;
      body.querySelector('[data-act="cancel"]').onclick = close;
      body.querySelector('[data-act="ok"]').onclick = () => { close(); onOk(); };
    }, level);
  }

  function start() {
    document.querySelectorAll(".tab").forEach(t => t.addEventListener("click", () => show(t.dataset.view)));
    document.getElementById("settingsBtn").addEventListener("click", () => Einstellungen.open());
    document.getElementById("toastUndo").addEventListener("click", () => {
      const fn = undoFn;
      document.getElementById("toast").hidden = true;
      undoFn = null;
      if (fn) fn();
    });
    document.querySelectorAll(".sheet").forEach(dlg => {
      dlg.querySelector(".sheet-close").addEventListener("click", () => dlg.close());
      // Klick auf den abgedunkelten Hintergrund schließt.
      dlg.addEventListener("click", e => { if (e.target === dlg) dlg.close(); });
    });

    // Änderungen aus einem anderen Tab übernehmen.
    window.addEventListener("storage", e => {
      if (e.key !== F.STORAGE_KEY) return;
      state = F.load();
      render();
      Training.renderIfOpen();
    });
    // Neuer Tag, zurück aus dem Hintergrund.
    document.addEventListener("visibilitychange", () => { if (!document.hidden) render(); });

    let saved = "heute";
    try { saved = localStorage.getItem(TAB_KEY) || "heute"; } catch { /* egal */ }
    show(saved);
    Training.resume();
    if (!state.profile.setupDone) Einstellungen.onboarding();
  }

  return { view, render, show, commit, toast, sheet, confirmSheet, start, get current() { return current; } };
})();

// ---------- Hilfsfunktionen ----------

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Zahl aus Eingabe (Komma oder Punkt); leer/ungültig → null.
function num(v) {
  if (v == null) return null;
  const s = String(v).trim().replace(",", ".");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function fmt(n, digits = 0) {
  if (n == null || !Number.isFinite(n)) return "–";
  return n.toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: digits });
}

// Wert für ein Eingabefeld (deutsches Komma, leer bei null).
function inVal(n) {
  return n == null ? "" : String(n).replace(".", ",");
}

function dateLong(key) {
  const d = F.parseKey(key);
  return `${F.WEEKDAYS[d.getDay()]}, ${d.getDate()}. ${MONTHS[d.getMonth()]}`;
}

function dateShort(key) {
  const d = F.parseKey(key);
  return `${WD_SHORT[d.getDay()]} ${F.pad(d.getDate())}.${F.pad(d.getMonth() + 1)}.`;
}

function relDay(key) {
  const today = F.todayKey();
  if (key === today) return "Heute";
  if (key === F.addDays(today, -1)) return "Gestern";
  if (key === F.addDays(today, 1)) return "Morgen";
  return dateShort(key);
}

function duration(sec) {
  sec = Math.max(0, Math.round(sec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h ? `${h}:${F.pad(m)}:${F.pad(s)}` : `${m}:${F.pad(s)}`;
}

function nowTime() {
  const d = new Date();
  return `${F.pad(d.getHours())}:${F.pad(d.getMinutes())}`;
}

function pace(durationMin, distanceKm) {
  if (!durationMin || !distanceKm) return "";
  const secPerKm = durationMin * 60 / distanceKm;
  return `${Math.floor(secPerKm / 60)}:${F.pad(Math.round(secPerKm % 60))} min/km`;
}

// Kleiner Datumsumschalter (‹ Heute ›), gibt das Element zurück.
function dayNav(key, onChange) {
  const nav = document.createElement("div");
  nav.className = "day-nav";
  nav.innerHTML = `
    <button type="button" class="icon-btn" data-d="-1" aria-label="Vorheriger Tag">‹</button>
    <label class="day-nav-label">
      <span>${esc(relDay(key))}</span>
      <input type="date" value="${key}" aria-label="Datum wählen">
    </label>
    <button type="button" class="icon-btn" data-d="1" aria-label="Nächster Tag">›</button>`;
  nav.querySelectorAll("[data-d]").forEach(b => {
    b.onclick = () => onChange(F.addDays(key, Number(b.dataset.d)));
  });
  nav.querySelector("input").onchange = e => { if (e.target.value) onChange(e.target.value); };
  return nav;
}

function progressBar(value, target, cls = "") {
  const pct = target ? Math.min(100, Math.round(value / target * 100)) : 0;
  const over = target && value > target;
  return `<div class="bar ${cls}${over ? " over" : ""}" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><span style="width:${pct}%"></span></div>`;
}

function exerciseSummary(item, ex) {
  if (ex.type === "cardio") {
    return [item.duration ? `${item.duration} Min.` : "", item.distance ? `${fmt(item.distance, 2)} km` : ""].filter(Boolean).join(" · ") || "Cardio";
  }
  const unit = F.isTimed(ex) ? " Sek." : "";
  const weight = item.weight ? ` à ${fmt(item.weight, 2)} kg` : "";
  return `${item.sets || 1} × ${item.reps || "?"}${unit}${weight}`;
}
