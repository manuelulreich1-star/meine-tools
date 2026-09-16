// Laden/Speichern und Berechnungen des Fitnessplaners.
// Wird vom Fitnessplaner, vom Dashboard (Zähler) und vom Kalender (Trainingstage) genutzt.
window.FitnessDaten = (function () {
  const STORAGE_KEY = "mein-fitness";
  const WEEKDAYS = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

  // Aktivität im Alltag ohne Training – das Training wird separat hinzugerechnet.
  const ACTIVITY = {
    sitzend: { factor: 1.2, label: "Überwiegend sitzend (Büro, Schule)" },
    leicht: { factor: 1.375, label: "Leicht aktiv (viel zu Fuß, stehend)" },
    aktiv: { factor: 1.55, label: "Aktiv (körperliche Arbeit)" },
    sehr: { factor: 1.725, label: "Sehr aktiv (schwere körperliche Arbeit)" },
  };

  const DEFAULT_PROFILE = {
    setupDone: false,
    sex: "m",
    birthYear: null,
    height: null,
    activity: "sitzend",
    goalWeight: null,
    deficit: 500,
    kcalOverride: null,
    stepGoal: 8000,
    waterGoal: 2500,
    sleepGoal: 8,
  };

  function pad(n) { return String(n).padStart(2, "0"); }

  function keyOf(d) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function todayKey() { return keyOf(new Date()); }

  function parseKey(key) { return new Date(key + "T00:00:00"); }

  function addDays(key, n) {
    const d = parseKey(key);
    d.setDate(d.getDate() + n);
    return keyOf(d);
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function round(n, digits = 0) {
    const f = 10 ** digits;
    return Math.round(n * f) / f;
  }

  // ---------- Laden & Speichern ----------

  function emptyState() {
    return {
      version: 1,
      profile: { ...DEFAULT_PROFILE },
      customExercises: [],
      workouts: [],
      week: {},
      planSince: null,
      sessions: [],
      active: null,
      body: {},
      foods: [],
      meals: {},
    };
  }

  function load() {
    let state;
    try {
      state = JSON.parse(localStorage.getItem(STORAGE_KEY));
    } catch {
      state = null;
    }
    const base = emptyState();
    if (!state || typeof state !== "object") return base;
    return { ...base, ...state, profile: { ...base.profile, ...(state.profile || {}) } };
  }

  function save(state) {
    state.updatedAt = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  // ---------- Stammdaten ----------

  function exercises(state) {
    const builtin = typeof FITNESS_UEBUNGEN === "undefined" ? [] : FITNESS_UEBUNGEN;
    return [...builtin, ...state.customExercises];
  }

  function exerciseById(state, id) {
    return exercises(state).find(e => e.id === id)
      || { id, name: "Unbekannte Übung", group: "Sonstiges", type: "kraft" };
  }

  function foods(state) {
    const builtin = typeof FITNESS_LEBENSMITTEL === "undefined" ? [] : FITNESS_LEBENSMITTEL;
    const hidden = new Set(state.hiddenFoods || []);
    return [...state.foods, ...builtin.filter(f => !hidden.has(f.id))];
  }

  function workoutById(state, id) {
    return state.workouts.find(w => w.id === id) || null;
  }

  // ---------- Körper ----------

  // Letzter bekannter Wert (z. B. Gewicht) am oder vor dem Datum.
  function latestBody(state, field, key = todayKey()) {
    const keys = Object.keys(state.body).filter(k => k <= key && state.body[k][field] != null).sort();
    if (!keys.length) return null;
    const k = keys[keys.length - 1];
    return { date: k, value: state.body[k][field] };
  }

  function currentWeight(state, key) {
    const w = latestBody(state, "weight", key);
    return w ? w.value : null;
  }

  function age(profile) {
    return profile.birthYear ? new Date().getFullYear() - profile.birthYear : null;
  }

  function bmi(weight, height) {
    if (!weight || !height) return null;
    return weight / ((height / 100) ** 2);
  }

  function bmiCategory(value) {
    if (value == null) return "";
    if (value < 18.5) return "Untergewicht";
    if (value < 25) return "Normalgewicht";
    if (value < 30) return "Übergewicht";
    return "Adipositas";
  }

  // Grundumsatz nach Mifflin-St Jeor.
  function bmr(state, key) {
    const p = state.profile;
    const w = currentWeight(state, key);
    const a = age(p);
    if (!w || !p.height || !a) return null;
    return 10 * w + 6.25 * p.height - 5 * a + (p.sex === "w" ? -161 : 5);
  }

  function tdee(state, key) {
    const b = bmr(state, key);
    if (b == null) return null;
    return b * (ACTIVITY[state.profile.activity] || ACTIVITY.sitzend).factor;
  }

  // ---------- Training & Kalorien ----------

  // MET abhängig vom Tempo, falls Strecke und Dauer bekannt sind.
  function cardioMet(ex, duration, distance) {
    const speed = duration && distance ? distance / (duration / 60) : null;
    if (!speed) return ex.met || 6;
    if (ex.kind === "laufen") return Math.min(16, Math.max(6, speed));
    if (ex.kind === "gehen") return speed < 4 ? 2.8 : speed < 5.5 ? 3.5 : speed < 6.5 ? 4.3 : 5;
    if (ex.kind === "rad") return speed < 16 ? 4 : speed < 19 ? 6.8 : speed < 22 ? 8 : speed < 25 ? 10 : 12;
    return ex.met || 6;
  }

  // Zusätzlich verbrannte kcal (Netto: MET − 1, weil der Grundumsatz schon im Tagesbedarf steckt).
  function sessionKcal(state, session) {
    const w = currentWeight(state, session.date);
    if (!w) return 0;
    let kcal = 0;
    let cardioMin = 0;
    let strengthMet = 0;
    let strengthCount = 0;
    for (const entry of session.entries) {
      const ex = exerciseById(state, entry.exerciseId);
      if (ex.type === "cardio") {
        if (!entry.done || !entry.duration) continue;
        const met = cardioMet(ex, entry.duration, entry.distance);
        kcal += (met - 1) * w * entry.duration / 60;
        cardioMin += entry.duration;
      } else if (entry.sets.some(s => s.done)) {
        strengthMet += ex.met || (ex.type === "kraft" ? 5 : 4);
        strengthCount++;
      }
    }
    if (strengthCount) {
      const restMin = Math.max(0, session.durationSec / 60 - cardioMin);
      kcal += (strengthMet / strengthCount - 1) * w * restMin / 60;
    }
    return Math.round(kcal);
  }

  function sessionsOn(state, key) {
    return state.sessions.filter(s => s.date === key);
  }

  function trainingKcal(state, key) {
    return sessionsOn(state, key).reduce((sum, s) => sum + (s.kcal || 0), 0);
  }

  // Tagesziel = Bedarf − Defizit + Training (oder festes Ziel + Training).
  function kcalTarget(state, key) {
    const p = state.profile;
    const base = p.kcalOverride || (tdee(state, key) != null ? tdee(state, key) - (p.deficit || 0) : null);
    if (base == null) return null;
    return Math.round(base + trainingKcal(state, key));
  }

  function macroTargets(state, key) {
    const kcal = kcalTarget(state, key);
    const weight = state.profile.goalWeight || currentWeight(state, key);
    if (!kcal || !weight) return null;
    const protein = Math.round(1.8 * weight);
    const fat = Math.round(kcal * 0.25 / 9);
    const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
    return { kcal, protein, fat, carbs };
  }

  function mealTotals(state, key) {
    const t = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
    for (const m of state.meals[key] || []) {
      t.kcal += m.kcal || 0;
      t.protein += m.protein || 0;
      t.carbs += m.carbs || 0;
      t.fat += m.fat || 0;
    }
    return { kcal: Math.round(t.kcal), protein: round(t.protein), carbs: round(t.carbs), fat: round(t.fat) };
  }

  // Epley-Formel für das geschätzte Maximalgewicht.
  function e1rm(weight, reps) {
    if (!weight || !reps) return 0;
    return reps === 1 ? weight : weight * (1 + reps / 30);
  }

  function isTimed(ex) { return ex.measure === "time"; }

  // Letzte erledigte Ausführung einer Übung vor dem Datum.
  function lastPerformance(state, exerciseId, beforeKey = null) {
    const sessions = state.sessions
      .filter(s => !beforeKey || s.date <= beforeKey)
      .sort((a, b) => (b.date + (b.start || "")).localeCompare(a.date + (a.start || "")));
    for (const s of sessions) {
      const entry = s.entries.find(e => e.exerciseId === exerciseId);
      if (!entry) continue;
      if (entry.sets && entry.sets.some(x => x.done)) return { date: s.date, entry };
      if (entry.done) return { date: s.date, entry };
    }
    return null;
  }

  // Vorschlag für das nächste Training einer Übung.
  function suggestion(state, item) {
    const ex = exerciseById(state, item.exerciseId);
    const last = lastPerformance(state, item.exerciseId);
    if (ex.type === "cardio") {
      if (!last || !last.entry.done) return { duration: item.duration, distance: item.distance, text: "" };
      const prevDur = last.entry.duration || item.duration || 0;
      const prevDist = last.entry.distance || null;
      const reached = prevDur >= (item.duration || 0);
      return {
        duration: reached ? prevDur + 2 : (item.duration || prevDur),
        distance: prevDist,
        text: reached ? "↑ 2 Min. länger als letztes Mal" : "Ziel vom letzten Mal nochmal angehen",
        up: reached,
      };
    }

    const reps = item.reps || 10;
    if (!last) return { weight: item.weight ?? null, reps, text: ex.type === "kraft" ? "Erstes Mal: Startgewicht wählen" : "" };

    const done = last.entry.sets.filter(s => s.done);
    const lastWeight = Math.max(0, ...done.map(s => s.weight || 0));
    const allReached = done.length >= (item.sets || 1) && done.every(s => (s.reps || 0) >= reps);
    const rpes = done.map(s => s.rpe).filter(Boolean);
    const hard = rpes.length && rpes.reduce((a, b) => a + b, 0) / rpes.length >= 9.5;

    if (ex.type === "kraft") {
      if (allReached && !hard) {
        const inc = ex.inc || 2.5;
        return { weight: round(lastWeight + inc, 2), reps, text: `↑ +${String(inc).replace(".", ",")} kg`, up: true };
      }
      return { weight: lastWeight || item.weight || null, reps, text: allReached ? "Gewicht halten (war sehr schwer)" : "Gewicht halten, Wdh. schaffen" };
    }

    // Körpergewicht: mehr Wiederholungen bzw. Sekunden.
    const best = Math.max(0, ...done.map(s => s.reps || 0));
    if (allReached && !hard) {
      const step = isTimed(ex) ? 5 : 1;
      return { weight: null, reps: Math.max(reps, best) + step, text: isTimed(ex) ? "↑ +5 Sek." : "↑ +1 Wdh.", up: true };
    }
    return { weight: null, reps, text: "Ziel vom letzten Mal nochmal angehen" };
  }

  // Geschätzte Dauer einer Einheit in Minuten (Kraft inkl. Aufwärmen und Umbauen).
  function workoutMinutes(state, workout) {
    let sec = 0;
    let strength = false;
    for (const item of workout.items) {
      const ex = exerciseById(state, item.exerciseId);
      if (ex.type === "cardio") sec += (item.duration || 0) * 60;
      else {
        strength = true;
        sec += (item.sets || 1) * ((isTimed(ex) ? item.reps || 30 : 45) + (item.rest || 60)) + 60;
      }
    }
    if (strength) sec += 8 * 60;
    return Math.max(10, Math.round(sec / 60 / 5) * 5);
  }

  // ---------- Wochenplan ----------

  function plannedOn(state, key) {
    const list = state.week[parseKey(key).getDay()] || [];
    return list
      .map(p => ({ ...p, workout: workoutById(state, p.workoutId) }))
      .filter(p => p.workout)
      .sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99"));
  }

  function isPlanDone(state, key, workoutId) {
    return state.sessions.some(s => s.date === key && s.workoutId === workoutId);
  }

  // Geplante Trainings in Folge erledigt (heute zählt erst, wenn erledigt).
  // Ohne Wochenplan: Tage in Folge mit Training.
  function streak(state) {
    const hasPlan = Object.values(state.week).some(l => l && l.length);
    const today = todayKey();
    const first = state.sessions.map(s => s.date).sort()[0];
    if (!first) return 0;
    let count = 0;
    let key = today;
    const stop = hasPlan && state.planSince && state.planSince > first ? state.planSince : first;
    for (let i = 0; i < 3660 && key >= stop; i++, key = addDays(key, -1)) {
      const trained = sessionsOn(state, key).length;
      if (hasPlan) {
        const planned = plannedOn(state, key);
        for (const p of planned) {
          if (isPlanDone(state, key, p.workoutId)) count++;
          else if (key !== today) return count;
        }
        // Zusätzliche Trainings an freien Tagen zählen mit.
        count += sessionsOn(state, key).filter(s => !planned.some(p => p.workoutId === s.workoutId)).length;
      } else if (trained) {
        count++;
      } else if (key !== today) {
        return count;
      }
    }
    return count;
  }

  function weekStart(key) {
    const d = parseKey(key);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return keyOf(d);
  }

  function weekProgress(state, key = todayKey()) {
    const start = weekStart(key);
    let planned = 0;
    let done = 0;
    for (let i = 0; i < 7; i++) {
      const k = addDays(start, i);
      planned += plannedOn(state, k).length;
      done += sessionsOn(state, k).length;
    }
    return { planned, done };
  }

  // ---------- Verknüpfungen ----------

  const COLORS = ["blue", "green", "orange", "pink", "purple"];

  function addMinutes(time, min) {
    const [h, m] = time.split(":").map(Number);
    const total = Math.min(23 * 60 + 59, h * 60 + m + min);
    return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
  }

  // Trainings als Termine für den Kalender (nur lesend, Klick öffnet den Fitnessplaner).
  function calendarEvents(date, state = load()) {
    const key = keyOf(date);
    const link = "../fitness/index.html";
    const events = [];
    const sessions = sessionsOn(state, key);
    const planned = key >= todayKey() ? plannedOn(state, key) : [];

    for (const p of planned) {
      const done = sessions.some(s => s.workoutId === p.workoutId);
      events.push({
        id: `fitness-plan-${key}-${p.workoutId}`,
        title: `${done ? "✓" : "🏋️"} ${p.workout.name}`,
        date: key,
        time: p.time || "",
        endTime: p.time ? addMinutes(p.time, workoutMinutes(state, p.workout)) : "",
        color: COLORS.includes(p.workout.color) ? p.workout.color : "green",
        priority: "medium",
        note: done ? "Training erledigt – Details im Fitnessplaner" : "Geplantes Training – öffnet den Fitnessplaner",
        link,
      });
    }
    for (const s of sessions) {
      if (planned.some(p => p.workoutId === s.workoutId)) continue;
      const w = workoutById(state, s.workoutId);
      events.push({
        id: `fitness-session-${s.id}`,
        title: `✓ ${s.name}`,
        date: key,
        time: s.start || "",
        endTime: s.start ? addMinutes(s.start, Math.round(s.durationSec / 60)) : "",
        color: w && COLORS.includes(w.color) ? w.color : "green",
        priority: "low",
        note: `${Math.round(s.durationSec / 60)} Min.${s.kcal ? `, ca. ${s.kcal} kcal` : ""}`,
        link,
      });
    }
    return events;
  }

  // Zähler fürs Dashboard: offene Trainings heute + fehlendes Gewicht.
  function stats(state) {
    const today = todayKey();
    if (!state.profile.setupDone) {
      return { count: 1, news: ["Profil einrichten"] };
    }
    const planned = plannedOn(state, today);
    const open = planned.filter(p => !isPlanDone(state, today, p.workoutId));
    const doneToday = sessionsOn(state, today);
    const weightMissing = !(state.body[today] && state.body[today].weight != null);
    const news = [];
    if (state.active) news.push({ text: `Läuft: ${state.active.name}`, urgent: true });
    open.forEach(p => news.push(`Heute: ${p.workout.name}${p.time ? ` um ${p.time}` : ""}`));
    doneToday.forEach(s => news.push(`✓ ${s.name}`));
    if (weightMissing) news.push("Gewicht eintragen");
    const target = kcalTarget(state, today);
    const eaten = mealTotals(state, today).kcal;
    if (target && eaten) {
      const left = target - eaten;
      const n = Math.abs(left).toLocaleString("de-DE");
      news.push(left >= 0 ? `noch ${n} kcal` : { text: `${n} kcal über Ziel`, urgent: true });
    }
    return { count: open.length + (weightMissing ? 1 : 0), news };
  }

  // Kennzahlen für die geplante Statistik-Kachel im Dashboard.
  function summary(state = load()) {
    const today = todayKey();
    const weight = latestBody(state, "weight", today);
    const monthAgo = latestBody(state, "weight", addDays(today, -30));
    return {
      weight: weight ? weight.value : null,
      weightChange30: weight && monthAgo ? round(weight.value - monthAgo.value, 1) : null,
      goalWeight: state.profile.goalWeight,
      week: weekProgress(state, today),
      streak: streak(state),
      sessionsTotal: state.sessions.length,
      kcalTarget: kcalTarget(state, today),
      kcalEaten: mealTotals(state, today).kcal,
    };
  }

  return {
    STORAGE_KEY, WEEKDAYS, ACTIVITY, pad, keyOf, todayKey, parseKey, addDays, uid, round,
    load, save, exercises, exerciseById, foods, workoutById,
    latestBody, currentWeight, age, bmi, bmiCategory, bmr, tdee,
    cardioMet, sessionKcal, sessionsOn, trainingKcal, kcalTarget, macroTargets, mealTotals,
    e1rm, isTimed, lastPerformance, suggestion, workoutMinutes,
    plannedOn, isPlanDone, streak, weekStart, weekProgress,
    calendarEvents, stats, summary,
  };
})();
