// Tab „Plan“: Wochenplan, Trainingseinheiten, Vorlagen und Übungsauswahl.
const Plan = (function () {
  const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
  const COLORS = [
    { id: "blue", label: "Blau" },
    { id: "green", label: "Grün" },
    { id: "orange", label: "Orange" },
    { id: "pink", label: "Pink" },
    { id: "purple", label: "Lila" },
  ];
  const GROUPS = ["Alle", "Brust", "Rücken", "Schultern", "Arme", "Beine", "Po", "Core", "Ganzkörper", "Cardio", "Eigene"];

  function render(root) {
    root.innerHTML = "";
    root.appendChild(weekCard());
    root.appendChild(workoutsCard());
  }

  // ---------- Wochenplan ----------

  function weekCard() {
    const card = document.createElement("div");
    card.className = "card";
    const today = new Date().getDay();
    card.innerHTML = `
      <div class="card-head"><h2>Wochenplan</h2></div>
      ${!state.workouts.length ? `<p class="muted">Lege zuerst Trainingseinheiten an oder übernimm eine Vorlage.</p>` : ""}
      <div class="week-list">
        ${WEEK_ORDER.map(d => {
          const list = state.week[d] || [];
          return `
            <div class="week-day ${d === today ? "is-today" : ""}">
              <span class="wd">${WD_SHORT[d]}</span>
              <div class="week-items">
                ${list.map((p, idx) => {
                  const w = F.workoutById(state, p.workoutId);
                  if (!w) return "";
                  return `<button type="button" class="plan-chip color-${esc(w.color)}" data-day="${d}" data-idx="${idx}">
                    ${esc(w.name)}${p.time ? ` <small>${esc(p.time)}</small>` : ""}
                  </button>`;
                }).join("") || `<span class="muted small-text">Ruhetag</span>`}
              </div>
              <button type="button" class="icon-btn small" data-add="${d}" aria-label="Training am ${F.WEEKDAYS[d]} hinzufügen" ${state.workouts.length ? "" : "disabled"}>+</button>
            </div>`;
        }).join("")}
      </div>
      <p class="muted small-text">Geplante Trainings erscheinen auch im Kalender.</p>`;
    card.querySelectorAll("[data-add]").forEach(b => {
      b.onclick = () => editDay(Number(b.dataset.add), null);
    });
    card.querySelectorAll("[data-day]").forEach(b => {
      b.onclick = () => editDay(Number(b.dataset.day), Number(b.dataset.idx));
    });
    return card;
  }

  function editDay(day, idx) {
    const existing = idx != null ? state.week[day][idx] : null;
    App.sheet(`${F.WEEKDAYS[day]}: Training ${existing ? "bearbeiten" : "planen"}`, (body, close) => {
      body.innerHTML = `
        <label class="field">Einheit
          <select id="dayWorkout">
            ${state.workouts.map(w => `<option value="${esc(w.id)}" ${existing && existing.workoutId === w.id ? "selected" : ""}>${esc(w.name)}</option>`).join("")}
          </select>
        </label>
        <label class="field">Uhrzeit (optional, für den Kalender)
          <input type="time" id="dayTime" value="${existing ? esc(existing.time || "") : ""}">
        </label>
        <div class="sheet-actions">
          ${existing ? `<button type="button" class="danger-btn" data-act="remove">Entfernen</button>` : ""}
          <span class="grow"></span>
          <button type="button" class="primary-btn" data-act="save">Speichern</button>
        </div>`;
      body.querySelector('[data-act="save"]').onclick = () => {
        const entry = { workoutId: body.querySelector("#dayWorkout").value, time: body.querySelector("#dayTime").value };
        state.week[day] = state.week[day] || [];
        if (existing) state.week[day][idx] = entry;
        else state.week[day].push(entry);
        if (!state.planSince) state.planSince = F.todayKey();
        close();
        App.commit();
      };
      const rm = body.querySelector('[data-act="remove"]');
      if (rm) rm.onclick = () => {
        state.week[day].splice(idx, 1);
        close();
        App.commit();
      };
    });
  }

  // ---------- Einheiten ----------

  function workoutsCard() {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div class="card-head"><h2>Trainingseinheiten</h2></div>
      <div class="pick-list">
        ${state.workouts.map(w => `
          <button type="button" class="pick-item color-${esc(w.color)}" data-id="${esc(w.id)}">
            <strong>${esc(w.name)}</strong>
            <small class="muted">${w.items.length} Übungen · ca. ${F.workoutMinutes(state, w)} Min. · ${esc(daysOf(w.id) || "nicht eingeplant")}</small>
          </button>`).join("") || `<p class="muted">Noch keine Einheiten.</p>`}
      </div>
      <div class="row-actions">
        <button type="button" class="primary-btn" data-act="new">+ Neue Einheit</button>
        <button type="button" class="ghost-btn" data-act="templates">Vorlage übernehmen</button>
      </div>`;
    card.querySelectorAll("[data-id]").forEach(b => {
      b.onclick = () => editWorkout(b.dataset.id);
    });
    card.querySelector('[data-act="new"]').onclick = () => editWorkout(null);
    card.querySelector('[data-act="templates"]').onclick = openTemplates;
    return card;
  }

  function daysOf(workoutId) {
    return WEEK_ORDER.filter(d => (state.week[d] || []).some(p => p.workoutId === workoutId)).map(d => WD_SHORT[d]).join(", ");
  }

  function editWorkout(id) {
    const original = id ? F.workoutById(state, id) : null;
    // Arbeitskopie, damit „Abbrechen“ nichts verändert.
    const draft = original
      ? JSON.parse(JSON.stringify(original))
      : { id: F.uid(), name: "", color: "blue", note: "", items: [] };

    App.sheet(original ? "Einheit bearbeiten" : "Neue Einheit", (body, close) => {
      body.innerHTML = `
        <label class="field">Name
          <input type="text" id="wName" maxlength="40" placeholder="z. B. Oberkörper" value="${esc(draft.name)}">
        </label>
        <div class="field">Farbe
          <div class="color-row">
            ${COLORS.map(c => `<button type="button" class="swatch-btn color-${c.id} ${draft.color === c.id ? "on" : ""}" data-color="${c.id}" aria-label="${c.label}"></button>`).join("")}
          </div>
        </div>
        <label class="field">Hinweis (optional)
          <textarea id="wNote" rows="2" maxlength="300" placeholder="z. B. Ablauf der Intervalle">${esc(draft.note || "")}</textarea>
        </label>
        <div class="field">Übungen</div>
        <div id="wItems" class="item-list"></div>
        <button type="button" class="ghost-btn wide" data-act="add">+ Übung hinzufügen</button>
        <div class="sheet-actions">
          ${original ? `<button type="button" class="danger-btn" data-act="delete">Löschen</button>` : ""}
          <span class="grow"></span>
          <button type="button" class="ghost-btn" data-act="cancel">Abbrechen</button>
          <button type="button" class="primary-btn" data-act="save">Speichern</button>
        </div>`;

      const itemsEl = body.querySelector("#wItems");
      const drawItems = () => {
        itemsEl.innerHTML = draft.items.map((item, i) => itemRow(item, i, draft.items.length)).join("")
          || `<p class="muted small-text">Noch keine Übungen.</p>`;
        itemsEl.querySelectorAll("[data-k]").forEach(inp => {
          inp.onchange = () => {
            const v = num(inp.value);
            draft.items[Number(inp.dataset.i)][inp.dataset.k] = v == null ? null : v;
          };
        });
        itemsEl.querySelectorAll("[data-move]").forEach(b => {
          b.onclick = () => {
            const i = Number(b.dataset.i);
            const j = i + Number(b.dataset.move);
            [draft.items[i], draft.items[j]] = [draft.items[j], draft.items[i]];
            drawItems();
          };
        });
        itemsEl.querySelectorAll("[data-del]").forEach(b => {
          b.onclick = () => { draft.items.splice(Number(b.dataset.del), 1); drawItems(); };
        });
      };
      drawItems();

      body.querySelectorAll("[data-color]").forEach(b => {
        b.onclick = () => {
          draft.color = b.dataset.color;
          body.querySelectorAll("[data-color]").forEach(x => x.classList.toggle("on", x === b));
        };
      });
      body.querySelector('[data-act="add"]').onclick = () => pickExercise(ex => {
        draft.items.push(ex.type === "cardio"
          ? { exerciseId: ex.id, duration: 30, distance: null }
          : { exerciseId: ex.id, sets: 3, reps: F.isTimed(ex) ? 30 : 10, rest: ex.type === "kraft" ? 90 : 45, weight: null });
        drawItems();
        itemsEl.lastElementChild.scrollIntoView({ block: "nearest" });
      }, 2);
      body.querySelector('[data-act="cancel"]').onclick = close;
      body.querySelector('[data-act="save"]').onclick = () => {
        draft.name = body.querySelector("#wName").value.trim();
        draft.note = body.querySelector("#wNote").value.trim();
        if (!draft.name) {
          body.querySelector("#wName").focus();
          App.toast("Bitte einen Namen eingeben");
          return;
        }
        if (original) Object.assign(original, draft);
        else state.workouts.push(draft);
        close();
        App.commit();
      };
      const del = body.querySelector('[data-act="delete"]');
      if (del) del.onclick = () => {
        App.confirmSheet("Einheit löschen?", `„${original.name}“ wird auch aus dem Wochenplan entfernt. Erledigte Trainings bleiben in der Statistik.`, "Löschen", () => {
          state.workouts = state.workouts.filter(w => w.id !== original.id);
          for (const d of Object.keys(state.week)) {
            state.week[d] = state.week[d].filter(p => p.workoutId !== original.id);
          }
          close();
          App.commit();
        });
      };
    });
  }

  function itemRow(item, i, count) {
    const ex = F.exerciseById(state, item.exerciseId);
    const field = (key, label, mode = "numeric") => `
      <label class="mini-field">${label}
        <input type="text" inputmode="${mode}" data-i="${i}" data-k="${key}" value="${inVal(item[key])}">
      </label>`;
    const fields = ex.type === "cardio"
      ? field("duration", "Min.") + (ex.distance !== false ? field("distance", "km", "decimal") : "")
      : field("sets", "Sätze") + field("reps", F.isTimed(ex) ? "Sek." : "Wdh.") + field("rest", "Pause s")
        + (ex.type === "kraft" ? field("weight", "kg", "decimal") : "");
    return `
      <div class="item-row">
        <div class="item-top">
          <strong class="grow">${esc(ex.name)}</strong>
          <button type="button" class="icon-btn small" data-i="${i}" data-move="-1" ${i === 0 ? "disabled" : ""} aria-label="Nach oben">↑</button>
          <button type="button" class="icon-btn small" data-i="${i}" data-move="1" ${i === count - 1 ? "disabled" : ""} aria-label="Nach unten">↓</button>
          <button type="button" class="icon-btn small" data-del="${i}" aria-label="Entfernen">✕</button>
        </div>
        <div class="item-fields">${fields}</div>
      </div>`;
  }

  // ---------- Vorlagen ----------

  function openTemplates() {
    App.sheet("Vorlage übernehmen", (body, close) => {
      body.innerHTML = `
        <p class="muted">Die Einheiten werden zu deinem Plan hinzugefügt und lassen sich danach frei anpassen.</p>
        ${FITNESS_PLAN_VORLAGEN.map(v => `
          <div class="template">
            <strong>${esc(v.name)}</strong>
            <p class="muted">${esc(v.description)}</p>
            <ul class="template-list">
              ${v.workouts.map(w => `<li><span class="dot color-${w.color}"></span>${esc(w.name)}: ${esc(w.items.map(i => F.exerciseById(state, i.exerciseId).name).join(", "))}</li>`).join("")}
            </ul>
            <p class="small-text">Wochentage: ${esc(WEEK_ORDER.filter(d => v.week[d]).map(d => `${WD_SHORT[d]} ${v.week[d].map(k => v.workouts.find(w => w.key === k).name).join(" + ")}`).join(" · "))}</p>
            <label class="toggle"><input type="checkbox" data-week="${v.id}" checked> Auch in den Wochenplan eintragen</label>
            <button type="button" class="primary-btn" data-tpl="${v.id}">Übernehmen</button>
          </div>`).join("")}`;
      body.querySelectorAll("[data-tpl]").forEach(b => {
        b.onclick = () => {
          const withWeek = body.querySelector(`[data-week="${b.dataset.tpl}"]`).checked;
          applyTemplate(b.dataset.tpl, withWeek);
          close();
        };
      });
    });
  }

  function applyTemplate(templateId, withWeek) {
    const v = FITNESS_PLAN_VORLAGEN.find(t => t.id === templateId);
    const ids = {};
    for (const w of v.workouts) {
      const id = F.uid();
      ids[w.key] = id;
      state.workouts.push({
        id,
        name: w.name,
        color: w.color,
        note: w.note || "",
        items: w.items.map(i => ({ weight: null, ...i })),
      });
    }
    if (withWeek) {
      for (const [day, keys] of Object.entries(v.week)) {
        state.week[day] = state.week[day] || [];
        keys.forEach(k => state.week[day].push({ workoutId: ids[k], time: "" }));
      }
      if (!state.planSince) state.planSince = F.todayKey();
    }
    App.commit();
    App.toast(`„${v.name}“ übernommen`);
  }

  // ---------- Übungsauswahl (auch im laufenden Training) ----------

  function pickExercise(onPick, level = 2) {
    let group = "Alle";
    let term = "";
    App.sheet("Übung auswählen", (body, close) => {
      body.innerHTML = `
        <input type="search" id="exSearch" class="search" placeholder="Übung suchen…" autofocus>
        <div class="chip-row" id="exGroups">
          ${GROUPS.map(g => `<button type="button" class="chip-btn ${g === group ? "on" : ""}" data-g="${g}">${g}</button>`).join("")}
        </div>
        <div id="exList" class="pick-list"></div>
        <button type="button" class="ghost-btn wide" data-act="custom">+ Eigene Übung anlegen</button>`;
      const listEl = body.querySelector("#exList");
      const draw = () => {
        const t = term.toLowerCase();
        const list = F.exercises(state).filter(e =>
          (group === "Alle" || (group === "Eigene" ? e.custom : e.group === group))
          && (!t || e.name.toLowerCase().includes(t) || e.group.toLowerCase().includes(t)));
        listEl.innerHTML = list.map(e => {
          const last = F.lastPerformance(state, e.id);
          return `
            <button type="button" class="pick-item" data-ex="${esc(e.id)}">
              <strong>${esc(e.name)}</strong>
              <small class="muted">${esc(e.group)} · ${typeLabel(e)}${last ? ` · zuletzt ${dateShort(last.date)}` : ""}</small>
            </button>`;
        }).join("") || `<p class="muted">Keine Übung gefunden.</p>`;
        listEl.querySelectorAll("[data-ex]").forEach(b => {
          b.onclick = () => {
            close();
            onPick(F.exerciseById(state, b.dataset.ex));
          };
        });
      };
      body.querySelector("#exSearch").oninput = e => { term = e.target.value; draw(); };
      body.querySelectorAll("[data-g]").forEach(b => {
        b.onclick = () => {
          group = b.dataset.g;
          body.querySelectorAll("[data-g]").forEach(x => x.classList.toggle("on", x === b));
          draw();
        };
      });
      body.querySelector('[data-act="custom"]').onclick = () => {
        editExercise(null, ex => { close(); onPick(ex); }, level);
      };
      draw();
    }, level);
  }

  function typeLabel(e) {
    if (e.type === "cardio") return "Cardio";
    if (e.type === "kraft") return "mit Gewicht";
    return F.isTimed(e) ? "Körpergewicht, Zeit" : "Körpergewicht";
  }

  // Eigene Übung anlegen/bearbeiten. onSaved bekommt die Übung.
  function editExercise(id, onSaved, level = 2) {
    const original = id ? state.customExercises.find(e => e.id === id) : null;
    App.sheet(original ? "Eigene Übung bearbeiten" : "Eigene Übung", (body, close) => {
      const e = original || { name: "", group: "Ganzkörper", type: "kraft", measure: "reps", hint: "" };
      body.innerHTML = `
        <label class="field">Name<input type="text" id="ceName" maxlength="50" value="${esc(e.name)}"></label>
        <div class="form-grid">
          <label class="field">Muskelgruppe
            <select id="ceGroup">${GROUPS.slice(1, -1).map(g => `<option ${g === e.group ? "selected" : ""}>${g}</option>`).join("")}</select>
          </label>
          <label class="field">Art
            <select id="ceType">
              <option value="kraft" ${e.type === "kraft" ? "selected" : ""}>Mit Gewicht</option>
              <option value="koerper" ${e.type === "koerper" && e.measure !== "time" ? "selected" : ""}>Körpergewicht (Wdh.)</option>
              <option value="koerper-zeit" ${e.type === "koerper" && e.measure === "time" ? "selected" : ""}>Körpergewicht (Zeit)</option>
              <option value="cardio" ${e.type === "cardio" ? "selected" : ""}>Cardio (Dauer/Strecke)</option>
            </select>
          </label>
        </div>
        <label class="field">Ausführungshinweis (optional)<textarea id="ceHint" rows="2" maxlength="200">${esc(e.hint || "")}</textarea></label>
        <div class="sheet-actions">
          ${original ? `<button type="button" class="danger-btn" data-act="delete">Löschen</button>` : ""}
          <span class="grow"></span>
          <button type="button" class="primary-btn" data-act="save">Speichern</button>
        </div>`;
      body.querySelector('[data-act="save"]').onclick = () => {
        const name = body.querySelector("#ceName").value.trim();
        if (!name) { App.toast("Bitte einen Namen eingeben"); return; }
        const typeSel = body.querySelector("#ceType").value;
        const group = typeSel === "cardio" ? "Cardio" : body.querySelector("#ceGroup").value;
        const data = {
          name,
          group,
          type: typeSel === "koerper-zeit" ? "koerper" : typeSel,
          measure: typeSel === "koerper-zeit" ? "time" : "reps",
          hint: body.querySelector("#ceHint").value.trim(),
          inc: typeSel === "kraft" ? 2.5 : undefined,
          custom: true,
        };
        let ex;
        if (original) ex = Object.assign(original, data);
        else {
          ex = { id: "eigen-" + F.uid(), ...data };
          state.customExercises.push(ex);
        }
        F.save(state);
        close();
        onSaved(ex);
      };
      const del = body.querySelector('[data-act="delete"]');
      if (del) del.onclick = () => {
        const used = state.workouts.some(w => w.items.some(i => i.exerciseId === id));
        if (used) { App.toast("Übung wird noch in einer Einheit verwendet"); return; }
        state.customExercises = state.customExercises.filter(x => x.id !== id);
        F.save(state);
        close();
        onSaved(null);
      };
    }, level);
  }

  App.view("plan", { render });
  return { openTemplates, pickExercise, editExercise, typeLabel };
})();
