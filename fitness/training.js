// Laufendes Training: Sätze abhaken, Pausen-Timer, Stoppuhr, Abschluss.
// Das aktive Training liegt in state.active und übersteht so ein Neuladen der Seite.
const Training = (function () {
  const liveEl = document.getElementById("live");
  const bodyEl = document.getElementById("liveBody");
  const clockEl = document.getElementById("liveClock");
  const progressEl = document.querySelector("#liveProgress span");
  const restBar = document.getElementById("restBar");
  const restFill = restBar.querySelector(".rest-fill");
  const restTime = document.getElementById("restTime");
  const restLabel = document.getElementById("restLabel");

  let clockTimer = null;
  let restTimer = null;
  let restDoneTimer = null;
  let audioCtx = null;
  let wakeLock = null;

  const RPE = [6, 7, 7.5, 8, 8.5, 9, 9.5, 10];

  // ---------- Starten ----------

  function buildEntry(item) {
    const ex = F.exerciseById(state, item.exerciseId);
    const sug = F.suggestion(state, item);
    if (ex.type === "cardio") {
      return {
        exerciseId: item.exerciseId,
        target: { duration: item.duration || null, distance: item.distance || null },
        duration: sug.duration ?? item.duration ?? null,
        distance: sug.distance ?? item.distance ?? null,
        done: false,
        hint: sug.text || "",
        up: !!sug.up,
      };
    }
    const count = item.sets || 3;
    return {
      exerciseId: item.exerciseId,
      target: { sets: count, reps: item.reps || 10, rest: item.rest || 90 },
      sets: Array.from({ length: count }, () => ({
        weight: ex.type === "kraft" ? sug.weight ?? null : null,
        reps: sug.reps ?? item.reps ?? null,
        rpe: null,
        done: false,
      })),
      hint: sug.text || "",
      up: !!sug.up,
    };
  }

  function begin(name, workoutId, entries, note = "") {
    state.active = {
      id: F.uid(),
      workoutId,
      name,
      date: F.todayKey(),
      start: nowTime(),
      startedAt: Date.now(),
      note,
      entries,
      rest: null,
    };
    F.save(state);
    open();
    App.render();
  }

  function start(workoutId) {
    if (state.active) return open();
    const w = F.workoutById(state, workoutId);
    if (!w) return;
    begin(w.name, w.id, w.items.map(buildEntry), w.note || "");
  }

  function startFree() {
    if (state.active) return open();
    begin("Freies Training", null, []);
    Plan.pickExercise(addExercise, 2);
  }

  // Auswahl für ungeplante Trainings (auch zum Nachtragen – Datum beim Beenden ändern).
  function chooseWorkout() {
    if (state.active) return open();
    App.sheet("Training starten", (body, close) => {
      body.innerHTML = `
        <p class="muted">Zum Nachtragen einfach starten und beim Beenden Datum und Dauer anpassen.</p>
        <div class="pick-list">
          ${state.workouts.map(w => `
            <button type="button" class="pick-item color-${esc(w.color)}" data-id="${esc(w.id)}">
              <strong>${esc(w.name)}</strong>
              <small class="muted">${w.items.length} Übungen · ca. ${F.workoutMinutes(state, w)} Min.</small>
            </button>`).join("")}
          <button type="button" class="pick-item" data-id="">
            <strong>Freies Training</strong>
            <small class="muted">Übungen während des Trainings auswählen</small>
          </button>
        </div>`;
      body.querySelectorAll("[data-id]").forEach(b => {
        b.onclick = () => {
          close();
          if (b.dataset.id) start(b.dataset.id);
          else startFree();
        };
      });
    });
  }

  function addExercise(ex) {
    if (!state.active) return;
    const item = ex.type === "cardio"
      ? { exerciseId: ex.id, duration: 20, distance: null }
      : { exerciseId: ex.id, sets: 3, reps: F.isTimed(ex) ? 30 : 10, rest: 90 };
    const last = F.lastPerformance(state, ex.id);
    if (last && ex.type !== "cardio") {
      item.sets = Math.max(1, last.entry.sets.filter(s => s.done).length);
      item.reps = last.entry.target ? last.entry.target.reps : item.reps;
      item.rest = last.entry.target ? last.entry.target.rest : item.rest;
    }
    state.active.entries.push(buildEntry(item));
    F.save(state);
    render();
    bodyEl.lastElementChild.previousElementSibling?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // ---------- Anzeige ----------

  function open() {
    if (!state.active) return;
    liveEl.hidden = false;
    document.body.classList.add("live-open");
    render();
    clearInterval(clockTimer);
    tickClock();
    clockTimer = setInterval(tickClock, 1000);
    if (state.active.rest) runRest();
    requestWakeLock();
  }

  function hide() {
    liveEl.hidden = true;
    document.body.classList.remove("live-open");
    clearInterval(clockTimer);
    releaseWakeLock();
    App.render();
  }

  function resume() {
    if (state.active) open();
  }

  function renderIfOpen() {
    if (liveEl.hidden) return;
    if (!state.active) { stopRest(); hide(); return; }
    render();
  }

  function tickClock() {
    if (!state.active) return;
    clockEl.textContent = duration((Date.now() - state.active.startedAt) / 1000);
  }

  function updateProgress() {
    let total = 0;
    let done = 0;
    for (const e of state.active.entries) {
      if (e.sets) { total += e.sets.length; done += e.sets.filter(s => s.done).length; }
      else { total++; if (e.done) done++; }
    }
    progressEl.style.width = total ? `${done / total * 100}%` : "0";
  }

  function render() {
    const a = state.active;
    if (!a) return;
    document.getElementById("liveName").textContent = a.name;
    bodyEl.innerHTML = "";
    if (a.note) {
      const n = document.createElement("p");
      n.className = "live-note";
      n.textContent = a.note;
      bodyEl.appendChild(n);
    }
    a.entries.forEach((entry, i) => bodyEl.appendChild(entryCard(entry, i)));

    const add = document.createElement("div");
    add.className = "live-add";
    add.innerHTML = `<button type="button" class="ghost-btn wide">+ Übung hinzufügen</button>`;
    add.querySelector("button").onclick = () => Plan.pickExercise(addExercise, 2);
    bodyEl.appendChild(add);
    updateProgress();
  }

  function replaceCard(i) {
    const old = bodyEl.querySelector(`.live-card[data-i="${i}"]`);
    if (old) old.replaceWith(entryCard(state.active.entries[i], i));
    updateProgress();
  }

  function lastText(ex) {
    const last = F.lastPerformance(state, ex.id);
    if (!last) return "";
    const e = last.entry;
    let text;
    if (ex.type === "cardio") {
      text = [e.duration ? `${fmt(e.duration)} Min.` : "", e.distance ? `${fmt(e.distance, 2)} km` : "", pace(e.duration, e.distance)].filter(Boolean).join(" · ");
    } else {
      const unit = F.isTimed(ex) ? " s" : "";
      text = e.sets.filter(s => s.done).map(s => (s.weight ? `${fmt(s.weight, 2)}×` : "") + `${s.reps ?? "?"}${unit}`).join(" · ");
    }
    return `<p class="last-perf">Letztes Mal (${dateShort(last.date)}): <strong>${esc(text)}</strong></p>`;
  }

  function entryCard(entry, i) {
    const ex = F.exerciseById(state, entry.exerciseId);
    const card = document.createElement("div");
    const allDone = entry.sets ? entry.sets.length && entry.sets.every(s => s.done) : entry.done;
    card.className = "live-card" + (allDone ? " all-done" : "");
    card.dataset.i = i;

    const hint = entry.hint ? `<span class="sug ${entry.up ? "up" : ""}">${esc(entry.hint)}</span>` : "";
    let html = `
      <div class="live-card-head">
        <div class="grow">
          <strong>${esc(ex.name)}</strong>
          <small class="muted">${esc(ex.group)}${entry.target && entry.target.reps ? ` · Ziel ${entry.target.sets}×${entry.target.reps}${F.isTimed(ex) ? " Sek." : ""}` : ""}</small>
        </div>
        ${ex.hint ? `<button type="button" class="icon-btn small" data-act="info" aria-label="Ausführung">ⓘ</button>` : ""}
      </div>
      <p class="ex-hint" hidden>${esc(ex.hint || "")}</p>
      ${hint}
      ${lastText(ex)}`;

    if (ex.type === "cardio") {
      const withDist = ex.distance !== false;
      html += `
        <div class="cardio-grid">
          <label class="field">Dauer (Min.)
            <input type="text" inputmode="decimal" data-c="duration" value="${inVal(entry.duration)}">
          </label>
          ${withDist ? `<label class="field">Strecke (km)
            <input type="text" inputmode="decimal" data-c="distance" value="${inVal(entry.distance)}">
          </label>` : ""}
          <button type="button" class="check big ${entry.done ? "on" : ""}" data-act="cardio-done" aria-label="Erledigt">✓</button>
        </div>
        ${withDist ? `<p class="pace muted">${esc(pace(entry.duration, entry.distance))}</p>` : ""}`;
    } else {
      const timed = F.isTimed(ex);
      const weighted = ex.type === "kraft";
      html += `
        <div class="set-grid ${weighted ? "" : "no-weight"}">
          <span class="set-h">Satz</span>
          ${weighted ? `<span class="set-h">kg</span>` : ""}
          <span class="set-h">${timed ? "Sek." : "Wdh."}</span>
          <span class="set-h">RPE</span>
          <span></span>
          ${entry.sets.map((s, si) => `
            <span class="set-no ${s.done ? "on" : ""}">${si + 1}</span>
            ${weighted ? `<input type="text" inputmode="decimal" data-s="${si}" data-f="weight" value="${inVal(s.weight)}" placeholder="kg" aria-label="Gewicht Satz ${si + 1}">` : ""}
            <span class="reps-cell">
              <input type="text" inputmode="numeric" data-s="${si}" data-f="reps" value="${inVal(s.reps)}" aria-label="${timed ? "Sekunden" : "Wiederholungen"} Satz ${si + 1}">
              ${timed && !s.done ? `<button type="button" class="icon-btn small" data-hold="${si}" aria-label="Zeit starten">▶</button>` : ""}
            </span>
            <select data-s="${si}" data-f="rpe" aria-label="Anstrengung Satz ${si + 1}">
              <option value="">–</option>
              ${RPE.map(r => `<option value="${r}" ${s.rpe === r ? "selected" : ""}>${fmt(r, 1)}</option>`).join("")}
            </select>
            <button type="button" class="check ${s.done ? "on" : ""}" data-done="${si}" aria-label="Satz ${si + 1} erledigt">✓</button>
          `).join("")}
        </div>
        <div class="set-actions">
          <button type="button" class="chip-btn" data-act="add-set">+ Satz</button>
          <button type="button" class="chip-btn" data-act="del-set" ${entry.sets.length <= 1 ? "disabled" : ""}>− Satz</button>
          <span class="muted small-text">Pause ${entry.target.rest} s</span>
        </div>`;
    }
    html += `
      <div class="card-foot">
        <button type="button" class="link-btn" data-act="up" ${i === 0 ? "disabled" : ""}>↑</button>
        <button type="button" class="link-btn" data-act="down" ${i === state.active.entries.length - 1 ? "disabled" : ""}>↓</button>
        <span class="grow"></span>
        <button type="button" class="link-btn danger-text" data-act="remove">Übung entfernen</button>
      </div>`;
    card.innerHTML = html;
    wireCard(card, entry, i, ex);
    return card;
  }

  function wireCard(card, entry, i, ex) {
    const act = (name, fn) => { const b = card.querySelector(`[data-act="${name}"]`); if (b) b.onclick = fn; };
    act("info", () => { const h = card.querySelector(".ex-hint"); h.hidden = !h.hidden; });

    // Eingaben speichern ohne neu zu zeichnen (Fokus bleibt erhalten).
    card.querySelectorAll("[data-f]").forEach(inp => {
      inp.onchange = () => {
        const si = Number(inp.dataset.s);
        const field = inp.dataset.f;
        const value = num(inp.value);
        const prev = entry.sets[si][field];
        entry.sets[si][field] = value;
        // Gewicht/Wdh. an die folgenden offenen Sätze weitergeben, wenn sie gleich waren.
        if (field !== "rpe") {
          for (let k = si + 1; k < entry.sets.length; k++) {
            const s = entry.sets[k];
            if (s.done || s[field] !== prev) break;
            s[field] = value;
            const other = card.querySelector(`[data-s="${k}"][data-f="${field}"]`);
            if (other) other.value = inVal(value);
          }
        }
        F.save(state);
      };
    });
    card.querySelectorAll("[data-done]").forEach(b => {
      b.onclick = () => toggleSet(i, Number(b.dataset.done));
    });
    card.querySelectorAll("[data-hold]").forEach(b => {
      b.onclick = () => {
        const si = Number(b.dataset.hold);
        unlockAudio();
        startTimer(entry.sets[si].reps || 30, "work", { entry: i, set: si });
      };
    });
    card.querySelectorAll("[data-c]").forEach(inp => {
      inp.onchange = () => {
        entry[inp.dataset.c] = num(inp.value);
        F.save(state);
        const p = card.querySelector(".pace");
        if (p) p.textContent = pace(entry.duration, entry.distance);
      };
    });
    act("cardio-done", () => {
      entry.done = !entry.done;
      F.save(state);
      replaceCard(i);
    });
    act("add-set", () => {
      const last = entry.sets[entry.sets.length - 1] || {};
      entry.sets.push({ weight: last.weight ?? null, reps: last.reps ?? entry.target.reps, rpe: null, done: false });
      F.save(state);
      replaceCard(i);
    });
    act("del-set", () => {
      entry.sets.pop();
      F.save(state);
      replaceCard(i);
    });
    act("up", () => move(i, -1));
    act("down", () => move(i, 1));
    act("remove", () => {
      const removed = state.active.entries.splice(i, 1)[0];
      F.save(state);
      render();
      App.toast(`${ex.name} entfernt`, () => {
        state.active.entries.splice(i, 0, removed);
        F.save(state);
        render();
      });
    });
  }

  function move(i, dir) {
    const list = state.active.entries;
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    F.save(state);
    render();
  }

  function toggleSet(i, si) {
    const entry = state.active.entries[i];
    const set = entry.sets[si];
    set.done = !set.done;
    if (set.done && set.reps == null) set.reps = entry.target.reps;
    F.save(state);
    replaceCard(i);
    if (!set.done) return;
    unlockAudio();
    const isLast = entry.sets.every(s => s.done) && state.active.entries.slice(i + 1).every(e => e.sets ? e.sets.every(s => s.done) : e.done);
    if (!isLast) startTimer(entry.target.rest || 90, "rest");
    else stopRest();
  }

  // ---------- Pausen- und Halte-Timer ----------

  function startTimer(seconds, mode, ref = null) {
    state.active.rest = { end: Date.now() + seconds * 1000, total: seconds, mode, ref };
    F.save(state);
    runRest();
  }

  function runRest() {
    clearInterval(restTimer);
    clearTimeout(restDoneTimer);
    restBar.hidden = false;
    restBar.classList.remove("finished");
    restBar.classList.toggle("work", state.active.rest.mode === "work");
    restLabel.textContent = state.active.rest.mode === "work" ? "Halten" : "Pause";
    tickRest();
    restTimer = setInterval(tickRest, 250);
  }

  function tickRest() {
    const r = state.active && state.active.rest;
    if (!r) return stopRest();
    const left = (r.end - Date.now()) / 1000;
    if (left <= 0) return finishRest();
    restTime.textContent = duration(Math.ceil(left));
    restFill.style.width = `${Math.max(0, left / r.total) * 100}%`;
  }

  function finishRest() {
    const r = state.active.rest;
    clearInterval(restTimer);
    state.active.rest = null;
    if (r.mode === "work" && r.ref) {
      const set = state.active.entries[r.ref.entry]?.sets[r.ref.set];
      if (set && !set.done) {
        F.save(state);
        toggleSet(r.ref.entry, r.ref.set);
        beep(2);
        return;
      }
    }
    F.save(state);
    beep(3);
    restBar.classList.add("finished");
    restLabel.textContent = "Weiter geht's!";
    restTime.textContent = "💪";
    restFill.style.width = "0";
    restDoneTimer = setTimeout(() => { restBar.hidden = true; }, 4000);
  }

  function stopRest() {
    clearInterval(restTimer);
    clearTimeout(restDoneTimer);
    restBar.hidden = true;
    if (state.active && state.active.rest) {
      state.active.rest = null;
      F.save(state);
    }
  }

  function adjustRest(delta) {
    const r = state.active && state.active.rest;
    if (!r) return;
    r.end += delta * 1000;
    r.total = Math.max(r.total + delta, 1);
    F.save(state);
    tickRest();
  }

  function unlockAudio() {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === "suspended") audioCtx.resume();
    } catch { audioCtx = null; }
  }

  function beep(times) {
    // Vibrieren erst nach einer Berührung erlaubt (z. B. nicht direkt nach dem Neuladen).
    const touched = !navigator.userActivation || navigator.userActivation.hasBeenActive;
    if (navigator.vibrate && touched) navigator.vibrate(Array.from({ length: times * 2 - 1 }, (_, k) => (k % 2 ? 120 : 250)));
    if (!audioCtx) return;
    for (let k = 0; k < times; k++) {
      const t = audioCtx.currentTime + k * 0.35;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.frequency.value = k === times - 1 ? 1175 : 880;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.4, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(t);
      osc.stop(t + 0.3);
    }
  }

  // Bildschirm während des Trainings anlassen (wo unterstützt).
  async function requestWakeLock() {
    try {
      if ("wakeLock" in navigator && !wakeLock) {
        wakeLock = await navigator.wakeLock.request("screen");
        wakeLock.addEventListener("release", () => { wakeLock = null; });
      }
    } catch { wakeLock = null; }
  }

  function releaseWakeLock() {
    if (wakeLock) wakeLock.release().catch(() => {});
    wakeLock = null;
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden || liveEl.hidden || !state.active) return;
    requestWakeLock();
    tickClock();
    if (state.active.rest) tickRest();
  });

  // ---------- Beenden ----------

  function finish() {
    const a = state.active;
    const doneSets = a.entries.reduce((n, e) => n + (e.sets ? e.sets.filter(s => s.done).length : 0), 0);
    const doneCardio = a.entries.filter(e => !e.sets && e.done).length;
    const volume = a.entries.reduce((v, e) => v + (e.sets || []).filter(s => s.done).reduce((x, s) => x + (s.weight || 0) * (s.reps || 0), 0), 0);
    const elapsedMin = Math.max(1, Math.round((Date.now() - a.startedAt) / 60000));

    App.sheet("Training beenden", (body, close) => {
      body.innerHTML = `
        <div class="finish-stats">
          <div><strong>${doneSets}</strong><span>Sätze</span></div>
          <div><strong>${doneCardio}</strong><span>Cardio</span></div>
          <div><strong>${fmt(volume)}</strong><span>kg Volumen</span></div>
        </div>
        ${!doneSets && !doneCardio ? `<p class="warn-text">Noch nichts abgehakt – nur erledigte Sätze zählen für Statistik und Steigerung.</p>` : ""}
        <div class="form-grid">
          <label class="field">Datum<input type="date" id="finDate" value="${a.date}" max="${F.todayKey()}"></label>
          <label class="field">Beginn<input type="time" id="finStart" value="${a.start}"></label>
          <label class="field">Dauer (Min.)<input type="text" inputmode="numeric" id="finDur" value="${elapsedMin}"></label>
          <label class="field">Verbrauch<output id="finKcal" class="out">–</output></label>
        </div>
        <label class="field">Notiz (Befinden, Energie, Schmerzen …)
          <textarea id="finNote" rows="3" maxlength="600" placeholder="Optional…">${esc(a.userNote || "")}</textarea>
        </label>
        <div class="sheet-actions">
          <button type="button" class="danger-btn" data-act="discard">Verwerfen</button>
          <span class="grow"></span>
          <button type="button" class="ghost-btn" data-act="back">Zurück</button>
          <button type="button" class="primary-btn" data-act="save">Speichern</button>
        </div>`;
      const dateIn = body.querySelector("#finDate");
      const startIn = body.querySelector("#finStart");
      const durIn = body.querySelector("#finDur");
      const noteIn = body.querySelector("#finNote");
      const kcalOut = body.querySelector("#finKcal");

      const draft = () => ({
        id: a.id,
        workoutId: a.workoutId,
        name: a.name,
        date: dateIn.value || a.date,
        start: startIn.value || a.start,
        durationSec: Math.max(1, num(durIn.value) || elapsedMin) * 60,
        note: noteIn.value.trim(),
        entries: a.entries.map(e => e.sets
          ? { exerciseId: e.exerciseId, target: e.target, sets: e.sets.map(s => ({ weight: s.weight, reps: s.reps, rpe: s.rpe, done: s.done })) }
          : { exerciseId: e.exerciseId, target: e.target, duration: e.duration, distance: e.distance, done: e.done }),
      });
      const updateKcal = () => {
        const kcal = F.sessionKcal(state, draft());
        kcalOut.textContent = kcal ? `ca. ${kcal} kcal` : "– (Gewicht fehlt)";
      };
      [dateIn, durIn].forEach(el => { el.oninput = updateKcal; });
      noteIn.oninput = () => { a.userNote = noteIn.value; };
      updateKcal();

      body.querySelector('[data-act="back"]').onclick = close;
      body.querySelector('[data-act="discard"]').onclick = () => {
        App.confirmSheet("Training verwerfen?", "Alle Eingaben dieses Trainings gehen verloren.", "Verwerfen", () => {
          close();
          end(null);
        });
      };
      body.querySelector('[data-act="save"]').onclick = () => {
        const session = draft();
        session.kcal = F.sessionKcal(state, session);
        close();
        end(session);
      };
    });
  }

  function end(session) {
    const records = session ? newRecords(session) : [];
    stopRest();
    state.active = null;
    if (session) state.sessions.push(session);
    F.save(state);
    hide();
    App.show("heute");
    if (session) {
      App.toast(records.length ? `🏆 Neuer Rekord: ${records.join(", ")}` : "Training gespeichert 💪");
    }
  }

  // Übungen, bei denen das geschätzte Maximalgewicht (1RM) neu ist.
  function newRecords(session) {
    const out = [];
    for (const e of session.entries) {
      const ex = F.exerciseById(state, e.exerciseId);
      if (ex.type !== "kraft" || !e.sets) continue;
      const best = Math.max(0, ...e.sets.filter(s => s.done).map(s => F.e1rm(s.weight, s.reps)));
      if (!best) continue;
      let prev = 0;
      for (const s of state.sessions) {
        for (const pe of s.entries) {
          if (pe.exerciseId !== e.exerciseId || !pe.sets) continue;
          for (const ps of pe.sets) if (ps.done) prev = Math.max(prev, F.e1rm(ps.weight, ps.reps));
        }
      }
      if (prev && best > prev) out.push(ex.name);
    }
    return out;
  }

  document.getElementById("liveMinimize").onclick = hide;
  document.getElementById("liveFinish").onclick = finish;
  document.getElementById("restMinus").onclick = () => adjustRest(-15);
  document.getElementById("restPlus").onclick = () => adjustRest(15);
  document.getElementById("restSkip").onclick = () => {
    const r = state.active && state.active.rest;
    if (r && r.mode === "work" && r.ref) {
      stopRest();
      toggleSet(r.ref.entry, r.ref.set);
    } else {
      stopRest();
    }
  };

  return { start, startFree, chooseWorkout, open, resume, renderIfOpen, addExercise };
})();
