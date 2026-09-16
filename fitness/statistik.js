// Tab „Statistik“: Kennzahlen, Gewichtsverlauf, Trainingstage, Kraftfortschritt, Kalorienbilanz, Verlauf.
const Statistik = (function () {
  const RANGES = [
    { id: 30, label: "30 Tage" },
    { id: 90, label: "3 Monate" },
    { id: 365, label: "1 Jahr" },
    { id: 0, label: "Alles" },
  ];
  let range = 90;
  let exerciseId = null;
  const tables = { weight: false, kcal: false };

  function fromKey() {
    return range ? F.addDays(F.todayKey(), -(range - 1)) : "0000-00-00";
  }

  function render(root) {
    Charts.hideTip();
    root.innerHTML = "";
    const filter = document.createElement("div");
    filter.className = "chip-row filter-row";
    filter.innerHTML = RANGES.map(r => `<button type="button" class="chip-btn ${r.id === range ? "on" : ""}" data-r="${r.id}">${r.label}</button>`).join("");
    filter.querySelectorAll("[data-r]").forEach(b => {
      b.onclick = () => { range = Number(b.dataset.r); App.render(); };
    });
    root.appendChild(filter);
    root.appendChild(tilesCard());
    root.appendChild(weightCard());
    root.appendChild(heatmapCard());
    root.appendChild(strengthCard());
    root.appendChild(kcalCard());
    root.appendChild(historyCard());
  }

  // ---------- Kennzahlen ----------

  function weightPoints() {
    const from = fromKey();
    return Object.keys(state.body)
      .filter(k => k >= from && state.body[k].weight != null)
      .sort()
      .map(k => ({ x: k, y: state.body[k].weight }));
  }

  function balanceData() {
    const from = fromKey();
    return Object.keys(state.meals)
      .filter(k => k >= from && k <= F.todayKey() && state.meals[k].length)
      .sort()
      .map(k => {
        const tdee = F.tdee(state, k);
        if (tdee == null) return null;
        const eaten = F.mealTotals(state, k).kcal;
        const burn = Math.round(tdee + F.trainingKcal(state, k));
        return {
          x: k,
          y: eaten - burn,
          detail: [
            { value: `${fmt(eaten)} kcal`, label: "gegessen" },
            { value: `${fmt(burn)} kcal`, label: "Bedarf inkl. Training" },
          ],
        };
      })
      .filter(Boolean);
  }

  function tilesCard() {
    const card = document.createElement("div");
    card.className = "stat-row four";
    const streak = F.streak(state);
    const week = F.weekProgress(state);
    const pts = weightPoints();
    const delta = pts.length > 1 ? pts[pts.length - 1].y - pts[0].y : null;
    const bal = balanceData();
    const avg = bal.length ? bal.reduce((s, d) => s + d.y, 0) / bal.length : null;
    const hasPlan = Object.values(state.week).some(l => l && l.length);
    card.innerHTML = `
      <div class="stat-tile">
        <span class="stat-label">Serie</span>
        <span class="stat-value">🔥 ${streak}</span>
        <span class="stat-sub">${hasPlan ? "geplante Trainings in Folge" : "Tage in Folge"}</span>
      </div>
      <div class="stat-tile">
        <span class="stat-label">Diese Woche</span>
        <span class="stat-value">${week.done}${week.planned ? ` / ${week.planned}` : ""}</span>
        <span class="stat-sub">Trainings</span>
      </div>
      <div class="stat-tile">
        <span class="stat-label">Gewicht</span>
        <span class="stat-value">${delta == null ? "–" : `${delta > 0 ? "+" : delta < 0 ? "−" : "±"}${fmt(Math.abs(delta), 1)} kg`}</span>
        <span class="stat-sub">${delta == null ? "zu wenig Einträge" : "im Zeitraum"}</span>
      </div>
      <div class="stat-tile">
        <span class="stat-label">Ø Bilanz</span>
        <span class="stat-value">${avg == null ? "–" : `${avg > 0 ? "+" : avg < 0 ? "−" : ""}${fmt(Math.abs(avg))}`}</span>
        <span class="stat-sub">${avg == null ? "keine Ernährungsdaten" : `kcal/Tag · ${bal.length} Tage`}</span>
      </div>`;
    return card;
  }

  function cardShell(title, sub, tableKey) {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div class="card-head">
        <div><h2>${title}</h2>${sub ? `<p class="muted small-text">${sub}</p>` : ""}</div>
        ${tableKey ? `<button type="button" class="link-btn" data-table>${tables[tableKey] ? "Diagramm" : "Tabelle"}</button>` : ""}
      </div>`;
    if (tableKey) {
      card.querySelector("[data-table]").onclick = () => { tables[tableKey] = !tables[tableKey]; App.render(); };
    }
    return card;
  }

  function table(headers, rows) {
    return `
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr>${headers.map(h => `<th>${h}</th>`).join("")}</tr></thead>
          <tbody>${rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody>
        </table>
      </div>`;
  }

  // ---------- Gewicht ----------

  function movingAverage(points) {
    return points.map(p => {
      const from = F.addDays(p.x, -6);
      const win = points.filter(q => q.x >= from && q.x <= p.x);
      return { x: p.x, y: F.round(win.reduce((s, q) => s + q.y, 0) / win.length, 2) };
    });
  }

  function weightCard() {
    const card = cardShell("Gewichtsverlauf", "", "weight");
    const pts = weightPoints();
    const avg = movingAverage(pts);
    const goal = state.profile.goalWeight;
    if (tables.weight) {
      card.insertAdjacentHTML("beforeend", pts.length
        ? table(["Tag", "Gewicht", "7-Tage-Schnitt"], pts.slice().reverse().map((p, i) => [dateShort(p.x), `${fmt(p.y, 1)} kg`, `${fmt(avg[pts.length - 1 - i].y, 1)} kg`]))
        : `<p class="muted">Noch keine Daten im Zeitraum.</p>`);
      return card;
    }
    card.insertAdjacentHTML("beforeend", `
      <div class="legend">
        <span><i class="lg-dot viz-s2"></i>Messwert</span>
        <span><i class="lg-line viz-s1"></i>7-Tage-Schnitt</span>
        ${goal ? `<span><i class="lg-dash"></i>Ziel</span>` : ""}
      </div>
      <div class="chart-box"></div>`);
    Charts.line(card.querySelector(".chart-box"), {
      label: "Gewichtsverlauf",
      unit: "kg",
      digits: 1,
      goal: goal ? { y: goal, label: `Ziel ${fmt(goal, 1)} kg` } : null,
      series: [
        { name: "Messwert", cls: "viz-s2", style: "dots", points: pts },
        { name: "7-Tage-Schnitt", cls: "viz-s1", style: "line", points: avg },
      ],
    });
    return card;
  }

  // ---------- Trainingstage ----------

  function heatmapCard() {
    const card = cardShell("Trainingstage", "Farbe = Trainingsdauer · Rahmen = geplant, aber ausgelassen");
    card.insertAdjacentHTML("beforeend", `
      <div class="chart-box"></div>
      <div class="legend heat-legend">
        <span>weniger</span>
        <i class="heat heat-0"></i><i class="heat heat-1"></i><i class="heat heat-2"></i><i class="heat heat-3"></i><i class="heat heat-4"></i>
        <span>mehr</span>
      </div>`);
    const box = card.querySelector(".chart-box");
    const today = F.todayKey();
    const since = state.planSince || today;
    Charts.heatmap(box, {
      weeks: window.innerWidth < 520 ? 17 : 26,
      valueOf(key) {
        const sessions = F.sessionsOn(state, key);
        const minutes = sessions.reduce((s, x) => s + x.durationSec / 60, 0);
        const level = !sessions.length ? 0 : minutes < 30 ? 1 : minutes < 60 ? 2 : minutes < 90 ? 3 : 4;
        const planned = key < today && key >= since ? F.plannedOn(state, key) : [];
        const missed = planned.some(p => !F.isPlanDone(state, key, p.workoutId));
        const rows = sessions.map(s => ({ value: `${fmt(s.durationSec / 60)} Min.`, label: s.name, key: "viz-s1" }));
        if (missed) rows.push({ value: "ausgelassen", label: planned.filter(p => !F.isPlanDone(state, key, p.workoutId)).map(p => p.workout.name).join(", ") });
        if (!rows.length) rows.push({ value: "–", label: "kein Training" });
        return { level, missed, rows };
      },
    });
    return card;
  }

  // ---------- Kraftfortschritt ----------

  function exerciseHistory(id) {
    const from = fromKey();
    return state.sessions
      .filter(s => s.date >= from)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(s => ({ s, e: s.entries.find(e => e.exerciseId === id) }))
      .filter(({ e }) => e && (e.sets ? e.sets.some(x => x.done) : e.done));
  }

  function strengthCard() {
    const card = cardShell("Fortschritt pro Übung");
    const used = new Map();
    for (const s of state.sessions) {
      for (const e of s.entries) {
        if (e.sets ? e.sets.some(x => x.done) : e.done) used.set(e.exerciseId, (used.get(e.exerciseId) || 0) + 1);
      }
    }
    if (!used.size) {
      card.insertAdjacentHTML("beforeend", `<p class="muted">Sobald du Trainings abschließt, siehst du hier Bestwerte und Verlauf.</p>`);
      return card;
    }
    const options = [...used.keys()].map(id => F.exerciseById(state, id)).sort((a, b) => used.get(b.id) - used.get(a.id));
    if (!exerciseId || !used.has(exerciseId)) exerciseId = options[0].id;
    const ex = F.exerciseById(state, exerciseId);

    card.insertAdjacentHTML("beforeend", `
      <select class="ex-select" aria-label="Übung">
        ${options.map(o => `<option value="${esc(o.id)}" ${o.id === exerciseId ? "selected" : ""}>${esc(o.name)} (${used.get(o.id)}×)</option>`).join("")}
      </select>
      <div class="stat-row pr-row"></div>
      <p class="muted small-text chart-sub"></p>
      <div class="chart-box"></div>`);
    card.querySelector(".ex-select").onchange = e => { exerciseId = e.target.value; App.render(); };

    const hist = exerciseHistory(exerciseId);
    const allHist = (() => { const r = range; range = 0; const h = exerciseHistory(exerciseId); range = r; return h; })();
    const prRow = card.querySelector(".pr-row");
    const sub = card.querySelector(".chart-sub");
    let points;
    let unit;
    let digits = 1;

    if (ex.type === "kraft") {
      let bestSet = null;
      let best1rm = 0;
      for (const { s, e } of allHist) {
        for (const x of e.sets.filter(y => y.done)) {
          if (!bestSet || (x.weight || 0) > bestSet.weight || ((x.weight || 0) === bestSet.weight && x.reps > bestSet.reps)) bestSet = { weight: x.weight || 0, reps: x.reps, date: s.date };
          best1rm = Math.max(best1rm, F.e1rm(x.weight, x.reps));
        }
      }
      const last = allHist[allHist.length - 1];
      const volume = last ? last.e.sets.filter(x => x.done).reduce((v, x) => v + (x.weight || 0) * (x.reps || 0), 0) : 0;
      prRow.innerHTML = tile("Bestes Gewicht", bestSet ? `${fmt(bestSet.weight, 2)} kg` : "–", bestSet ? `× ${bestSet.reps} am ${dateShort(bestSet.date)}` : "")
        + tile("Geschätztes 1RM", best1rm ? `${fmt(best1rm, 1)} kg` : "–", "Maximal für 1 Wdh.")
        + tile("Volumen zuletzt", `${fmt(volume)} kg`, last ? dateShort(last.s.date) : "");
      points = hist.map(({ s, e }) => ({ x: s.date, y: F.round(Math.max(...e.sets.filter(x => x.done).map(x => F.e1rm(x.weight, x.reps))), 1) }));
      unit = "kg";
      sub.textContent = "Verlauf: geschätztes 1RM (Epley) je Training";
    } else if (ex.type === "koerper") {
      const timed = F.isTimed(ex);
      unit = timed ? "Sek." : "Wdh.";
      digits = 0;
      const best = Math.max(0, ...allHist.flatMap(({ e }) => e.sets.filter(x => x.done).map(x => x.reps || 0)));
      const total = allHist.reduce((t, { e }) => t + e.sets.filter(x => x.done).reduce((a, x) => a + (x.reps || 0), 0), 0);
      prRow.innerHTML = tile(timed ? "Längster Satz" : "Meiste Wdh.", `${fmt(best)} ${unit}`, "in einem Satz")
        + tile("Gesamt", `${fmt(total)} ${unit}`, `${allHist.length} Trainings`);
      points = hist.map(({ s, e }) => ({ x: s.date, y: Math.max(...e.sets.filter(x => x.done).map(x => x.reps || 0)) }));
      sub.textContent = `Verlauf: bester Satz je Training (${unit})`;
    } else {
      const withDist = allHist.filter(({ e }) => e.distance);
      const totalKm = withDist.reduce((t, { e }) => t + e.distance, 0);
      const longest = Math.max(0, ...withDist.map(({ e }) => e.distance));
      const paces = withDist.filter(({ e }) => e.duration).map(({ e }) => e.duration / e.distance);
      const bestPace = paces.length ? Math.min(...paces) : null;
      prRow.innerHTML = tile("Längste Strecke", longest ? `${fmt(longest, 2)} km` : "–", "")
        + tile("Beste Pace", bestPace ? pace(bestPace, 1) : "–", "")
        + tile("Gesamt", totalKm ? `${fmt(totalKm, 1)} km` : `${fmt(allHist.reduce((t, { e }) => t + (e.duration || 0), 0))} Min.`, `${allHist.length} Einheiten`);
      const useDist = withDist.length > 0 && ex.distance !== false;
      unit = useDist ? "km" : "Min.";
      digits = useDist ? 2 : 0;
      points = hist.filter(({ e }) => (useDist ? e.distance : e.duration)).map(({ s, e }) => ({ x: s.date, y: useDist ? e.distance : e.duration }));
      sub.textContent = `Verlauf: ${useDist ? "Strecke" : "Dauer"} je Einheit`;
    }

    Charts.line(card.querySelector(".chart-box"), {
      label: `Fortschritt ${ex.name}`,
      unit,
      digits,
      series: [{ name: ex.name, cls: "viz-s1", style: "line", markers: true, points }],
    });
    return card;
  }

  function tile(label, value, subText) {
    return `<div class="stat-tile"><span class="stat-label">${label}</span><span class="stat-value">${esc(value)}</span><span class="stat-sub">${esc(subText)}</span></div>`;
  }

  // ---------- Kalorienbilanz ----------

  function kcalCard() {
    const card = cardShell("Kalorienbilanz", "Gegessen minus Bedarf inkl. Training – unter null heißt Defizit", "kcal");
    const data = balanceData();
    const p = state.profile;
    const tdee = F.tdee(state);
    const refY = p.kcalOverride && tdee ? Math.round(p.kcalOverride - tdee) : -(p.deficit || 0);
    if (tables.kcal) {
      card.insertAdjacentHTML("beforeend", data.length
        ? table(["Tag", "Bilanz", "Gegessen", "Bedarf"], data.slice().reverse().map(d => [dateShort(d.x), `${d.y > 0 ? "+" : ""}${fmt(d.y)}`, d.detail[0].value, d.detail[1].value]))
        : `<p class="muted">Noch keine Daten im Zeitraum.</p>`);
      return card;
    }
    card.insertAdjacentHTML("beforeend", `
      <div class="legend">
        <span><i class="lg-box viz-neg"></i>Defizit</span>
        <span><i class="lg-box viz-pos"></i>Überschuss</span>
        ${refY ? `<span><i class="lg-dash"></i>Ziel</span>` : ""}
      </div>
      <div class="chart-box"></div>`);
    Charts.bars(card.querySelector(".chart-box"), {
      label: "Kalorienbilanz",
      data,
      unit: "kcal",
      posLabel: "Überschuss",
      negLabel: "Defizit",
      ref: refY ? { y: refY, label: `Ziel ${refY > 0 ? "+" : "−"}${fmt(Math.abs(refY))}` } : null,
    });
    return card;
  }

  // ---------- Verlauf ----------

  function historyCard() {
    const card = cardShell("Letzte Trainings");
    const list = state.sessions.slice().sort((a, b) => (b.date + b.start).localeCompare(a.date + a.start)).slice(0, 30);
    card.insertAdjacentHTML("beforeend", list.length ? `
      <div class="pick-list">
        ${list.map(s => {
          const w = F.workoutById(state, s.workoutId);
          const sets = s.entries.reduce((n, e) => n + (e.sets ? e.sets.filter(x => x.done).length : 0), 0);
          return `
            <button type="button" class="pick-item color-${esc(w ? w.color : "green")}" data-s="${esc(s.id)}">
              <strong>${esc(s.name)} <span class="muted">· ${esc(relDay(s.date))}</span></strong>
              <small class="muted">${fmt(s.durationSec / 60)} Min. · ${sets} Sätze${s.kcal ? ` · ca. ${s.kcal} kcal` : ""}${s.note ? " · 📝" : ""}</small>
            </button>`;
        }).join("")}
      </div>` : `<p class="muted">Noch keine Trainings abgeschlossen.</p>`);
    card.querySelectorAll("[data-s]").forEach(b => { b.onclick = () => showSession(b.dataset.s); });
    return card;
  }

  function showSession(id) {
    const s = state.sessions.find(x => x.id === id);
    if (!s) return;
    App.sheet(s.name, (body, close) => {
      body.innerHTML = `
        <p class="muted">${esc(dateLong(s.date))}, ${esc(s.start || "")} · ${fmt(s.durationSec / 60)} Min.${s.kcal ? ` · ca. ${s.kcal} kcal` : ""}</p>
        ${s.note ? `<p class="note-box">${esc(s.note)}</p>` : ""}
        <div class="session-list">
          ${s.entries.map(e => {
            const ex = F.exerciseById(state, e.exerciseId);
            let detail;
            if (!e.sets) {
              detail = e.done
                ? [e.duration ? `${fmt(e.duration)} Min.` : "", e.distance ? `${fmt(e.distance, 2)} km` : "", pace(e.duration, e.distance)].filter(Boolean).join(" · ")
                : "nicht erledigt";
            } else {
              const done = e.sets.filter(x => x.done);
              const unit = F.isTimed(ex) ? " s" : "";
              detail = done.length
                ? done.map(x => `${x.weight ? `${fmt(x.weight, 2)} kg × ` : ""}${x.reps}${unit}${x.rpe ? ` @${fmt(x.rpe, 1)}` : ""}`).join("<br>")
                : "nicht erledigt";
            }
            return `<div class="session-ex"><strong>${esc(ex.name)}</strong><span>${detail}</span></div>`;
          }).join("")}
        </div>
        <div class="sheet-actions">
          <button type="button" class="danger-btn" data-act="delete">Löschen</button>
          <span class="grow"></span>
          <button type="button" class="ghost-btn" data-act="close">Schließen</button>
        </div>`;
      body.querySelector('[data-act="close"]').onclick = close;
      body.querySelector('[data-act="delete"]').onclick = () => {
        App.confirmSheet("Training löschen?", "Das Training wird aus Statistik und Verlauf entfernt.", "Löschen", () => {
          const idx = state.sessions.indexOf(s);
          state.sessions.splice(idx, 1);
          close();
          App.commit();
          App.toast("Training gelöscht", () => {
            state.sessions.splice(idx, 0, s);
            App.commit();
          });
        });
      };
    });
  }

  App.view("statistik", { render });
  return { showSession };
})();
