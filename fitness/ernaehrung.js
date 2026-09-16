// Tab „Ernährung“: Kalorien- und Makrotagebuch mit eigener Lebensmittelliste.
const Ernaehrung = (function () {
  const MEALS = [
    { id: "fruehstueck", label: "Frühstück", icon: "🌅" },
    { id: "mittag", label: "Mittagessen", icon: "☀️" },
    { id: "abend", label: "Abendessen", icon: "🌙" },
    { id: "snack", label: "Snacks", icon: "🍎" },
  ];
  let day = null;

  function render(root) {
    if (!day) day = F.todayKey();
    root.innerHTML = "";
    root.appendChild(dayNav(day, k => { day = k; App.render(); }));
    root.appendChild(summaryCard());
    MEALS.forEach(m => root.appendChild(mealCard(m)));

    const foot = document.createElement("div");
    foot.className = "row-actions center";
    foot.innerHTML = `<button type="button" class="ghost-btn">🥫 Lebensmittel verwalten</button>`;
    foot.querySelector("button").onclick = () => manageFoods();
    root.appendChild(foot);
  }

  function summaryCard() {
    const card = document.createElement("div");
    card.className = "card";
    const target = F.kcalTarget(state, day);
    const t = F.mealTotals(state, day);
    if (target == null) {
      card.innerHTML = `
        <p class="muted">Für Tagesziel und Makros fehlen noch Angaben im Profil. Du kannst trotzdem schon Mahlzeiten eintragen.</p>
        <p><strong>${fmt(t.kcal)} kcal</strong> · E ${fmt(t.protein)} g · K ${fmt(t.carbs)} g · F ${fmt(t.fat)} g</p>
        <button type="button" class="ghost-btn">Profil ergänzen</button>`;
      card.querySelector("button").onclick = () => Einstellungen.openProfile();
      return card;
    }
    const p = state.profile;
    const tdee = F.tdee(state, day);
    const training = F.trainingKcal(state, day);
    const macros = F.macroTargets(state, day);
    const left = target - t.kcal;
    const formula = p.kcalOverride
      ? `Festes Ziel ${fmt(p.kcalOverride)} + Training ${fmt(training)}`
      : `Bedarf ${fmt(tdee)} − Defizit ${fmt(p.deficit)} + Training ${fmt(training)}`;
    card.innerHTML = `
      <div class="kcal-hero">
        <div>
          <span class="hero-num ${left < 0 ? "bad-text" : ""}">${fmt(Math.abs(left))}</span>
          <span class="hero-unit">kcal ${left < 0 ? "über Ziel" : "übrig"}</span>
        </div>
        <div class="kcal-mini">
          <span>Gegessen <strong>${fmt(t.kcal)}</strong></span>
          <span>Ziel <strong>${fmt(target)}</strong></span>
        </div>
      </div>
      ${progressBar(t.kcal, target, "bar-kcal")}
      <p class="muted small-text">${formula} = ${fmt(target)} kcal</p>
      <div class="macro-grid">
        ${macroCell("Eiweiß", t.protein, macros.protein)}
        ${macroCell("Kohlenh.", t.carbs, macros.carbs)}
        ${macroCell("Fett", t.fat, macros.fat)}
      </div>
      ${lowTargetHint(target)}`;
    return card;
  }

  function lowTargetHint(target) {
    const min = state.profile.sex === "w" ? 1200 : 1500;
    if (target >= min) return "";
    return `<p class="warn-text small-text">Dein Tagesziel liegt unter ${min} kcal. Das ist auf Dauer sehr wenig – überlege, das Defizit zu verringern.</p>`;
  }

  function mealCard(meal) {
    const card = document.createElement("div");
    card.className = "card meal-card";
    const entries = (state.meals[day] || []).filter(e => e.meal === meal.id);
    const kcal = entries.reduce((s, e) => s + (e.kcal || 0), 0);
    const yesterday = (state.meals[F.addDays(day, -1)] || []).filter(e => e.meal === meal.id);
    card.innerHTML = `
      <div class="card-head">
        <h2>${meal.icon} ${meal.label}</h2>
        <span class="pill">${fmt(kcal)} kcal</span>
      </div>
      <div class="meal-list">
        ${entries.map(e => `
          <button type="button" class="meal-item" data-id="${esc(e.id)}">
            <span class="grow">
              <strong>${esc(e.name)}</strong>
              <small class="muted">${esc(amountLabel(e))} · E ${fmt(e.protein, 1)} · K ${fmt(e.carbs, 1)} · F ${fmt(e.fat, 1)}</small>
            </span>
            <span class="meal-kcal">${fmt(e.kcal)}</span>
          </button>`).join("")}
      </div>
      <div class="row-actions">
        <button type="button" class="link-btn" data-act="add">+ Hinzufügen</button>
        ${!entries.length && yesterday.length ? `<button type="button" class="link-btn" data-act="copy">Wie am Vortag (${yesterday.length})</button>` : ""}
      </div>`;
    card.querySelector('[data-act="add"]').onclick = () => addEntry(meal);
    const copy = card.querySelector('[data-act="copy"]');
    if (copy) copy.onclick = () => {
      state.meals[day] = state.meals[day] || [];
      yesterday.forEach(e => state.meals[day].push({ ...e, id: F.uid() }));
      App.commit();
    };
    card.querySelectorAll("[data-id]").forEach(b => {
      b.onclick = () => editEntry(b.dataset.id);
    });
    return card;
  }

  function amountLabel(e) {
    if (e.unit === "portion") return `${fmt(e.amount, 2)} × ${e.portionName || "Portion"}`;
    return e.amount != null ? `${fmt(e.amount)} g` : "manuell";
  }

  // Nährwerte für eine Menge berechnen.
  function scaled(food, amount) {
    const factor = food.per === "portion" ? amount : amount / 100;
    return {
      kcal: Math.round(food.kcal * factor),
      protein: F.round(food.protein * factor, 1),
      carbs: F.round(food.carbs * factor, 1),
      fat: F.round(food.fat * factor, 1),
    };
  }

  // Zuletzt genutzte Lebensmittel zuerst.
  function sortedFoods() {
    const lastUse = {};
    for (const [k, list] of Object.entries(state.meals)) {
      for (const e of list) if (e.foodId && (!lastUse[e.foodId] || lastUse[e.foodId] < k)) lastUse[e.foodId] = k;
    }
    return F.foods(state).map(f => ({ ...f, lastUse: lastUse[f.id] || "" }))
      .sort((a, b) => b.lastUse.localeCompare(a.lastUse) || a.name.localeCompare(b.name, "de"));
  }

  function addEntry(meal) {
    let term = "";
    App.sheet(`${meal.label} hinzufügen`, (body, close) => {
      body.innerHTML = `
        <input type="search" id="foodSearch" class="search" placeholder="Lebensmittel suchen…" autofocus>
        <div id="foodList" class="pick-list"></div>
        <div class="row-actions">
          <button type="button" class="ghost-btn" data-act="manual">Manuell eintragen</button>
          <button type="button" class="ghost-btn" data-act="newfood">+ Neues Lebensmittel</button>
        </div>`;
      const listEl = body.querySelector("#foodList");
      const draw = () => {
        const t = term.toLowerCase();
        const list = sortedFoods().filter(f => !t || f.name.toLowerCase().includes(t));
        listEl.innerHTML = list.slice(0, 60).map(f => `
          <button type="button" class="pick-item" data-food="${esc(f.id)}">
            <strong>${esc(f.name)}${f.lastUse ? ` <span class="pill small">zuletzt</span>` : ""}</strong>
            <small class="muted">${fmt(f.kcal)} kcal ${f.per === "portion" ? `pro ${esc(f.portion?.name || "Portion")}` : "/ 100 g"} · E ${fmt(f.protein, 1)} · K ${fmt(f.carbs, 1)} · F ${fmt(f.fat, 1)}</small>
          </button>`).join("") || `<p class="muted">Nichts gefunden – lege das Lebensmittel neu an oder trage es manuell ein.</p>`;
        listEl.querySelectorAll("[data-food]").forEach(b => {
          b.onclick = () => amountSheet(meal, F.foods(state).find(f => f.id === b.dataset.food), null, close);
        });
      };
      body.querySelector("#foodSearch").oninput = e => { term = e.target.value; draw(); };
      body.querySelector('[data-act="manual"]').onclick = () => manualSheet(meal, null, close);
      body.querySelector('[data-act="newfood"]').onclick = () => editFood(null, food => {
        if (food) amountSheet(meal, food, null, close);
      });
      draw();
    });
  }

  // Menge wählen (Stufe 2). entry = bestehender Eintrag zum Bearbeiten.
  function amountSheet(meal, food, entry, closeParent) {
    const isPortion = food.per === "portion";
    const startAmount = entry ? entry.amount : isPortion ? 1 : (food.portion ? food.portion.g : 100);
    App.sheet(food.name, (body, close) => {
      body.innerHTML = `
        <label class="field">${isPortion ? `Anzahl (${esc(food.portion?.name || "Portion")})` : "Menge in Gramm"}
          <input type="text" inputmode="decimal" id="amount" value="${inVal(startAmount)}">
        </label>
        <div class="chip-row">
          ${isPortion
            ? [0.5, 1, 2].map(n => `<button type="button" class="chip-btn" data-amt="${n}">${fmt(n, 1)}×</button>`).join("")
            : [
              food.portion ? `<button type="button" class="chip-btn" data-amt="${food.portion.g}">1 ${esc(food.portion.name)} (${food.portion.g} g)</button>` : "",
              food.portion ? `<button type="button" class="chip-btn" data-amt="${food.portion.g * 2}">2 × ${esc(food.portion.name)}</button>` : "",
              `<button type="button" class="chip-btn" data-amt="100">100 g</button>`,
            ].join("")}
        </div>
        <div id="preview" class="preview"></div>
        ${entry ? "" : `<label class="field">Mahlzeit
          <select id="mealSel">${MEALS.map(m => `<option value="${m.id}" ${m.id === meal.id ? "selected" : ""}>${m.label}</option>`).join("")}</select>
        </label>`}
        <div class="sheet-actions">
          <span class="grow"></span>
          <button type="button" class="primary-btn" data-act="save">${entry ? "Speichern" : "Hinzufügen"}</button>
        </div>`;
      const amountIn = body.querySelector("#amount");
      const preview = body.querySelector("#preview");
      const update = () => {
        const v = scaled(food, num(amountIn.value) || 0);
        preview.innerHTML = `<strong>${fmt(v.kcal)} kcal</strong><span>E ${fmt(v.protein, 1)} g</span><span>K ${fmt(v.carbs, 1)} g</span><span>F ${fmt(v.fat, 1)} g</span>`;
      };
      amountIn.oninput = update;
      body.querySelectorAll("[data-amt]").forEach(b => {
        b.onclick = () => { amountIn.value = inVal(Number(b.dataset.amt)); update(); };
      });
      update();
      body.querySelector('[data-act="save"]').onclick = () => {
        const amount = num(amountIn.value);
        if (!amount || amount <= 0) { App.toast("Bitte eine Menge eingeben"); return; }
        const values = scaled(food, amount);
        const data = {
          foodId: food.id,
          name: food.name,
          amount,
          unit: isPortion ? "portion" : "g",
          portionName: isPortion ? food.portion?.name || "Portion" : undefined,
          ...values,
        };
        if (entry) Object.assign(entry, data);
        else {
          state.meals[day] = state.meals[day] || [];
          state.meals[day].push({ id: F.uid(), meal: body.querySelector("#mealSel").value, ...data });
        }
        close();
        if (closeParent) closeParent();
        App.commit();
      };
      setTimeout(() => amountIn.select(), 50);
    }, 2);
  }

  function manualSheet(meal, entry, closeParent) {
    App.sheet(entry ? "Eintrag bearbeiten" : "Manuell eintragen", (body, close) => {
      const e = entry || {};
      body.innerHTML = `
        <label class="field">Bezeichnung<input type="text" id="mName" maxlength="60" value="${esc(e.name || "")}" placeholder="z. B. Döner"></label>
        <div class="form-grid">
          <label class="field">kcal<input type="text" inputmode="numeric" id="mKcal" value="${inVal(e.kcal)}"></label>
          <label class="field">Eiweiß (g)<input type="text" inputmode="decimal" id="mP" value="${inVal(e.protein)}"></label>
          <label class="field">Kohlenhydrate (g)<input type="text" inputmode="decimal" id="mC" value="${inVal(e.carbs)}"></label>
          <label class="field">Fett (g)<input type="text" inputmode="decimal" id="mF" value="${inVal(e.fat)}"></label>
        </div>
        ${entry ? "" : `<label class="toggle"><input type="checkbox" id="mSave"> Als Lebensmittel (pro Portion) speichern</label>`}
        <div class="sheet-actions">
          <span class="grow"></span>
          <button type="button" class="primary-btn" data-act="save">${entry ? "Speichern" : "Hinzufügen"}</button>
        </div>`;
      body.querySelector('[data-act="save"]').onclick = () => {
        const name = body.querySelector("#mName").value.trim();
        const kcal = num(body.querySelector("#mKcal").value);
        if (!name || kcal == null) { App.toast("Bitte Bezeichnung und kcal eingeben"); return; }
        const data = {
          name,
          kcal: Math.round(kcal),
          protein: num(body.querySelector("#mP").value) || 0,
          carbs: num(body.querySelector("#mC").value) || 0,
          fat: num(body.querySelector("#mF").value) || 0,
        };
        if (entry) {
          Object.assign(entry, data);
        } else {
          let foodId = null;
          if (body.querySelector("#mSave").checked) {
            foodId = "eigen-" + F.uid();
            state.foods.push({ id: foodId, ...data, per: "portion", portion: { name: "Portion", g: null } });
          }
          state.meals[day] = state.meals[day] || [];
          state.meals[day].push({
            id: F.uid(), meal: meal.id, foodId, amount: foodId ? 1 : null,
            unit: foodId ? "portion" : "manual", portionName: "Portion", ...data,
          });
        }
        close();
        if (closeParent) closeParent();
        App.commit();
      };
    }, 2);
  }

  function editEntry(id) {
    const list = state.meals[day] || [];
    const entry = list.find(e => e.id === id);
    if (!entry) return;
    const food = entry.foodId && F.foods(state).find(f => f.id === entry.foodId);
    App.sheet(entry.name, (body, close) => {
      body.innerHTML = `
        <p><strong>${fmt(entry.kcal)} kcal</strong> · ${esc(amountLabel(entry))}</p>
        <p class="muted">Eiweiß ${fmt(entry.protein, 1)} g · Kohlenhydrate ${fmt(entry.carbs, 1)} g · Fett ${fmt(entry.fat, 1)} g</p>
        <label class="field">Mahlzeit
          <select id="moveMeal">${MEALS.map(m => `<option value="${m.id}" ${m.id === entry.meal ? "selected" : ""}>${m.label}</option>`).join("")}</select>
        </label>
        <div class="sheet-actions">
          <button type="button" class="danger-btn" data-act="delete">Löschen</button>
          <span class="grow"></span>
          <button type="button" class="ghost-btn" data-act="edit">${food ? "Menge ändern" : "Werte ändern"}</button>
        </div>`;
      body.querySelector("#moveMeal").onchange = e => {
        entry.meal = e.target.value;
        App.commit();
      };
      body.querySelector('[data-act="edit"]').onclick = () => {
        const meal = MEALS.find(m => m.id === entry.meal);
        if (food) amountSheet(meal, food, entry, close);
        else manualSheet(meal, entry, close);
      };
      body.querySelector('[data-act="delete"]').onclick = () => {
        const idx = list.indexOf(entry);
        list.splice(idx, 1);
        close();
        App.commit();
        App.toast(`${entry.name} gelöscht`, () => {
          list.splice(idx, 0, entry);
          state.meals[day] = list;
          App.commit();
        });
      };
    });
  }

  // ---------- Lebensmittel verwalten ----------

  function manageFoods() {
    let term = "";
    App.sheet("Lebensmittel", (body) => {
      body.innerHTML = `
        <p class="muted small-text">Werte pro 100 g (oder pro Portion). Mitgelieferte Lebensmittel sind Richtwerte – prüfe bei Bedarf die Verpackung.</p>
        <input type="search" class="search" placeholder="Suchen…">
        <div class="pick-list" id="fmList"></div>
        <button type="button" class="primary-btn wide" data-act="new">+ Neues Lebensmittel</button>`;
      const listEl = body.querySelector("#fmList");
      const draw = () => {
        const t = term.toLowerCase();
        listEl.innerHTML = F.foods(state)
          .filter(f => !t || f.name.toLowerCase().includes(t))
          .sort((a, b) => a.name.localeCompare(b.name, "de"))
          .map(f => `
            <button type="button" class="pick-item" data-food="${esc(f.id)}">
              <strong>${esc(f.name)}${isOwn(f) ? ` <span class="pill small">eigenes</span>` : ""}</strong>
              <small class="muted">${fmt(f.kcal)} kcal ${f.per === "portion" ? "/ Portion" : "/ 100 g"} · E ${fmt(f.protein, 1)} · K ${fmt(f.carbs, 1)} · F ${fmt(f.fat, 1)}</small>
            </button>`).join("");
        listEl.querySelectorAll("[data-food]").forEach(b => {
          b.onclick = () => editFood(b.dataset.food, draw);
        });
      };
      body.querySelector(".search").oninput = e => { term = e.target.value; draw(); };
      body.querySelector('[data-act="new"]').onclick = () => editFood(null, draw);
      draw();
    });
  }

  function isOwn(food) {
    return state.foods.some(f => f.id === food.id);
  }

  // Lebensmittel anlegen/bearbeiten (Stufe 2). Mitgelieferte werden beim Speichern als eigene Kopie abgelegt.
  function editFood(id, onDone) {
    const existing = id ? F.foods(state).find(f => f.id === id) : null;
    const own = existing && isOwn(existing);
    App.sheet(existing ? existing.name : "Neues Lebensmittel", (body, close) => {
      const f = existing || { name: "", kcal: null, protein: null, carbs: null, fat: null, per: "100g", portion: { name: "Portion", g: null } };
      body.innerHTML = `
        <label class="field">Name<input type="text" id="fName" maxlength="60" value="${esc(f.name)}"></label>
        <label class="field">Angaben
          <select id="fPer">
            <option value="100g" ${f.per !== "portion" ? "selected" : ""}>pro 100 g</option>
            <option value="portion" ${f.per === "portion" ? "selected" : ""}>pro Portion / Stück</option>
          </select>
        </label>
        <div class="form-grid">
          <label class="field">kcal<input type="text" inputmode="numeric" id="fKcal" value="${inVal(f.kcal)}"></label>
          <label class="field">Eiweiß (g)<input type="text" inputmode="decimal" id="fP" value="${inVal(f.protein)}"></label>
          <label class="field">Kohlenhydrate (g)<input type="text" inputmode="decimal" id="fC" value="${inVal(f.carbs)}"></label>
          <label class="field">Fett (g)<input type="text" inputmode="decimal" id="fF" value="${inVal(f.fat)}"></label>
          <label class="field">Portionsname<input type="text" id="fPortName" maxlength="20" value="${esc(f.portion?.name || "Portion")}"></label>
          <label class="field" id="fPortGField">Portion in g<input type="text" inputmode="numeric" id="fPortG" value="${inVal(f.portion?.g)}"></label>
        </div>
        <div class="sheet-actions">
          ${existing ? `<button type="button" class="danger-btn" data-act="delete">${own ? "Löschen" : "Ausblenden"}</button>` : ""}
          <span class="grow"></span>
          <button type="button" class="primary-btn" data-act="save">Speichern</button>
        </div>`;
      const perSel = body.querySelector("#fPer");
      const syncPer = () => { body.querySelector("#fPortGField").hidden = perSel.value === "portion"; };
      perSel.onchange = syncPer;
      syncPer();

      body.querySelector('[data-act="save"]').onclick = () => {
        const name = body.querySelector("#fName").value.trim();
        const kcal = num(body.querySelector("#fKcal").value);
        if (!name || kcal == null) { App.toast("Bitte Name und kcal eingeben"); return; }
        const data = {
          name,
          per: perSel.value,
          kcal,
          protein: num(body.querySelector("#fP").value) || 0,
          carbs: num(body.querySelector("#fC").value) || 0,
          fat: num(body.querySelector("#fF").value) || 0,
          portion: { name: body.querySelector("#fPortName").value.trim() || "Portion", g: num(body.querySelector("#fPortG").value) },
        };
        if (data.per !== "portion" && !data.portion.g) data.portion = null;
        let food;
        if (own) {
          food = Object.assign(state.foods.find(x => x.id === id), data);
        } else {
          food = { id: "eigen-" + F.uid(), ...data };
          state.foods.push(food);
          if (existing) hideBuiltin(existing.id);
        }
        F.save(state);
        close();
        if (onDone) onDone(food);
        App.render();
      };
      const del = body.querySelector('[data-act="delete"]');
      if (del) del.onclick = () => {
        if (own) state.foods = state.foods.filter(x => x.id !== id);
        else hideBuiltin(id);
        F.save(state);
        close();
        if (onDone) onDone(null);
      };
    }, 2);
  }

  function hideBuiltin(id) {
    state.hiddenFoods = state.hiddenFoods || [];
    if (!state.hiddenFoods.includes(id)) state.hiddenFoods.push(id);
  }

  App.view("ernaehrung", { render });
  return { manageFoods };
})();
