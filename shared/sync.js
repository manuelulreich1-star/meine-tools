// Google-Drive-Sync für alle Tools.
// Jeder Eintrag aus SYNC_CONFIG.keys liegt als eigene Datei im versteckten App-Ordner
// (appDataFolder) des Google Drive. Die App bekommt nur die Berechtigung „drive.appdata“
// und sieht damit ausschließlich diesen Ordner.
//
// Abgleich: Drei-Wege-Zusammenführung aus letztem gemeinsamen Stand („Basis“), lokalem
// und entferntem Stand. Einträge mit id werden einzeln abgeglichen; ändern beide Seiten
// denselben Wert, gewinnt die jüngere Änderung.
window.Sync = (function () {
  const config = window.SYNC_CONFIG || { clientId: "", keys: [] };
  const KEYS = new Set(config.keys);
  const SCOPE = "https://www.googleapis.com/auth/drive.appdata";
  const META_KEY = "sync-meta";
  const BASE_PREFIX = "sync-base:";
  const BACKUP_PREFIX = "sync-backup:";
  const TOKEN_KEY = "sync-token";
  const API = "https://www.googleapis.com/drive/v3/files";
  const UPLOAD = "https://www.googleapis.com/upload/drive/v3/files";

  const storage = window.localStorage;
  const rawSet = Storage.prototype.setItem;
  const rawRemove = Storage.prototype.removeItem;

  let applying = false;
  let tokenClient = null;
  let gisPromise = null;
  let queue = Promise.resolve();
  let fileIndex = null;
  let timers = {};
  let status = { state: "off", text: "", time: null };

  // ---------- Hilfen ----------

  function readJson(key, fallback) {
    try {
      const v = storage.getItem(key);
      return v == null ? fallback : JSON.parse(v);
    } catch {
      return fallback;
    }
  }

  function writeRaw(key, value) {
    applying = true;
    try {
      if (value == null) rawRemove.call(storage, key);
      else rawSet.call(storage, key, value);
    } finally {
      applying = false;
    }
  }

  function meta() {
    const m = readJson(META_KEY, {});
    return { connected: false, dirty: {}, changed: {}, gen: {}, remote: {}, lastSync: null, ...m };
  }

  function saveMeta(m) {
    writeRaw(META_KEY, JSON.stringify(m));
  }

  // JSON mit sortierten Schlüsseln, damit gleiche Inhalte gleich verglichen werden.
  function stable(v) {
    if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
    if (v && typeof v === "object") {
      return `{${Object.keys(v).filter(k => v[k] !== undefined).sort().map(k => `${JSON.stringify(k)}:${stable(v[k])}`).join(",")}}`;
    }
    return JSON.stringify(v === undefined ? null : v);
  }

  function eq(a, b) { return stable(a) === stable(b); }

  function isPlain(v) { return v != null && typeof v === "object" && !Array.isArray(v); }

  function isIdArray(v) {
    return Array.isArray(v) && v.length > 0 && v.every(x => isPlain(x) && x.id != null);
  }

  function isPrimitiveArray(v) {
    return Array.isArray(v) && v.every(x => x == null || typeof x !== "object");
  }

  // ---------- Zusammenführen ----------

  function merge(base, local, remote, prefer) {
    if (eq(local, remote)) return local;
    if (base !== undefined && eq(base, local)) return remote;
    if (base !== undefined && eq(base, remote)) return local;

    const bothIdArrays = (isIdArray(local) || (Array.isArray(local) && !local.length))
      && (isIdArray(remote) || (Array.isArray(remote) && !remote.length));
    if (bothIdArrays) return mergeIdArrays(Array.isArray(base) ? base : [], local, remote, prefer);
    if (isPrimitiveArray(local) && isPrimitiveArray(remote)) {
      return mergeSets(Array.isArray(base) ? base : [], local, remote);
    }
    if (isPlain(local) && isPlain(remote)) {
      return mergeObjects(isPlain(base) ? base : undefined, local, remote, prefer);
    }
    return prefer === "local" ? local : remote;
  }

  function mergeObjects(base, local, remote, prefer) {
    const out = {};
    const keys = new Set([...Object.keys(local), ...Object.keys(remote)]);
    for (const k of keys) {
      const inL = k in local;
      const inR = k in remote;
      const b = base ? base[k] : undefined;
      const inB = base ? k in base : false;
      if (inL && inR) out[k] = merge(inB ? b : undefined, local[k], remote[k], prefer);
      else if (inL) {
        // Auf der anderen Seite gelöscht und hier unverändert → löschen.
        if (!(inB && eq(b, local[k]))) out[k] = local[k];
      } else if (!(inB && eq(b, remote[k]))) {
        out[k] = remote[k];
      }
    }
    return out;
  }

  function mergeIdArrays(base, local, remote, prefer) {
    const bm = new Map(base.filter(isPlain).map(x => [String(x.id), x]));
    const lm = new Map(local.map(x => [String(x.id), x]));
    const rm = new Map(remote.map(x => [String(x.id), x]));
    const first = prefer === "local" ? local : remote;
    const second = prefer === "local" ? remote : local;
    const order = [...first, ...second.filter(x => !(prefer === "local" ? lm : rm).has(String(x.id)))]
      .map(x => String(x.id));
    const out = [];
    for (const id of order) {
      const l = lm.get(id);
      const r = rm.get(id);
      const b = bm.get(id);
      if (l && r) out.push(merge(b, l, r, prefer));
      else if (l) { if (!(b && eq(b, l))) out.push(l); }
      else if (r && !(b && eq(b, r))) out.push(r);
    }
    return out;
  }

  function mergeSets(base, local, remote) {
    const b = new Set(base.map(stable));
    const l = new Set(local.map(stable));
    const r = new Set(remote.map(stable));
    const out = [];
    const seen = new Set();
    for (const x of [...local, ...remote]) {
      const s = stable(x);
      if (seen.has(s)) continue;
      seen.add(s);
      // Auf einer Seite entfernt (war in der Basis) → weglassen.
      if (b.has(s) && (!l.has(s) || !r.has(s))) continue;
      out.push(x);
    }
    return out;
  }

  // ---------- Lokale Änderungen erkennen ----------

  function markDirty(key) {
    const m = meta();
    m.dirty[key] = true;
    m.changed[key] = Date.now();
    m.gen[key] = (m.gen[key] || 0) + 1;
    saveMeta(m);
    if (m.connected) schedule(key, 1500);
  }

  Storage.prototype.setItem = function (key, value) {
    rawSet.call(this, key, value);
    if (this === storage && !applying && KEYS.has(key)) markDirty(key);
  };

  Storage.prototype.removeItem = function (key) {
    rawRemove.call(this, key);
    if (this === storage && !applying && KEYS.has(key)) markDirty(key);
  };

  function schedule(key, delay) {
    clearTimeout(timers[key]);
    timers[key] = setTimeout(() => { delete timers[key]; syncKeys([key]); }, delay);
  }

  // ---------- Anmeldung ----------

  function available() {
    return !!config.clientId && location.protocol !== "file:";
  }

  function token() {
    try {
      const t = JSON.parse(sessionStorage.getItem(TOKEN_KEY));
      return t && t.expires > Date.now() + 30000 ? t.value : null;
    } catch {
      return null;
    }
  }

  function loadGis() {
    if (window.google && google.accounts && google.accounts.oauth2) return Promise.resolve();
    if (!gisPromise) {
      gisPromise = new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = "https://accounts.google.com/gsi/client";
        s.async = true;
        s.onload = resolve;
        s.onerror = () => { gisPromise = null; reject(new Error("Google-Anmeldung konnte nicht geladen werden")); };
        document.head.appendChild(s);
      });
    }
    return gisPromise;
  }

  // Muss aus einem Klick heraus aufgerufen werden (Google öffnet ein Anmeldefenster).
  async function connect() {
    if (!available()) return;
    setStatus("syncing", "Verbinde…");
    try {
      await loadGis();
    } catch (err) {
      setStatus("error", err.message);
      return;
    }
    if (!tokenClient) {
      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: config.clientId,
        scope: SCOPE,
        callback: resp => {
          if (resp.error || !google.accounts.oauth2.hasGrantedAllScopes(resp, SCOPE)) {
            setStatus("need-auth", "Zugriff nicht erteilt");
            return;
          }
          sessionStorage.setItem(TOKEN_KEY, JSON.stringify({
            value: resp.access_token,
            expires: Date.now() + Number(resp.expires_in || 3600) * 1000,
          }));
          const m = meta();
          m.connected = true;
          saveMeta(m);
          syncAll();
        },
        error_callback: err => {
          const type = err && err.type;
          const text = type === "popup_closed" ? "Anmeldung abgebrochen – nochmal tippen"
            : type === "popup_failed_to_open" ? "Anmeldefenster blockiert – Pop-ups erlauben"
            : "Anmeldung fehlgeschlagen – nochmal tippen";
          setStatus(meta().connected ? "need-auth" : "off", text);
        },
      });
    }
    tokenClient.requestAccessToken({ prompt: meta().connected ? "" : "consent" });
  }

  function disconnect() {
    const t = token();
    if (t && window.google && google.accounts) google.accounts.oauth2.revoke(t, () => {});
    sessionStorage.removeItem(TOKEN_KEY);
    const m = meta();
    // Basis verwerfen: beim erneuten Verbinden wird nur zusammengeführt, nichts gelöscht.
    for (const key of KEYS) rawRemove.call(storage, BASE_PREFIX + key);
    saveMeta({ ...m, connected: false, remote: {}, lastSync: null });
    fileIndex = null;
    setStatus("off", "");
  }

  // ---------- Drive-Zugriffe ----------

  async function api(url, options = {}) {
    const t = token();
    if (!t) throw Object.assign(new Error("Anmeldung abgelaufen"), { auth: true });
    const res = await fetch(url, { ...options, headers: { ...(options.headers || {}), Authorization: `Bearer ${t}` } });
    if (res.status === 401) {
      sessionStorage.removeItem(TOKEN_KEY);
      throw Object.assign(new Error("Anmeldung abgelaufen"), { auth: true });
    }
    if (!res.ok) throw Object.assign(new Error(`Google Drive meldet Fehler ${res.status}`), { status: res.status });
    return res;
  }

  async function listFiles() {
    const res = await api(`${API}?spaces=appDataFolder&pageSize=100&fields=files(id,name,appProperties)`);
    const data = await res.json();
    fileIndex = {};
    for (const f of data.files || []) fileIndex[f.name] = f;
    return fileIndex;
  }

  async function download(id) {
    const res = await api(`${API}/${encodeURIComponent(id)}?alt=media`);
    return res.json();
  }

  async function upload(name, fileId, payload) {
    const boundary = "sync" + Math.random().toString(36).slice(2);
    const metadata = { appProperties: { updatedAt: String(payload.updatedAt) } };
    if (!fileId) Object.assign(metadata, { name, parents: ["appDataFolder"] });
    const body = [
      `--${boundary}`,
      "Content-Type: application/json; charset=UTF-8",
      "",
      JSON.stringify(metadata),
      `--${boundary}`,
      "Content-Type: application/json; charset=UTF-8",
      "",
      JSON.stringify(payload),
      `--${boundary}--`,
    ].join("\r\n");
    const url = fileId
      ? `${UPLOAD}/${encodeURIComponent(fileId)}?uploadType=multipart&fields=id,name,appProperties`
      : `${UPLOAD}?uploadType=multipart&fields=id,name,appProperties`;
    const res = await api(url, {
      method: fileId ? "PATCH" : "POST",
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
      body,
    });
    const file = await res.json();
    fileIndex[file.name || name] = file;
    return file;
  }

  // ---------- Abgleich ----------

  // Sicherheitsnetz: den Stand vor jeder Übernahme aufheben (je Eintrag die letzte Version).
  function backup(key, value) {
    writeRaw(BACKUP_PREFIX + key, JSON.stringify({ time: Date.now(), value }));
  }

  function backups() {
    return [...KEYS]
      .map(key => ({ key, ...readJson(BACKUP_PREFIX + key, {}) }))
      .filter(b => b.time && b.time > Date.now() - 7 * 24 * 3600 * 1000);
  }

  // Stellt die gesicherten Stände wieder her; sie gelten dann als neue Änderung und werden hochgeladen.
  function restoreBackups() {
    for (const b of backups()) {
      if (b.value == null) storage.removeItem(b.key);
      else storage.setItem(b.key, b.value);
      rawRemove.call(storage, BACKUP_PREFIX + b.key);
      window.dispatchEvent(new StorageEvent("storage", { key: b.key, newValue: b.value, storageArea: storage }));
    }
    render();
  }

  function applyLocal(key, value) {
    const oldValue = storage.getItem(key);
    const newValue = value == null ? null : JSON.stringify(value);
    if (oldValue === newValue) return;
    backup(key, oldValue);
    writeRaw(key, newValue);
    // Offene Seiten laden ihre Daten neu (gleiches Ereignis wie bei Änderungen aus anderen Tabs).
    window.dispatchEvent(new StorageEvent("storage", { key, oldValue, newValue, storageArea: storage }));
  }

  async function syncKey(key) {
    const name = `${key}.json`;
    let m = meta();
    const file = fileIndex[name];
    const remoteStamp = file && file.appProperties ? Number(file.appProperties.updatedAt) : null;
    const known = m.remote[key] && m.remote[key].updatedAt;
    if (file && !m.dirty[key] && remoteStamp && remoteStamp === known) return;

    const remote = file ? await download(file.id) : null;
    // Nur Dateien im eigenen Format übernehmen, alles andere bleibt unangetastet.
    if (remote && (typeof remote !== "object" || remote.key !== key || !("data" in remote))) {
      throw new Error(`Unerwarteter Inhalt in ${name} – nichts übernommen`);
    }
    const gen = m.gen[key] || 0;
    const local = readJson(key, null);
    const baseRaw = storage.getItem(BASE_PREFIX + key);
    const base = baseRaw == null ? undefined : JSON.parse(baseRaw);

    let merged;
    if (!remote) {
      merged = local;
    } else {
      const prefer = (m.changed[key] || 0) > (remote.updatedAt || 0) ? "local" : "remote";
      merged = merge(base, local, remote.data ?? null, prefer);
      if (!eq(merged, local)) applyLocal(key, merged);
    }

    let stamp = remote ? remote.updatedAt : null;
    if (!remote ? merged != null : !eq(merged, remote.data ?? null)) {
      stamp = Date.now();
      await upload(name, file && file.id, { version: 1, key, updatedAt: stamp, data: merged });
    }

    writeRaw(BASE_PREFIX + key, JSON.stringify(merged));
    m = meta();
    if ((m.gen[key] || 0) === gen) delete m.dirty[key];
    m.remote[key] = { updatedAt: stamp };
    saveMeta(m);
  }

  function syncKeys(keys) {
    queue = queue.then(() => run(keys)).catch(() => {});
    return queue;
  }

  function syncAll() {
    return syncKeys([...KEYS]);
  }

  async function run(keys) {
    const m = meta();
    if (!available() || !m.connected) { updateStatus(); return; }
    if (!navigator.onLine) { setStatus("offline", "Offline – wird später synchronisiert"); return; }
    if (!token()) { updateStatus(); return; }
    setStatus("syncing", "Synchronisiere…");
    try {
      if (!fileIndex || keys.length === KEYS.size) await listFiles();
      for (const key of keys) {
        try {
          await syncKey(key);
        } catch (err) {
          // Datei wurde anderswo gelöscht → Liste neu laden und nochmal versuchen.
          if (err.status !== 404) throw err;
          await listFiles();
          await syncKey(key);
        }
      }
      const done = meta();
      done.lastSync = Date.now();
      saveMeta(done);
      updateStatus();
    } catch (err) {
      if (err.auth) updateStatus();
      else setStatus("error", err.message || "Sync fehlgeschlagen");
    }
  }

  function pending() {
    return Object.keys(meta().dirty).length;
  }

  // ---------- Anzeige ----------

  function timeText(ts) {
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }

  function updateStatus() {
    const m = meta();
    if (!config.clientId) return setStatus("unconfigured", "Sync nicht eingerichtet");
    if (location.protocol === "file:") return setStatus("unconfigured", "Sync nur über localhost oder die Web-Adresse");
    if (!m.connected) return setStatus("off", "Mit Google Drive verbinden");
    if (!token()) return setStatus("need-auth", pending() ? "Ungesicherte Änderungen – tippen" : "Tippen zum Synchronisieren");
    if (pending()) return setStatus("syncing", "Änderungen werden gesichert…");
    setStatus("ok", m.lastSync ? `Synchronisiert ${timeText(m.lastSync)}` : "Verbunden");
  }

  function setStatus(state, text) {
    status = { state, text };
    render();
    window.dispatchEvent(new CustomEvent("sync-status", { detail: status }));
  }

  const ICONS = { ok: "☁️", syncing: "🔄", "need-auth": "🔒", error: "⚠️", offline: "📴", off: "☁️", unconfigured: "☁️" };

  function render() {
    let slots = [...document.querySelectorAll("[data-sync-slot]")];
    if (!slots.length && document.body) {
      const floating = document.createElement("div");
      floating.dataset.syncSlot = "";
      floating.className = "sync-floating";
      document.body.appendChild(floating);
      slots = [floating];
    }
    for (const slot of slots) {
      const full = slot.dataset.syncSlot === "full";
      const hidden = !full && (status.state === "off" || status.state === "unconfigured");
      slot.hidden = hidden;
      if (hidden) continue;
      let chip = slot.querySelector(".sync-chip");
      if (!chip) {
        chip = document.createElement("button");
        chip.type = "button";
        chip.className = "sync-chip";
        chip.addEventListener("click", onChipClick);
        slot.appendChild(chip);
      }
      chip.dataset.state = status.state;
      chip.disabled = status.state === "unconfigured";
      chip.innerHTML = `<span class="sync-icon"></span><span class="sync-text"></span>`;
      chip.firstChild.textContent = ICONS[status.state] || "☁️";
      chip.lastChild.textContent = ` ${status.text}`;
      chip.title = status.state === "ok" ? "Jetzt synchronisieren" : status.text;

      let off = slot.querySelector(".sync-disconnect");
      const showOff = full && meta().connected;
      if (showOff && !off) {
        off = document.createElement("button");
        off.type = "button";
        off.className = "sync-disconnect";
        off.textContent = "Trennen";
        off.addEventListener("click", () => {
          if (confirm("Sync mit Google Drive trennen? Die Daten bleiben auf diesem Gerät und im Drive erhalten.")) disconnect();
        });
        slot.appendChild(off);
      } else if (!showOff && off) {
        off.remove();
      }

      let undo = slot.querySelector(".sync-restore");
      const saved = full ? backups() : [];
      if (saved.length && !undo) {
        undo = document.createElement("button");
        undo.type = "button";
        undo.className = "sync-disconnect sync-restore";
        undo.addEventListener("click", () => {
          const list = backups();
          const when = new Date(Math.max(...list.map(b => b.time))).toLocaleString("de-DE");
          if (confirm(`Stand vor dem letzten Abgleich wiederherstellen (${list.length} Bereich(e), zuletzt ${when})? Die wiederhergestellten Daten werden danach auf alle Geräte übertragen.`)) restoreBackups();
        });
        slot.appendChild(undo);
      } else if (!saved.length && undo) {
        undo.remove();
      }
      if (undo) undo.textContent = "Stand vor Sync zurückholen";
    }
  }

  function onChipClick() {
    const s = status.state;
    if (s === "off" || s === "need-auth" || (s === "error" && !token())) connect();
    else if (s === "ok" || s === "error" || s === "offline") syncAll();
  }

  // ---------- Auslöser ----------

  function flush() {
    for (const key of Object.keys(timers)) {
      clearTimeout(timers[key]);
      delete timers[key];
    }
    if (pending()) syncKeys(Object.keys(meta().dirty));
  }

  // run() prüft selbst, ob verbunden ist – die Auslöser gelten auch nach einem späteren Verbinden.
  function start() {
    updateStatus();
    if (!available()) return;
    if (meta().connected) syncAll();
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) flush();
      else syncAll();
    });
    window.addEventListener("pagehide", flush);
    window.addEventListener("online", syncAll);
    window.addEventListener("offline", () => { if (meta().connected) setStatus("offline", "Offline – wird später synchronisiert"); });
    setInterval(() => { if (!document.hidden && meta().connected) syncAll(); }, 2 * 60 * 1000);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();

  return { connect, disconnect, syncAll, merge, get status() { return status; } };
})();
