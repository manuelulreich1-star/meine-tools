// Einstellungen: Profil (für Kalorienbedarf), Tagesziele, eigene Übungen, Daten.
const Einstellungen = (function () {
  function open() {
    App.sheet("Einstellungen", (body, close) => {
      const p = state.profile;
      const tdee = F.tdee(state);
      body.innerHTML = `
        <div class="pick-list">
          <button type="button" class="pick-item" data-act="profile">
            <strong>👤 Profil & Kalorienziel</strong>
            <small class="muted">${tdee ? `Bedarf ca. ${fmt(tdee)} kcal · Ziel ${fmt(F.kcalTarget(state, F.todayKey()))} kcal` : "Angaben unvollständig"}</small>
          </button>
          <button type="button" class="pick-item" data-act="goals">
            <strong>🎯 Tagesziele</strong>
            <small class="muted">${fmt(p.stepGoal)} Schritte · ${fmt(p.waterGoal / 1000, 1)} l Wasser · ${fmt(p.sleepGoal, 1)} h Schlaf</small>
          </button>
          <button type="button" class="pick-item" data-act="exercises">
            <strong>🏋️ Übungen</strong>
            <small class="muted">${F.exercises(state).length} Übungen, davon ${state.customExercises.length} eigene</small>
          </button>
          <button type="button" class="pick-item" data-act="foods">
            <strong>🥫 Lebensmittel</strong>
            <small class="muted">${F.foods(state).length} Einträge</small>
          </button>
          <button type="button" class="pick-item" data-act="templates">
            <strong>📋 Plan-Vorlagen</strong>
            <small class="muted">Push/Pull/Beine, Heimtraining, Lauf-Einsteiger</small>
          </button>
        </div>
        <p class="muted small-text">${window.Sync && Sync.status.state !== "off" && Sync.status.state !== "unconfigured"
          ? "Deine Daten liegen in diesem Browser und werden über deinen Google-Drive-App-Ordner abgeglichen."
          : "Deine Daten liegen nur in diesem Browser auf diesem Gerät."}</p>
        <button type="button" class="danger-btn" data-act="reset">Alle Fitnessdaten löschen</button>`;
      const on = (act, fn) => { body.querySelector(`[data-act="${act}"]`).onclick = fn; };
      on("profile", () => openProfile());
      on("goals", openGoals);
      on("exercises", openExercises);
      on("foods", () => Ernaehrung.manageFoods());
      on("templates", () => Plan.openTemplates());
      on("reset", () => App.confirmSheet(
        "Alle Fitnessdaten löschen?",
        "Profil, Pläne, Trainings, Körperwerte und Ernährung werden unwiderruflich gelöscht – bei aktivem Sync auch auf deinen anderen Geräten.",
        "Endgültig löschen",
        () => {
          localStorage.removeItem(F.STORAGE_KEY);
          state = F.load();
          close();
          Training.renderIfOpen();
          App.show("heute");
          onboarding();
        }));
    });
  }

  function onboarding() {
    openProfile(true);
  }

  function openProfile(welcome = false) {
    App.sheet(welcome ? "Willkommen beim Fitnessplaner 👋" : "Profil & Kalorienziel", (body, close) => {
      const p = state.profile;
      const weight = F.currentWeight(state);
      body.innerHTML = `
        ${welcome ? `<p class="muted">Ein paar Angaben, damit Kalorienbedarf, BMI und Makroziele stimmen. Du kannst alles später unter ⚙️ ändern.</p>` : ""}
        <div class="form-grid">
          <label class="field">Geschlecht
            <select id="pSex">
              <option value="m" ${p.sex === "m" ? "selected" : ""}>männlich</option>
              <option value="w" ${p.sex === "w" ? "selected" : ""}>weiblich</option>
            </select>
          </label>
          <label class="field">Geburtsjahr<input type="text" inputmode="numeric" id="pBirth" value="${inVal(p.birthYear)}" placeholder="z. B. 1995"></label>
          <label class="field">Größe (cm)<input type="text" inputmode="numeric" id="pHeight" value="${inVal(p.height)}" placeholder="z. B. 180"></label>
          <label class="field">Aktuelles Gewicht (kg)<input type="text" inputmode="decimal" id="pWeight" value="${inVal(weight)}" placeholder="z. B. 85,5"></label>
          <label class="field">Zielgewicht (kg)<input type="text" inputmode="decimal" id="pGoal" value="${inVal(p.goalWeight)}" placeholder="z. B. 78"></label>
          <label class="field">Kaloriendefizit
            <select id="pDeficit">
              ${[[0, "Kein Defizit (halten)"], [250, "250 kcal (~0,25 kg/Woche)"], [500, "500 kcal (~0,5 kg/Woche)"], [750, "750 kcal (~0,75 kg/Woche)"]]
                .map(([v, l]) => `<option value="${v}" ${p.deficit === v ? "selected" : ""}>${l}</option>`).join("")}
            </select>
          </label>
        </div>
        <label class="field">Alltag (ohne Training – das wird extra gerechnet)
          <select id="pActivity">
            ${Object.entries(F.ACTIVITY).map(([k, a]) => `<option value="${k}" ${p.activity === k ? "selected" : ""}>${a.label}</option>`).join("")}
          </select>
        </label>
        <label class="field">Festes Kalorienziel (optional, ersetzt die Berechnung)
          <input type="text" inputmode="numeric" id="pOverride" value="${inVal(p.kcalOverride)}" placeholder="leer = automatisch">
        </label>
        <div id="pPreview" class="preview"></div>
        <p class="muted small-text">Berechnung nach Mifflin-St Jeor. Das sind Schätzwerte – bei gesundheitlichen Fragen ärztlich beraten lassen.</p>
        <div class="sheet-actions">
          ${welcome ? `<button type="button" class="ghost-btn" data-act="later">Später</button>` : ""}
          <span class="grow"></span>
          <button type="button" class="primary-btn" data-act="save">${welcome ? "Los geht's" : "Speichern"}</button>
        </div>`;

      const val = id => body.querySelector(id).value;
      const read = () => ({
        sex: val("#pSex"),
        birthYear: num(val("#pBirth")),
        height: num(val("#pHeight")),
        goalWeight: num(val("#pGoal")),
        deficit: Number(val("#pDeficit")),
        activity: val("#pActivity"),
        kcalOverride: num(val("#pOverride")),
        weight: num(val("#pWeight")),
      });
      const preview = body.querySelector("#pPreview");
      const update = () => {
        const d = read();
        const age = d.birthYear ? new Date().getFullYear() - d.birthYear : null;
        if (!d.weight || !d.height || !age) {
          preview.innerHTML = `<span class="muted">Geburtsjahr, Größe und Gewicht ergeben deinen Bedarf.</span>`;
          return;
        }
        const bmr = 10 * d.weight + 6.25 * d.height - 5 * age + (d.sex === "w" ? -161 : 5);
        const tdee = bmr * F.ACTIVITY[d.activity].factor;
        const target = d.kcalOverride || tdee - d.deficit;
        const bmi = F.bmi(d.weight, d.height);
        preview.innerHTML = `
          <span>Grundumsatz <strong>${fmt(bmr)}</strong></span>
          <span>Bedarf <strong>${fmt(tdee)}</strong></span>
          <span>Tagesziel <strong>${fmt(target)} kcal</strong> + Training</span>
          <span>BMI <strong>${fmt(bmi, 1)}</strong> (${F.bmiCategory(bmi)})</span>`;
      };
      body.querySelectorAll("input, select").forEach(i => { i.oninput = update; });
      update();

      const later = body.querySelector('[data-act="later"]');
      if (later) later.onclick = close;
      body.querySelector('[data-act="save"]').onclick = () => {
        const d = read();
        const year = new Date().getFullYear();
        if (d.birthYear != null && (d.birthYear < year - 100 || d.birthYear > year - 10)) return App.toast("Bitte ein gültiges Geburtsjahr eingeben");
        if (d.height != null && (d.height < 100 || d.height > 250)) return App.toast("Größe bitte in cm (100–250)");
        if (d.weight != null && (d.weight < 25 || d.weight > 350)) return App.toast("Bitte ein gültiges Gewicht eingeben");
        if (d.goalWeight != null && (d.goalWeight < 25 || d.goalWeight > 350)) return App.toast("Bitte ein gültiges Zielgewicht eingeben");
        const { weight, ...profile } = d;
        Object.assign(state.profile, profile, { setupDone: true });
        if (weight != null && weight !== F.currentWeight(state)) {
          const today = F.todayKey();
          state.body[today] = { ...(state.body[today] || {}), weight: F.round(weight, 1) };
        }
        close();
        App.commit();
        if (welcome && !state.workouts.length) Plan.openTemplates();
      };
    });
  }

  function openGoals() {
    App.sheet("Tagesziele", (body, close) => {
      const p = state.profile;
      body.innerHTML = `
        <div class="form-grid">
          <label class="field">Schritte<input type="text" inputmode="numeric" id="gSteps" value="${inVal(p.stepGoal)}"></label>
          <label class="field">Wasser (ml)<input type="text" inputmode="numeric" id="gWater" value="${inVal(p.waterGoal)}"></label>
          <label class="field">Schlaf (Stunden)<input type="text" inputmode="decimal" id="gSleep" value="${inVal(p.sleepGoal)}"></label>
        </div>
        <div class="sheet-actions">
          <span class="grow"></span>
          <button type="button" class="primary-btn" data-act="save">Speichern</button>
        </div>`;
      body.querySelector('[data-act="save"]').onclick = () => {
        p.stepGoal = num(body.querySelector("#gSteps").value) || 8000;
        p.waterGoal = num(body.querySelector("#gWater").value) || 2500;
        p.sleepGoal = num(body.querySelector("#gSleep").value) || 8;
        close();
        App.commit();
      };
    });
  }

  function openExercises() {
    App.sheet("Übungen", (body) => {
      const draw = () => {
        const groups = {};
        for (const e of F.exercises(state)) (groups[e.group] = groups[e.group] || []).push(e);
        body.innerHTML = `
          <button type="button" class="primary-btn wide" data-act="new">+ Eigene Übung anlegen</button>
          ${Object.entries(groups).map(([g, list]) => `
            <h3 class="group-title">${esc(g)}</h3>
            <div class="pick-list">
              ${list.map(e => `
                <${e.custom ? "button type=\"button\"" : "div"} class="pick-item ${e.custom ? "" : "static"}" ${e.custom ? `data-ex="${esc(e.id)}"` : ""}>
                  <strong>${esc(e.name)}${e.custom ? ` <span class="pill small">eigene</span>` : ""}</strong>
                  <small class="muted">${Plan.typeLabel(e)}${e.hint ? ` · ${esc(e.hint)}` : ""}</small>
                </${e.custom ? "button" : "div"}>`).join("")}
            </div>`).join("")}`;
        body.querySelector('[data-act="new"]').onclick = () => Plan.editExercise(null, draw);
        body.querySelectorAll("[data-ex]").forEach(b => {
          b.onclick = () => Plan.editExercise(b.dataset.ex, draw);
        });
      };
      draw();
    });
  }

  return { open, onboarding, openProfile };
})();
