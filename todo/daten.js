// Laden/Speichern der Aufgaben und Zeitraum-Logik.
// Wird von der To-Do-Liste und vom Dashboard (Zähler) genutzt.
window.TodoDaten = (function () {
  const STORAGE_KEY = "meine-todos";
  const VORLAGEN_KEY = "meine-todos-vorlagen";

  function pad(n) { return String(n).padStart(2, "0"); }

  function keyOf(d) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function parseKey(key) {
    return new Date(key + "T00:00:00");
  }

  function periodStart(scope, date) {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    if (scope === "week") d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    if (scope === "month") d.setDate(1);
    return d;
  }

  function addPeriods(scope, key, n) {
    const d = parseKey(key);
    if (scope === "day") d.setDate(d.getDate() + n);
    if (scope === "week") d.setDate(d.getDate() + 7 * n);
    if (scope === "month") d.setMonth(d.getMonth() + n);
    return keyOf(d);
  }

  function currentKey(scope) {
    return keyOf(periodStart(scope, new Date()));
  }

  // "overdue" | "current" | "next" | "later" | null (ohne Zeitraum)
  function relation(todo) {
    if (todo.scope === "none" || !todo.due) return null;
    const cur = currentKey(todo.scope);
    if (todo.due < cur) return "overdue";
    if (todo.due === cur) return "current";
    if (todo.due === addPeriods(todo.scope, cur, 1)) return "next";
    return "later";
  }

  function isOverdue(todo) {
    return !todo.done && relation(todo) === "overdue";
  }

  function save(list) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }

  // Übernimmt jede Vorlage nur einmal, damit gelöschte Vorlagen nicht wiederkommen.
  function applyVorlagen(list) {
    if (typeof TODO_VORLAGEN === "undefined") return;
    let applied;
    try {
      applied = JSON.parse(localStorage.getItem(VORLAGEN_KEY)) || [];
    } catch {
      applied = [];
    }
    const neue = TODO_VORLAGEN.filter(v => !applied.includes(v.id));
    if (!neue.length) return;
    neue.forEach(v => {
      if (!list.some(t => t.id === v.id)) {
        list.push({ note: "", done: false, postponed: 0, createdAt: Date.now(), doneAt: null, ...v });
      }
      applied.push(v.id);
    });
    save(list);
    localStorage.setItem(VORLAGEN_KEY, JSON.stringify(applied));
  }

  function load() {
    let list;
    try {
      list = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch {
      list = [];
    }
    // Ältere Einträge ohne Zeitraum: mit Datum zählen sie als Tagesaufgabe.
    list.forEach(t => {
      if (!t.scope) t.scope = t.due ? "day" : "none";
      if (!t.postponed) t.postponed = 0;
    });
    applyVorlagen(list);
    return list;
  }

  // Ist heute der letzte Tag der aktuellen Woche bzw. des aktuellen Monats?
  function isLastDayOf(scope) {
    const tomorrow = addPeriods("day", currentKey("day"), 1);
    return keyOf(periodStart(scope, parseKey(tomorrow))) !== currentKey(scope);
  }

  // Was heute ansteht: Tagesaufgaben für heute, Wochen-/Monatsaufgaben nur
  // am letzten Tag ihres Zeitraums (als Erinnerung) und alle überfälligen.
  function stats(list) {
    const open = list.filter(t => !t.done);
    const current = scope => open.filter(t => t.scope === scope && relation(t) === "current").length;
    return {
      today: current("day"),
      week: isLastDayOf("week") ? current("week") : 0,
      month: isLastDayOf("month") ? current("month") : 0,
      overdue: open.filter(t => relation(t) === "overdue").length,
    };
  }

  return { STORAGE_KEY, pad, keyOf, parseKey, periodStart, addPeriods, currentKey, relation, isOverdue, load, save, stats };
})();
