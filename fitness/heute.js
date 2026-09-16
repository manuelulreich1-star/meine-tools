// Tab „Heute“: geplante Trainings, Tagesbilanz und schnelle Eingaben.
App.view("heute", {
  render(root) {
    const today = F.todayKey();
    root.innerHTML = "";

    const head = document.createElement("p");
    head.className = "view-sub";
    head.textContent = dateLong(today);
    root.appendChild(head);

    if (state.active) root.appendChild(activeBanner());
    root.appendChild(trainingCard(today));
    root.appendChild(balanceCard(today));
    root.appendChild(quickBodyCard(today));
  },
});

function activeBanner() {
  const a = state.active;
  const el = document.createElement("button");
  el.type = "button";
  el.className = "active-banner";
  const doneSets = a.entries.reduce((n, e) => n + (e.sets ? e.sets.filter(s => s.done).length : e.done ? 1 : 0), 0);
  el.innerHTML = `
    <span class="pulse-dot"></span>
    <span class="grow"><strong>${esc(a.name)} läuft</strong><br><small>${doneSets} Sätze erledigt · seit ${esc(a.start)}</small></span>
    <span class="chev">Fortsetzen ›</span>`;
  el.onclick = () => Training.open();
  return el;
}

function trainingCard(today) {
  const card = document.createElement("div");
  card.className = "card";
  const planned = F.plannedOn(state, today);
  const sessions = F.sessionsOn(state, today);
  const progress = F.weekProgress(state, today);

  let html = `<div class="card-head"><h2>Training</h2><span class="pill">Woche ${progress.done}/${progress.planned || "–"}</span></div>`;

  if (!state.workouts.length) {
    html += `
      <p class="muted">Noch kein Trainingsplan angelegt. Starte mit einer Vorlage oder baue deine eigenen Einheiten.</p>
      <div class="row-actions">
        <button type="button" class="primary-btn" data-act="templates">Vorlage wählen</button>
        <button type="button" class="ghost-btn" data-act="plan">Zum Plan</button>
      </div>`;
  } else {
    if (!planned.length) {
      html += `<p class="rest-day">😌 Heute ist Ruhetag${sessions.length ? "" : " – Erholung gehört dazu."}</p>`;
    }
    for (const p of planned) {
      const done = sessions.find(s => s.workoutId === p.workoutId);
      html += workoutRow(p.workout, p.time, done);
    }
    for (const s of sessions.filter(s => !planned.some(p => p.workoutId === s.workoutId))) {
      html += doneRow(s);
    }
    html += `<button type="button" class="link-btn" data-act="other">+ Anderes Training starten oder nachtragen</button>`;
  }
  card.innerHTML = html;

  card.querySelectorAll("[data-start]").forEach(b => {
    b.onclick = () => Training.start(b.dataset.start);
  });
  card.querySelectorAll("[data-session]").forEach(b => {
    b.onclick = () => Statistik.showSession(b.dataset.session);
  });
  const on = (act, fn) => { const b = card.querySelector(`[data-act="${act}"]`); if (b) b.onclick = fn; };
  on("templates", () => Plan.openTemplates());
  on("plan", () => App.show("plan"));
  on("other", () => Training.chooseWorkout());
  on("resume", () => Training.open());
  return card;
}

function workoutRow(workout, time, doneSession) {
  const minutes = F.workoutMinutes(state, workout);
  const names = workout.items.slice(0, 4).map(i => F.exerciseById(state, i.exerciseId).name);
  const more = workout.items.length > 4 ? ` +${workout.items.length - 4}` : "";
  const running = state.active && state.active.workoutId === workout.id;
  let action;
  if (doneSession) {
    action = `<button type="button" class="done-badge" data-session="${esc(doneSession.id)}">✓ Erledigt</button>`;
  } else if (running) {
    action = `<button type="button" class="primary-btn" data-act="resume">Fortsetzen</button>`;
  } else {
    action = `<button type="button" class="primary-btn" data-start="${esc(workout.id)}"${state.active ? " disabled" : ""}>Starten</button>`;
  }
  return `
    <div class="workout-row color-${esc(workout.color)}${doneSession ? " is-done" : ""}">
      <div class="grow">
        <strong>${esc(workout.name)}</strong>
        <small class="muted">${time ? `${esc(time)} · ` : ""}${workout.items.length} Übungen · ca. ${minutes} Min.</small>
        <small class="muted ellipsis">${esc(names.join(", "))}${more}</small>
        ${doneSession ? `<small class="ok-text">${fmt(doneSession.durationSec / 60)} Min.${doneSession.kcal ? ` · ca. ${doneSession.kcal} kcal` : ""}</small>` : ""}
      </div>
      ${action}
    </div>`;
}

function doneRow(s) {
  const w = F.workoutById(state, s.workoutId);
  return `
    <div class="workout-row color-${esc(w ? w.color : "green")} is-done">
      <div class="grow">
        <strong>${esc(s.name)}</strong>
        <small class="ok-text">${fmt(s.durationSec / 60)} Min.${s.kcal ? ` · ca. ${s.kcal} kcal` : ""}</small>
      </div>
      <button type="button" class="done-badge" data-session="${esc(s.id)}">✓ Erledigt</button>
    </div>`;
}

function balanceCard(today) {
  const card = document.createElement("div");
  card.className = "card";
  const target = F.kcalTarget(state, today);
  const eaten = F.mealTotals(state, today);
  const training = F.trainingKcal(state, today);

  if (target == null) {
    card.innerHTML = `
      <div class="card-head"><h2>Kalorien</h2></div>
      <p class="muted">Für dein Tagesziel fehlen noch Angaben im Profil (Größe, Geburtsjahr, Gewicht).</p>
      <button type="button" class="ghost-btn">Profil ergänzen</button>`;
    card.querySelector("button").onclick = () => Einstellungen.openProfile();
    return card;
  }

  const left = target - eaten.kcal;
  const macros = F.macroTargets(state, today);
  card.innerHTML = `
    <div class="card-head"><h2>Kalorien</h2><button type="button" class="link-btn" data-act="food">+ Essen</button></div>
    <div class="kcal-hero">
      <div>
        <span class="hero-num ${left < 0 ? "bad-text" : ""}">${fmt(Math.abs(left))}</span>
        <span class="hero-unit">kcal ${left < 0 ? "über Ziel" : "übrig"}</span>
      </div>
      <div class="kcal-mini">
        <span>Ziel <strong>${fmt(target)}</strong></span>
        <span>Gegessen <strong>${fmt(eaten.kcal)}</strong></span>
        <span>Training <strong>+${fmt(training)}</strong></span>
      </div>
    </div>
    ${progressBar(eaten.kcal, target, "bar-kcal")}
    <div class="macro-grid">
      ${macroCell("Eiweiß", eaten.protein, macros.protein)}
      ${macroCell("Kohlenh.", eaten.carbs, macros.carbs)}
      ${macroCell("Fett", eaten.fat, macros.fat)}
    </div>`;
  card.querySelector('[data-act="food"]').onclick = () => App.show("ernaehrung");
  return card;
}

function macroCell(label, value, target) {
  return `
    <div class="macro">
      <span class="macro-label">${label}</span>
      <span class="macro-val"><strong>${fmt(value)}</strong> / ${fmt(target)} g</span>
      ${progressBar(value, target)}
    </div>`;
}

function quickBodyCard(today) {
  const card = document.createElement("div");
  card.className = "card";
  const entry = state.body[today] || {};
  const p = state.profile;
  const water = entry.water || 0;
  card.innerHTML = `
    <div class="card-head"><h2>Körper & Alltag</h2><button type="button" class="link-btn" data-act="body">Details ›</button></div>
    <div class="quick-grid">
      <label class="quick ${entry.weight == null ? "needs" : ""}">
        <span>⚖️ Gewicht</span>
        <span class="quick-input"><input type="text" inputmode="decimal" data-field="weight" value="${inVal(entry.weight)}" placeholder="–"> kg</span>
      </label>
      <label class="quick">
        <span>👟 Schritte</span>
        <span class="quick-input"><input type="text" inputmode="numeric" data-field="steps" value="${inVal(entry.steps)}" placeholder="–"></span>
        ${progressBar(entry.steps || 0, p.stepGoal)}
      </label>
      <label class="quick">
        <span>😴 Schlaf</span>
        <span class="quick-input"><input type="text" inputmode="decimal" data-field="sleep" value="${inVal(entry.sleep)}" placeholder="–"> h</span>
        ${progressBar(entry.sleep || 0, p.sleepGoal)}
      </label>
      <div class="quick">
        <span>💧 Wasser</span>
        <span class="quick-input"><strong>${fmt(water / 1000, 2)}</strong> / ${fmt(p.waterGoal / 1000, 1)} l</span>
        ${progressBar(water, p.waterGoal, "bar-water")}
        <div class="water-btns">
          <button type="button" class="chip-btn" data-water="-250" aria-label="250 ml weniger">−</button>
          <button type="button" class="chip-btn" data-water="250">+250 ml</button>
          <button type="button" class="chip-btn" data-water="500">+500</button>
        </div>
      </div>
    </div>`;
  card.querySelector('[data-act="body"]').onclick = () => App.show("koerper");
  card.querySelectorAll("[data-field]").forEach(inp => {
    inp.onchange = () => Koerper.setValue(today, inp.dataset.field, num(inp.value));
  });
  card.querySelectorAll("[data-water]").forEach(b => {
    b.onclick = () => Koerper.addWater(today, Number(b.dataset.water));
  });
  return card;
}
