// Tab „Körper“: Gewicht, Körperfett, BMI, Schritte, Wasser, Schlaf.
const Koerper = (function () {
  let day = null;

  const FIELDS = {
    weight: { label: "Gewicht", unit: "kg", icon: "⚖️", mode: "decimal", min: 25, max: 350 },
    bodyFat: { label: "Körperfett", unit: "%", icon: "📐", mode: "decimal", min: 2, max: 70 },
    steps: { label: "Schritte", unit: "", icon: "👟", mode: "numeric", min: 0, max: 150000 },
    water: { label: "Wasser", unit: "ml", icon: "💧", mode: "numeric", min: 0, max: 15000 },
    sleep: { label: "Schlaf", unit: "h", icon: "😴", mode: "decimal", min: 0, max: 24 },
  };

  function setValue(key, field, value) {
    const def = FIELDS[field];
    if (value != null && (value < def.min || value > def.max)) {
      App.toast(`${def.label}: Wert zwischen ${fmt(def.min)} und ${fmt(def.max)} eingeben`);
      App.render();
      return;
    }
    const entry = state.body[key] || {};
    if (value == null) delete entry[field];
    else entry[field] = field === "steps" || field === "water" ? Math.round(value) : F.round(value, 1);
    if (Object.keys(entry).length) state.body[key] = entry;
    else delete state.body[key];
    App.commit();
  }

  function addWater(key, ml) {
    const current = (state.body[key] && state.body[key].water) || 0;
    setValue(key, "water", Math.max(0, current + ml));
  }

  function render(root) {
    if (!day) day = F.todayKey();
    root.innerHTML = "";
    root.appendChild(dayNav(day, k => { day = k; App.render(); }));
    root.appendChild(entryCard());
    root.appendChild(goalCard());
    root.appendChild(historyCard());
  }

  function entryCard() {
    const card = document.createElement("div");
    card.className = "card";
    const e = state.body[day] || {};
    const p = state.profile;
    const goals = { steps: p.stepGoal, water: p.waterGoal, sleep: p.sleepGoal };
    card.innerHTML = `
      <div class="card-head"><h2>Werte ${day === F.todayKey() ? "von heute" : `vom ${dateShort(day)}`}</h2></div>
      <div class="body-fields">
        ${Object.entries(FIELDS).map(([k, d]) => `
          <label class="body-field">
            <span class="bf-label">${d.icon} ${d.label}</span>
            <span class="quick-input">
              <input type="text" inputmode="${d.mode}" data-field="${k}" value="${inVal(e[k])}" placeholder="–">
              <span class="unit">${d.unit}</span>
            </span>
            ${goals[k] ? `<span class="bf-goal">${progressBar(e[k] || 0, goals[k], k === "water" ? "bar-water" : "")}<small class="muted">Ziel ${fmt(goals[k], 1)} ${d.unit}</small></span>` : ""}
          </label>`).join("")}
      </div>
      <div class="water-btns">
        <button type="button" class="chip-btn" data-water="-250">− 250 ml</button>
        <button type="button" class="chip-btn" data-water="250">+ Glas (250 ml)</button>
        <button type="button" class="chip-btn" data-water="500">+ Flasche (500 ml)</button>
      </div>`;
    card.querySelectorAll("[data-field]").forEach(inp => {
      inp.onchange = () => setValue(day, inp.dataset.field, num(inp.value));
    });
    card.querySelectorAll("[data-water]").forEach(b => {
      b.onclick = () => addWater(day, Number(b.dataset.water));
    });
    return card;
  }

  // BMI-Skala 15–40 mit Markierung.
  function bmiScale(value) {
    const pos = Math.min(100, Math.max(0, (value - 15) / 25 * 100));
    return `
      <div class="bmi-scale" aria-hidden="true">
        <span style="flex:3.5" class="z1"></span><span style="flex:6.5" class="z2"></span><span style="flex:5" class="z3"></span><span style="flex:10" class="z4"></span>
        <i style="left:${pos}%"></i>
      </div>
      <div class="bmi-legend"><span>18,5</span><span>25</span><span>30</span></div>`;
  }

  function goalCard() {
    const card = document.createElement("div");
    card.className = "card";
    const p = state.profile;
    const w = F.latestBody(state, "weight", day);
    const first = Object.keys(state.body).filter(k => state.body[k].weight != null).sort()[0];
    const startWeight = first ? state.body[first].weight : null;
    const bmi = w ? F.bmi(w.value, p.height) : null;
    const fat = F.latestBody(state, "bodyFat", day);

    let goalHtml = `<p class="muted">Lege im Profil ein Zielgewicht fest, um deinen Fortschritt zu sehen.</p>`;
    if (w && p.goalWeight) {
      const total = startWeight - p.goalWeight;
      const doneKg = startWeight - w.value;
      const left = w.value - p.goalWeight;
      const pct = total > 0 ? Math.min(100, Math.max(0, doneKg / total * 100)) : (left <= 0 ? 100 : 0);
      goalHtml = `
        <div class="goal-line">
          <span>Start <strong>${fmt(startWeight, 1)}</strong></span>
          <span>Jetzt <strong>${fmt(w.value, 1)}</strong></span>
          <span>Ziel <strong>${fmt(p.goalWeight, 1)}</strong></span>
        </div>
        <div class="bar bar-goal"><span style="width:${pct}%"></span></div>
        <p class="small-text">${left > 0 ? `Noch <strong>${fmt(left, 1)} kg</strong> bis zum Ziel – ${eta(left)}` : "🎉 Ziel erreicht!"}</p>`;
    }

    card.innerHTML = `
      <div class="card-head"><h2>Ziel & BMI</h2></div>
      ${goalHtml}
      <div class="stat-row">
        <div class="stat-tile">
          <span class="stat-label">BMI</span>
          <span class="stat-value">${bmi ? fmt(bmi, 1) : "–"}</span>
          <span class="stat-sub">${bmi ? F.bmiCategory(bmi) : "Gewicht und Größe nötig"}</span>
        </div>
        <div class="stat-tile">
          <span class="stat-label">Körperfett</span>
          <span class="stat-value">${fat ? `${fmt(fat.value, 1)} %` : "–"}</span>
          <span class="stat-sub">${fat ? `gemessen ${relDay(fat.date)}` : "optional, z. B. Waage"}</span>
        </div>
      </div>
      ${bmi ? bmiScale(bmi) : ""}
      <p class="muted small-text">Der BMI ist nur ein grober Richtwert und berücksichtigt keine Muskelmasse.</p>`;
    return card;
  }

  // Prognose aus dem Verlauf der letzten 4 Wochen, sonst mit 0,5 kg/Woche.
  function eta(left) {
    const today = F.todayKey();
    const now = F.latestBody(state, "weight", today);
    const before = F.latestBody(state, "weight", F.addDays(today, -28));
    let perWeek = 0.5;
    let basis = "bei 0,5 kg pro Woche";
    if (now && before && before.date < now.date) {
      const days = (F.parseKey(now.date) - F.parseKey(before.date)) / 86400000;
      const rate = (before.value - now.value) / days * 7;
      if (days >= 14 && rate > 0.05) {
        perWeek = rate;
        basis = `bei deinem Tempo (${fmt(rate, 2)} kg/Woche)`;
      }
    }
    const weeks = Math.ceil(left / perWeek);
    const date = F.parseKey(F.addDays(today, weeks * 7));
    return `${basis} etwa im ${MONTHS[date.getMonth()]} ${date.getFullYear()}.`;
  }

  function historyCard() {
    const card = document.createElement("div");
    card.className = "card";
    const keys = Object.keys(state.body).sort().reverse().slice(0, 14);
    card.innerHTML = `
      <div class="card-head"><h2>Letzte Einträge</h2></div>
      ${keys.length ? `
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Tag</th><th>kg</th><th>KF %</th><th>Schritte</th><th>Wasser</th><th>Schlaf</th></tr></thead>
          <tbody>
            ${keys.map(k => {
              const e = state.body[k];
              return `<tr data-day="${esc(k)}" class="${k === day ? "sel" : ""}">
                <td>${esc(relDay(k))}</td>
                <td>${fmt(e.weight, 1)}</td>
                <td>${fmt(e.bodyFat, 1)}</td>
                <td>${fmt(e.steps)}</td>
                <td>${e.water != null ? `${fmt(e.water / 1000, 2)} l` : "–"}</td>
                <td>${e.sleep != null ? `${fmt(e.sleep, 1)} h` : "–"}</td>
              </tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>
      <p class="muted small-text">Zeile antippen, um den Tag zu bearbeiten.</p>` : `<p class="muted">Noch keine Einträge.</p>`}`;
    card.querySelectorAll("[data-day]").forEach(tr => {
      tr.onclick = () => { day = tr.dataset.day; App.render(); window.scrollTo({ top: 0, behavior: "smooth" }); };
    });
    return card;
  }

  App.view("koerper", { render });
  return { setValue, addWater };
})();
