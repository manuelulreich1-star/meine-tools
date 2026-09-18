// Tab „Ernährung“: Kalorien- und Makrotagebuch mit Lebensmittelliste und eigenen Gerichten.
const Ernaehrung = (function () {
  const MEALS = [
    { id: "fruehstueck", label: "Frühstück", icon: "🌅" },
    { id: "mittag", label: "Mittagessen", icon: "☀️" },
    { id: "abend", label: "Abendessen", icon: "🌙" },
    { id: "snack", label: "Snacks", icon: "🍎" },
  ];
  const OWN_CAT = "Eigene";
  const CATEGORIES = typeof FITNESS_LEBENSMITTEL_KATEGORIEN === "undefined" ? [] : FITNESS_LEBENSMITTEL_KATEGORIEN;
  const LIST_LIMIT = 60;
  let day = null;

  function render(root) {
    if (!day) day = F.todayKey();
    root.innerHTML = "";
    root.appendChild(dayNav(day, k => { day = k; App.render(); }));
    root.appendChild(summaryCard());
    MEALS.forEach(m => root.appendChild(mealCard(m)));

    const foot = document.createElement("div");
    foot.className = "row-actions center";
    foot.innerHTML = `
      <button type="button" class="ghost-btn" data-act="recipes">🍲 Meine Gerichte${recipes().length ? ` (${recipes().length})` : ""}</button>
      <button type="button" class="ghost-btn" data-act="foods">🥫 Lebensmittel verwalten</button>`;
    foot.querySelector('[data-act="recipes"]').onclick = () => manageRecipes();
    foot.querySelector('[data-act="foods"]').onclick = () => manageFoods();
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
              <strong>${e.recipeId ? "🍲 " : ""}${esc(e.name)}</strong>
              <small class="muted">${esc(amountLabel(e))} · E ${fmt(e.protein, 1)} · K ${fmt(e.carbs, 1)} · F ${fmt(e.fat, 1)}</small>
            </span>
            <span class="meal-kcal">${fmt(e.kcal)}</span>
          </button>`).join("")}
      </div>
      <div class="row-actions">
        <button type="button" class="link-btn" data-act="add">+ Hinzufügen</button>
        ${!entries.length && yesterday.length ? `<button type="button" class="link-btn" data-act="copy">Wie am Vortag (${yesterday.length})</button>` : ""}
        ${entries.length >= 2 ? `<button type="button" class="link-btn" data-act="asRecipe">Als Gericht speichern</button>` : ""}
      </div>`;
    card.querySelector('[data-act="add"]').onclick = () => addEntry(meal);
    const copy = card.querySelector('[data-act="copy"]');
    if (copy) copy.onclick = () => {
      state.meals[day] = state.meals[day] || [];
      yesterday.forEach(e => state.meals[day].push({ ...e, id: F.uid() }));
      App.commit();
    };
    const asRecipe = card.querySelector('[data-act="asRecipe"]');
    if (asRecipe) asRecipe.onclick = () => editRecipe(null, {
      level: 1,
      prefill: { name: "", servings: 1, ingredients: entries.map(ingredientFromEntry) },
    });
    card.querySelectorAll("[data-id]").forEach(b => {
      b.onclick = () => editEntry(b.dataset.id);
    });
    return card;
  }

  function amountLabel(e) {
    if (e.unit === "portion") return `${fmt(e.amount, 2)} × ${e.portionName || "Portion"}`;
    if (e.unit === "ml") return `${fmt(e.amount)} ml`;
    return e.amount != null ? `${fmt(e.amount)} g` : "manuell";
  }

  // ---------- Lebensmittel: Hilfsfunktionen ----------

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

  function unitOf(food) {
    if (food.per === "portion") return "portion";
    return food.liquid ? "ml" : "g";
  }

  function perLabel(food) {
    if (food.per === "portion") return `pro ${food.portion?.name || "Portion"}`;
    return food.liquid ? "/ 100 ml" : "/ 100 g";
  }

  function defaultAmount(food) {
    if (food.per === "portion") return 1;
    return food.portion?.g || 100;
  }

  function catOf(food) {
    return food.cat || OWN_CAT;
  }

  function isOwn(food) {
    return state.foods.some(f => f.id === food.id);
  }

  // Groß-/Kleinschreibung und Umlaute ignorieren, alle Suchwörter müssen vorkommen.
  function normalize(s) {
    return String(s).toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/ß/g, "ss");
  }

  function matches(name, term) {
    const n = normalize(name);
    return normalize(term).split(/\s+/).filter(Boolean).every(w => n.includes(w));
  }

  // Zuletzt genutzte Lebensmittel und Gerichte zuerst.
  function lastUses() {
    const food = {};
    const recipe = {};
    for (const [k, list] of Object.entries(state.meals)) {
      for (const e of list) {
        if (e.foodId && (!food[e.foodId] || food[e.foodId] < k)) food[e.foodId] = k;
        if (e.recipeId && (!recipe[e.recipeId] || recipe[e.recipeId] < k)) recipe[e.recipeId] = k;
      }
    }
    return { food, recipe };
  }

  function sortedFoods(uses) {
    return F.foods(state).map(f => ({ ...f, lastUse: uses.food[f.id] || "" }))
      .sort((a, b) => b.lastUse.localeCompare(a.lastUse) || a.name.localeCompare(b.name, "de"));
  }

  function foodItemHtml(f) {
    return `
      <button type="button" class="pick-item" data-food="${esc(f.id)}">
        <strong>${esc(f.name)}${f.lastUse ? ` <span class="pill small">zuletzt</span>` : ""}${isOwn(f) ? ` <span class="pill small">eigenes</span>` : ""}</strong>
        <small class="muted">${fmt(f.kcal)} kcal ${perLabel(f)} · E ${fmt(f.protein, 1)} · K ${fmt(f.carbs, 1)} · F ${fmt(f.fat, 1)}</small>
      </button>`;
  }

  // ---------- Gerichte: Hilfsfunktionen ----------

  function recipes() {
    if (!Array.isArray(state.recipes)) state.recipes = [];
    return state.recipes;
  }

  function recipeTotals(recipe) {
    const t = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
    for (const ing of recipe.ingredients) {
      t.kcal += ing.kcal || 0;
      t.protein += ing.protein || 0;
      t.carbs += ing.carbs || 0;
      t.fat += ing.fat || 0;
    }
    return t;
  }

  // Ein Gericht verhält sich beim Eintragen wie ein Lebensmittel „pro Portion“.
  function recipeAsFood(recipe) {
    const t = recipeTotals(recipe);
    const n = recipe.servings || 1;
    return {
      id: recipe.id,
      name: recipe.name,
      isRecipe: true,
      per: "portion",
      portion: { name: "Portion", g: null },
      kcal: t.kcal / n,
      protein: t.protein / n,
      carbs: t.carbs / n,
      fat: t.fat / n,
    };
  }

  function recipeItemHtml(r, lastUse) {
    const f = recipeAsFood(r);
    return `
      <button type="button" class="pick-item recipe-item" data-recipe="${esc(r.id)}">
        <strong>🍲 ${esc(r.name)}${lastUse ? ` <span class="pill small">zuletzt</span>` : ""}</strong>
        <small class="muted">${fmt(f.kcal)} kcal pro Portion · E ${fmt(f.protein, 1)} · K ${fmt(f.carbs, 1)} · F ${fmt(f.fat, 1)} · ${r.ingredients.length} Zutat${r.ingredients.length === 1 ? "" : "en"}</small>
      </button>`;
  }

  function ingredientFromFood(food) {
    const amount = defaultAmount(food);
    return {
      id: F.uid(),
      foodId: food.id,
      name: food.name,
      amount,
      unit: unitOf(food),
      portionName: food.per === "portion" ? food.portion?.name || "Portion" : undefined,
      ...scaled(food, amount),
    };
  }

  function ingredientFromEntry(e) {
    return {
      id: F.uid(),
      foodId: e.foodId || null,
      name: e.name,
      amount: e.amount ?? null,
      unit: e.unit || "manual",
      portionName: e.portionName,
      kcal: e.kcal || 0,
      protein: e.protein || 0,
      carbs: e.carbs || 0,
      fat: e.fat || 0,
    };
  }

  // Menge einer Zutat ändern: aus dem Lebensmittel neu rechnen, sonst anteilig skalieren.
  function setIngredientAmount(ing, amount) {
    const food = ing.foodId && F.foods(state).find(f => f.id === ing.foodId);
    if (food && unitOf(food) === ing.unit) {
      Object.assign(ing, scaled(food, amount));
    } else if (ing.amount > 0) {
      const r = amount / ing.amount;
      ing.kcal = Math.round(ing.kcal * r);
      ing.protein = F.round(ing.protein * r, 1);
      ing.carbs = F.round(ing.carbs * r, 1);
      ing.fat = F.round(ing.fat * r, 1);
    }
    ing.amount = amount;
  }

  // Werte aktualisieren, falls ein Lebensmittel inzwischen korrigiert wurde.
  function refreshIngredient(ing) {
    if (ing.amount > 0) setIngredientAmount(ing, ing.amount);
  }

  // ---------- Auswahl: Lebensmittel (und Gerichte) ----------

  // opts: title, level, withRecipes, actions [{ label, onClick(close) }], onFood(food, close), onRecipe(recipe, close)
  function foodPicker(opts) {
    let term = "";
    let cat = "";
    App.sheet(opts.title, (body, close) => {
      body.innerHTML = `
        <div class="search-row">
          <input type="search" class="search" placeholder="${opts.withRecipes ? "Lebensmittel oder Gericht suchen…" : "Lebensmittel suchen…"}" autofocus>
          ${opts.onScan ? `<button type="button" class="ghost-btn scan-btn" aria-label="Barcode scannen">📷 Scannen</button>` : ""}
        </div>
        <div class="chip-row cat-row"></div>
        <div class="pick-list"></div>
        <div class="row-actions">
          ${(opts.actions || []).map((a, i) => `<button type="button" class="ghost-btn" data-action="${i}">${esc(a.label)}</button>`).join("")}
        </div>`;
      const catRow = body.querySelector(".cat-row");
      const listEl = body.querySelector(".pick-list");

      const drawCats = () => {
        const all = F.foods(state);
        const cats = [["", "Alle"]];
        if (opts.withRecipes && recipes().length) cats.push(["@gerichte", "🍲 Gerichte"]);
        if (all.some(f => !f.cat)) cats.push([OWN_CAT, OWN_CAT]);
        CATEGORIES.forEach(c => { if (all.some(f => f.cat === c)) cats.push([c, c]); });
        catRow.innerHTML = cats.map(([v, l]) =>
          `<button type="button" class="chip-btn ${v === cat ? "on" : ""}" data-cat="${esc(v)}">${esc(l)}</button>`).join("");
        catRow.querySelectorAll("[data-cat]").forEach(b => {
          b.onclick = () => { cat = b.dataset.cat; drawCats(); draw(); };
        });
      };

      const draw = () => {
        const uses = lastUses();
        let html = "";
        let count = 0;
        if (opts.withRecipes && (cat === "" || cat === "@gerichte")) {
          const rs = recipes()
            .filter(r => !term || matches(r.name, term))
            .sort((a, b) => (uses.recipe[b.id] || "").localeCompare(uses.recipe[a.id] || "") || a.name.localeCompare(b.name, "de"));
          html += rs.map(r => recipeItemHtml(r, uses.recipe[r.id])).join("");
          count += rs.length;
        }
        if (cat !== "@gerichte") {
          const fs = sortedFoods(uses)
            .filter(f => !cat || catOf(f) === cat)
            .filter(f => !term || matches(f.name, term));
          html += fs.slice(0, LIST_LIMIT).map(foodItemHtml).join("");
          if (fs.length > LIST_LIMIT) {
            html += `<p class="muted small-text center-text">… und ${fs.length - LIST_LIMIT} weitere – such danach oder wähle eine Kategorie.</p>`;
          }
          count += fs.length;
        }
        if (!count) {
          html = cat === "@gerichte" && !term
            ? `<p class="muted">Noch keine Gerichte gespeichert.</p>`
            : `<p class="muted">Nichts gefunden – lege es neu an oder trage es manuell ein.</p>`;
        }
        listEl.innerHTML = html;
        listEl.querySelectorAll("[data-food]").forEach(b => {
          b.onclick = () => opts.onFood(F.foods(state).find(f => f.id === b.dataset.food), close);
        });
        listEl.querySelectorAll("[data-recipe]").forEach(b => {
          b.onclick = () => opts.onRecipe(recipes().find(r => r.id === b.dataset.recipe), close);
        });
      };

      body.querySelector(".search").oninput = e => { term = e.target.value.trim(); draw(); };
      const scanBtn = body.querySelector(".scan-btn");
      if (scanBtn) scanBtn.onclick = () => opts.onScan(close);
      body.querySelectorAll("[data-action]").forEach(b => {
        b.onclick = () => opts.actions[Number(b.dataset.action)].onClick(close);
      });
      drawCats();
      draw();
    }, opts.level);
  }

  // ---------- Barcode ----------

  // Scannen (Fenster auf `level`), dann: bekannter Barcode → direkt übernehmen,
  // sonst Open Food Facts fragen und das Ergebnis zum Prüfen im Formular zeigen.
  // onFood(food) wird mit geschlossenem Scanner-Fenster aufgerufen.
  function scanFood(level, onFood) {
    Barcode.openScanner(level, async (code, ui) => {
      const known = F.foods(state).find(f => f.barcode === code);
      if (known) {
        ui.close();
        onFood(known, { known: true });
        return;
      }
      ui.status(`Suche ${code} in Open Food Facts…`);
      let result;
      try {
        result = await Barcode.lookup(code);
      } catch {
        editFood(null, onFood, level, {
          barcode: code,
          note: "Open Food Facts war nicht erreichbar. Trag die Werte von der Verpackung ein – beim nächsten Scan wird das Produkt dann erkannt.",
        });
        return;
      }
      if (result.found) {
        const missing = result.food.kcal == null;
        editFood(null, onFood, level, {
          ...result.food,
          note: missing
            ? "Gefunden, aber ohne vollständige Nährwerte. Bitte ergänze sie von der Verpackung."
            : "Gefunden in Open Food Facts. Prüfe die Werte kurz und speichere – danach erkennt dein Planer den Barcode sofort.",
        });
      } else {
        editFood(null, onFood, level, {
          barcode: code,
          note: `Barcode ${code} ist nicht in der Datenbank. Trag die Werte von der Verpackung ein – beim nächsten Scan wird das Produkt dann erkannt.`,
        });
      }
    });
  }

  // ---------- Einträge ----------

  function addEntry(meal) {
    foodPicker({
      title: `${meal.label} hinzufügen`,
      level: 1,
      withRecipes: true,
      onScan: close => scanFood(2, food => { if (food) amountSheet(meal, food, null, close); }),
      onFood: (food, close) => amountSheet(meal, food, null, close),
      onRecipe: (recipe, close) => amountSheet(meal, recipeAsFood(recipe), null, close),
      actions: [
        { label: "Manuell eintragen", onClick: close => manualSheet(meal, null, close) },
        { label: "+ Neues Lebensmittel", onClick: close => editFood(null, food => { if (food) amountSheet(meal, food, null, close); }) },
        { label: "+ Neues Gericht", onClick: close => editRecipe(null, {
          level: 2,
          onDone: recipe => { if (recipe) amountSheet(meal, recipeAsFood(recipe), null, close); },
        }) },
      ],
    });
  }

  // Menge wählen (Stufe 2). entry = bestehender Eintrag zum Bearbeiten.
  function amountSheet(meal, food, entry, closeParent) {
    const unit = unitOf(food);
    const isPortion = unit === "portion";
    const startAmount = entry ? entry.amount : defaultAmount(food);
    App.sheet(food.name, (body, close) => {
      body.innerHTML = `
        <label class="field">${isPortion ? `Anzahl (${esc(food.portion?.name || "Portion")})` : `Menge in ${unit}`}
          <input type="text" inputmode="decimal" id="amount" value="${inVal(startAmount)}">
        </label>
        <div class="chip-row">
          ${isPortion
            ? [0.5, 1, 1.5, 2].map(n => `<button type="button" class="chip-btn" data-amt="${n}">${fmt(n, 1)}×</button>`).join("")
            : [
              food.portion?.g ? `<button type="button" class="chip-btn" data-amt="${food.portion.g}">1 ${esc(food.portion.name)} (${food.portion.g} ${unit})</button>` : "",
              food.portion?.g ? `<button type="button" class="chip-btn" data-amt="${food.portion.g * 2}">2 × ${esc(food.portion.name)}</button>` : "",
              `<button type="button" class="chip-btn" data-amt="100">100 ${unit}</button>`,
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
        const data = {
          foodId: food.isRecipe ? null : food.id,
          name: food.name,
          amount,
          unit,
          portionName: isPortion ? food.portion?.name || "Portion" : undefined,
          ...scaled(food, amount),
        };
        if (food.isRecipe) data.recipeId = food.id;
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
    const recipe = entry.recipeId && recipes().find(r => r.id === entry.recipeId);
    const source = food || (recipe && recipeAsFood(recipe));
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
          <button type="button" class="ghost-btn" data-act="edit">${source ? "Menge ändern" : "Werte ändern"}</button>
        </div>`;
      body.querySelector("#moveMeal").onchange = e => {
        entry.meal = e.target.value;
        App.commit();
      };
      body.querySelector('[data-act="edit"]').onclick = () => {
        const meal = MEALS.find(m => m.id === entry.meal);
        if (source) amountSheet(meal, source, entry, close);
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

  // ---------- Gerichte ----------

  function manageRecipes() {
    App.sheet("Meine Gerichte", (body) => {
      const draw = () => {
        const list = [...recipes()].sort((a, b) => a.name.localeCompare(b.name, "de"));
        body.innerHTML = `
          <p class="muted small-text">Stell dir Gerichte aus Lebensmitteln zusammen und trag sie später mit einem Klick als Portion ein.</p>
          <div class="pick-list">
            ${list.map(r => recipeItemHtml(r)).join("") || `<p class="muted">Noch keine Gerichte. Tipp: Unter einer Mahlzeit mit mehreren Einträgen kannst du auch „Als Gericht speichern“ wählen.</p>`}
          </div>
          <button type="button" class="primary-btn wide" data-act="new">+ Neues Gericht</button>`;
        body.querySelectorAll("[data-recipe]").forEach(b => {
          b.onclick = () => editRecipe(b.dataset.recipe, { level: 2, onDone: draw });
        });
        body.querySelector('[data-act="new"]').onclick = () => editRecipe(null, { level: 2, onDone: draw });
      };
      draw();
    });
  }

  // Gericht anlegen/bearbeiten. opts: level, prefill, onDone(recipe|null)
  function editRecipe(id, opts = {}) {
    const level = opts.level || 2;
    const existing = id ? recipes().find(r => r.id === id) : null;
    const src = existing || opts.prefill || { name: "", servings: 1, ingredients: [] };
    // Arbeitskopie, damit „Schließen“ nichts verändert.
    const draft = {
      name: src.name,
      servings: src.servings || 1,
      ingredients: src.ingredients.map(i => ({ ...i })),
    };
    draft.ingredients.forEach(refreshIngredient);

    App.sheet(existing ? existing.name : "Neues Gericht", (body, close) => {
      body.innerHTML = `
        <label class="field">Name des Gerichts
          <input type="text" id="rName" maxlength="60" value="${esc(draft.name)}" placeholder="z. B. Overnight Oats">
        </label>
        <label class="field">Ergibt Portionen
          <input type="text" inputmode="decimal" id="rServings" value="${inVal(draft.servings)}">
        </label>
        <h3 class="sub-head">Zutaten</h3>
        <div class="ing-list" id="ingList"></div>
        <button type="button" class="ghost-btn wide" data-act="addIng">+ Zutat hinzufügen</button>
        <div class="recipe-sum" id="rSum"></div>
        <div class="sheet-actions">
          ${existing ? `<button type="button" class="danger-btn" data-act="delete">Löschen</button>` : ""}
          <span class="grow"></span>
          <button type="button" class="primary-btn" data-act="save">Speichern</button>
        </div>`;
      const nameIn = body.querySelector("#rName");
      const servIn = body.querySelector("#rServings");
      const ingList = body.querySelector("#ingList");
      const sumEl = body.querySelector("#rSum");

      const drawSum = () => {
        const t = recipeTotals(draft);
        const n = num(servIn.value) > 0 ? num(servIn.value) : 1;
        sumEl.innerHTML = draft.ingredients.length ? `
          <div class="recipe-sum-row"><span>Gesamt</span><strong>${fmt(t.kcal)} kcal</strong>
            <small class="muted">E ${fmt(t.protein, 1)} · K ${fmt(t.carbs, 1)} · F ${fmt(t.fat, 1)}</small></div>
          <div class="recipe-sum-row main"><span>Pro Portion</span><strong>${fmt(t.kcal / n)} kcal</strong>
            <small class="muted">E ${fmt(t.protein / n, 1)} · K ${fmt(t.carbs / n, 1)} · F ${fmt(t.fat / n, 1)}</small></div>` : "";
      };

      const drawIngredients = () => {
        ingList.innerHTML = draft.ingredients.map((ing, i) => `
          <div class="ing-row" data-i="${i}">
            <span class="grow">
              <strong class="ellipsis">${esc(ing.name)}</strong>
              <small class="muted ing-kcal">${fmt(ing.kcal)} kcal</small>
            </span>
            ${ing.amount != null && ing.unit !== "manual" ? `
              <span class="ing-amount">
                <input type="text" inputmode="decimal" value="${inVal(ing.amount)}" aria-label="Menge ${esc(ing.name)}">
                <span class="muted">${ing.unit === "portion" ? `× ${esc(ing.portionName || "Portion")}` : ing.unit}</span>
              </span>` : `<span class="muted small-text">fest</span>`}
            <button type="button" class="icon-btn small" data-remove="${i}" aria-label="${esc(ing.name)} entfernen">✕</button>
          </div>`).join("") || `<p class="muted small-text">Noch keine Zutaten.</p>`;
        ingList.querySelectorAll(".ing-row").forEach(row => {
          const ing = draft.ingredients[Number(row.dataset.i)];
          const input = row.querySelector("input");
          if (input) input.oninput = () => {
            const amount = num(input.value);
            if (!amount || amount <= 0) return;
            setIngredientAmount(ing, amount);
            row.querySelector(".ing-kcal").textContent = `${fmt(ing.kcal)} kcal`;
            drawSum();
          };
        });
        ingList.querySelectorAll("[data-remove]").forEach(b => {
          b.onclick = () => {
            draft.ingredients.splice(Number(b.dataset.remove), 1);
            drawIngredients();
          };
        });
        drawSum();
      };

      servIn.oninput = drawSum;
      body.querySelector('[data-act="addIng"]').onclick = () => foodPicker({
        title: "Zutat hinzufügen",
        level: level + 1,
        withRecipes: false,
        // Der Scanner ersetzt die Auswahl im selben Fenster.
        onScan: () => scanFood(level + 1, food => {
          if (!food) return;
          draft.ingredients.push(ingredientFromFood(food));
          drawIngredients();
        }),
        onFood: (food, closePicker) => {
          draft.ingredients.push(ingredientFromFood(food));
          closePicker();
          drawIngredients();
          const inputs = ingList.querySelectorAll("input");
          if (inputs.length) inputs[inputs.length - 1].select();
        },
        actions: [
          { label: "+ Neues Lebensmittel", onClick: closePicker => {
            closePicker();
            editFood(null, food => {
              if (!food) return;
              draft.ingredients.push(ingredientFromFood(food));
              drawIngredients();
            }, level + 1);
          } },
        ],
      });

      body.querySelector('[data-act="save"]').onclick = () => {
        const name = nameIn.value.trim();
        const servings = num(servIn.value);
        if (!name) { App.toast("Bitte einen Namen eingeben"); return; }
        if (!draft.ingredients.length) { App.toast("Bitte mindestens eine Zutat hinzufügen"); return; }
        if (!servings || servings <= 0) { App.toast("Bitte die Anzahl Portionen angeben"); return; }
        const data = { name, servings, ingredients: draft.ingredients };
        let recipe;
        if (existing) {
          recipe = Object.assign(existing, data);
        } else {
          recipe = { id: "gericht-" + F.uid(), createdAt: Date.now(), ...data };
          recipes().push(recipe);
        }
        close();
        App.commit();
        App.toast(`„${name}“ gespeichert`);
        if (opts.onDone) opts.onDone(recipe);
      };

      const del = body.querySelector('[data-act="delete"]');
      if (del) del.onclick = () => {
        const list = recipes();
        const idx = list.indexOf(existing);
        list.splice(idx, 1);
        close();
        App.commit();
        if (opts.onDone) opts.onDone(null);
        App.toast(`„${existing.name}“ gelöscht`, () => {
          recipes().splice(idx, 0, existing);
          App.commit();
          if (opts.onDone) opts.onDone(existing);
        });
      };

      drawIngredients();
    }, level);
  }

  // ---------- Lebensmittel verwalten ----------

  function manageFoods() {
    foodPicker({
      title: "Lebensmittel",
      level: 1,
      withRecipes: false,
      // Bekanntes Produkt gleich zum Bearbeiten öffnen, neues ist schon gespeichert.
      onScan: () => scanFood(2, (food, info) => {
        if (food && info?.known) editFood(food.id, () => manageFoods());
        else manageFoods();
      }),
      onFood: (food) => editFood(food.id, () => manageFoods()),
      actions: [
        { label: "+ Neues Lebensmittel", onClick: () => editFood(null, () => manageFoods()) },
      ],
    });
  }

  // Lebensmittel anlegen/bearbeiten. Mitgelieferte werden beim Speichern als eigene Kopie abgelegt.
  // prefill: Vorschlag für ein neues Lebensmittel (z. B. aus dem Barcode-Scan), optional mit note.
  function editFood(id, onDone, level = 2, prefill = null) {
    const existing = id ? F.foods(state).find(f => f.id === id) : null;
    const own = existing && isOwn(existing);
    const blank = { name: "", kcal: null, protein: null, carbs: null, fat: null, per: "100g", portion: { name: "Portion", g: null } };
    App.sheet(existing ? existing.name : prefill?.name ? "Produkt übernehmen" : "Neues Lebensmittel", (body, close) => {
      const f = existing || { ...blank, ...(prefill || {}) };
      body.innerHTML = `
        ${existing && !own ? `<p class="muted small-text">Mitgelieferter Richtwert. Beim Speichern wird eine eigene Kopie angelegt.</p>` : ""}
        ${prefill?.note ? `<p class="scan-note">${esc(prefill.note)}</p>` : ""}
        <label class="field">Name<input type="text" id="fName" maxlength="60" value="${esc(f.name)}"></label>
        <div class="form-grid">
          <label class="field">Kategorie
            <select id="fCat">
              <option value="">${OWN_CAT}</option>
              ${CATEGORIES.map(c => `<option ${f.cat === c ? "selected" : ""}>${esc(c)}</option>`).join("")}
            </select>
          </label>
          <label class="field">Angaben
            <select id="fPer">
              <option value="100g" ${f.per !== "portion" ? "selected" : ""}>pro 100 g / 100 ml</option>
              <option value="portion" ${f.per === "portion" ? "selected" : ""}>pro Portion / Stück</option>
            </select>
          </label>
          <label class="field">kcal<input type="text" inputmode="numeric" id="fKcal" value="${inVal(f.kcal)}"></label>
          <label class="field">Eiweiß (g)<input type="text" inputmode="decimal" id="fP" value="${inVal(f.protein)}"></label>
          <label class="field">Kohlenhydrate (g)<input type="text" inputmode="decimal" id="fC" value="${inVal(f.carbs)}"></label>
          <label class="field">Fett (g)<input type="text" inputmode="decimal" id="fF" value="${inVal(f.fat)}"></label>
          <label class="field">Portionsname<input type="text" id="fPortName" maxlength="20" value="${esc(f.portion?.name || "Portion")}"></label>
          <label class="field" id="fPortGField">Portion in g/ml<input type="text" inputmode="numeric" id="fPortG" value="${inVal(f.portion?.g)}"></label>
        </div>
        <label class="field">Barcode (optional)<input type="text" inputmode="numeric" id="fBarcode" maxlength="14" value="${esc(f.barcode || "")}" placeholder="wird beim Scannen erkannt"></label>
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
        const barcode = body.querySelector("#fBarcode").value.replace(/\s/g, "");
        if (barcode && !Barcode.valid(barcode)) { App.toast("Der Barcode muss 8 bis 14 Ziffern haben"); return; }
        const cat = body.querySelector("#fCat").value;
        const data = {
          barcode: barcode || undefined,
          source: f.source || undefined,
          name,
          cat: cat || undefined,
          liquid: cat === "Getränke" || undefined,
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
    }, level);
  }

  function hideBuiltin(id) {
    state.hiddenFoods = state.hiddenFoods || [];
    if (!state.hiddenFoods.includes(id)) state.hiddenFoods.push(id);
  }

  App.view("ernaehrung", { render });
  return { manageFoods, manageRecipes, recipeCount: () => recipes().length };
})();
