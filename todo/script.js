const { addPeriods, currentKey, parseKey, relation, isOverdue } = TodoDaten;
const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };
const PRIORITY_LABEL = { high: "Hoch", medium: "Mittel", low: "Niedrig" };
const MONTHS = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember"
];

// Auswahl „Wann“: Zeitraum (scope) plus Versatz zum aktuellen Zeitraum.
const WHEN_OPTIONS = [
  { value: "today", label: "Heute", scope: "day", offset: 0 },
  { value: "tomorrow", label: "Morgen", scope: "day", offset: 1 },
  { value: "date", label: "Bestimmter Tag…", scope: "day" },
  { value: "week", label: "Diese Woche", scope: "week", offset: 0 },
  { value: "nextweek", label: "Nächste Woche", scope: "week", offset: 1 },
  { value: "month", label: "Dieser Monat", scope: "month", offset: 0 },
  { value: "nextmonth", label: "Nächster Monat", scope: "month", offset: 1 },
  { value: "none", label: "Ohne Zeitraum", scope: "none" },
];

const VIEW_DEFAULT_WHEN = { day: "today", week: "week", month: "month", all: "today" };

let todos = TodoDaten.load();
let view = "day";
let showDone = true;
let searchTerm = "";
let editingId = null;
let undoState = null;
let toastTimer = null;

const summaryEl = document.getElementById("summary");
const addForm = document.getElementById("addForm");
const newTitle = document.getElementById("newTitle");
const newWhen = document.getElementById("newWhen");
const newDateField = document.getElementById("newDateField");
const newDate = document.getElementById("newDate");
const newPriority = document.getElementById("newPriority");
const sectionsEl = document.getElementById("sections");
const emptyState = document.getElementById("emptyState");
const searchInput = document.getElementById("searchInput");
const showDoneInput = document.getElementById("showDone");
const clearDoneBtn = document.getElementById("clearDoneBtn");
const toastEl = document.getElementById("toast");
const toastText = document.getElementById("toastText");

const editDialog = document.getElementById("editDialog");
const editForm = document.getElementById("editForm");
const editTitle = document.getElementById("editTitle");
const editWhen = document.getElementById("editWhen");
const editDateField = document.getElementById("editDateField");
const editDate = document.getElementById("editDate");
const editPriority = document.getElementById("editPriority");
const editNote = document.getElementById("editNote");
const editPostponed = document.getElementById("editPostponed");

// ---------- Datum & Zeiträume ----------

function isoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

function periodLabel(scope, key) {
  if (scope === "none" || !key) return "";
  const cur = currentKey(scope);
  const d = parseKey(key);
  if (scope === "day") {
    if (key === cur) return "Heute";
    if (key === addPeriods("day", cur, 1)) return "Morgen";
    if (key === addPeriods("day", cur, -1)) return "Gestern";
    return d.toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "short" });
  }
  if (scope === "week") {
    if (key === cur) return "Diese Woche";
    if (key === addPeriods("week", cur, 1)) return "Nächste Woche";
    if (key === addPeriods("week", cur, -1)) return "Letzte Woche";
    return `KW ${isoWeek(d)}`;
  }
  if (key === cur) return "Dieser Monat";
  if (key === addPeriods("month", cur, 1)) return "Nächster Monat";
  if (key === addPeriods("month", cur, -1)) return "Letzter Monat";
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

// Ziel beim Verschieben: nächster Zeitraum, aber mindestens der aktuelle.
function postponeTarget(todo) {
  const cur = currentKey(todo.scope);
  const next = addPeriods(todo.scope, todo.due, 1);
  return next < cur ? cur : next;
}

// ---------- „Wann“-Auswahl ----------

function fillWhenSelect(select) {
  select.innerHTML = "";
  WHEN_OPTIONS.forEach(o => select.add(new Option(o.label, o.value)));
}

function resolveWhen(value, dateValue) {
  const opt = WHEN_OPTIONS.find(o => o.value === value);
  if (!opt || opt.scope === "none") return { scope: "none", due: "" };
  if (opt.value === "date") {
    return { scope: "day", due: dateValue || currentKey("day") };
  }
  return { scope: opt.scope, due: addPeriods(opt.scope, currentKey(opt.scope), opt.offset) };
}

function whenValueFor(todo) {
  if (todo.scope === "none" || !todo.due) return "none";
  const match = WHEN_OPTIONS.find(o =>
    o.scope === todo.scope && o.offset !== undefined &&
    todo.due === addPeriods(o.scope, currentKey(o.scope), o.offset));
  if (match) return match.value;
  return todo.scope === "day" ? "date" : "keep";
}

function updateDateField(select, field, input) {
  field.hidden = select.value !== "date";
  if (!field.hidden && !input.value) input.value = currentKey("day");
}

// ---------- Anzeige ----------

function matchesSearch(todo, term) {
  return !term || todo.title.toLowerCase().includes(term) || (todo.note || "").toLowerCase().includes(term);
}

function compareInSection(a, b) {
  if (a.done !== b.done) return a.done ? 1 : -1;
  if (a.done) return (b.doneAt || 0) - (a.doneAt || 0);
  const da = a.due || "9999-12-31";
  const db = b.due || "9999-12-31";
  if (da !== db) return da.localeCompare(db);
  const pa = PRIORITY_ORDER[a.priority] ?? 1;
  const pb = PRIORITY_ORDER[b.priority] ?? 1;
  if (pa !== pb) return pa - pb;
  return a.createdAt - b.createdAt;
}

const SCOPE_NAMES = { day: "Tag", week: "Woche", month: "Monat" };

function sectionsForView() {
  if (view === "all") {
    return [
      { title: "Überfällig", cls: "overdue", filter: t => isOverdue(t) },
      { title: "Heute", filter: t => t.scope === "day" && relation(t) === "current" },
      { title: "Diese Woche", filter: t => t.scope === "week" && relation(t) === "current" },
      { title: "Dieser Monat", filter: t => t.scope === "month" && relation(t) === "current" },
      { title: "Demnächst", filter: t => ["next", "later"].includes(relation(t)) },
      { title: "Ohne Zeitraum", filter: t => relation(t) === null },
      { title: "Früher erledigt", filter: t => t.done && relation(t) === "overdue" },
    ];
  }
  const labels = {
    day: ["Heute", "Morgen"],
    week: ["Diese Woche", "Nächste Woche"],
    month: ["Dieser Monat", "Nächster Monat"],
  }[view];
  return [
    { title: "Überfällig", cls: "overdue", filter: t => t.scope === view && isOverdue(t) },
    { title: labels[0], filter: t => t.scope === view && relation(t) === "current" },
    { title: labels[1], filter: t => t.scope === view && relation(t) === "next" },
  ];
}

function render() {
  const term = searchTerm.trim().toLowerCase();
  const base = todos.filter(t => matchesSearch(t, term) && (showDone || !t.done));

  sectionsEl.innerHTML = "";
  let shown = 0;
  sectionsForView().forEach((section, i) => {
    const items = base.filter(section.filter).sort(compareInSection);
    // Den aktuellen Zeitraum immer zeigen, damit man sieht, dass dort nichts ansteht.
    const alwaysShow = view !== "all" && i === 1;
    if (!items.length && !alwaysShow) return;
    shown += items.length;
    sectionsEl.appendChild(renderSection(section, items));
  });

  // Zähler in den Reitern: offene Aufgaben im aktuellen Zeitraum plus überfällige.
  document.querySelectorAll(".tab-btn").forEach(btn => {
    const v = btn.dataset.view;
    const n = todos.filter(t => !t.done && (v === "all" || (t.scope === v && ["current", "overdue"].includes(relation(t))))).length;
    const hasOverdue = todos.some(t => isOverdue(t) && (v === "all" || t.scope === v));
    const countEl = btn.querySelector(".tab-count");
    countEl.textContent = n || "";
    countEl.classList.toggle("has-overdue", hasOverdue);
  });

  const openToday = todos.filter(t => !t.done && t.scope === "day" && relation(t) === "current").length;
  const overdue = todos.filter(isOverdue).length;
  const openAll = todos.filter(t => !t.done).length;
  summaryEl.textContent = todos.length
    ? `${openToday} für heute · ${openAll} offen insgesamt` + (overdue ? ` · ${overdue} überfällig` : "")
    : "Noch keine Aufgaben.";

  emptyState.hidden = shown > 0 || sectionsEl.children.length > 0;
  if (!emptyState.hidden) {
    emptyState.textContent = term ? "Keine Aufgaben passen zur Suche." : "Leg oben deine erste Aufgabe an.";
  }
  clearDoneBtn.hidden = !todos.some(t => t.done);
}

function renderSection(section, items) {
  const wrap = document.createElement("section");
  wrap.className = "todo-section" + (section.cls ? ` section-${section.cls}` : "");

  const head = document.createElement("h2");
  head.className = "section-title";
  head.textContent = section.title;
  const openCount = items.filter(t => !t.done).length;
  if (items.length) {
    const count = document.createElement("span");
    count.className = "section-count";
    count.textContent = `${items.length - openCount}/${items.length}`;
    count.title = "erledigt / gesamt";
    head.appendChild(count);
  }
  wrap.appendChild(head);

  if (!items.length) {
    const empty = document.createElement("p");
    empty.className = "section-empty";
    empty.textContent = "Nichts geplant.";
    wrap.appendChild(empty);
    return wrap;
  }

  const ul = document.createElement("ul");
  ul.className = "todo-list";
  items.forEach(t => ul.appendChild(renderItem(t)));
  wrap.appendChild(ul);
  return wrap;
}

function renderItem(todo) {
  const li = document.createElement("li");
  li.className = `todo-item priority-${todo.priority || "medium"}`
    + (todo.done ? " done" : "")
    + (isOverdue(todo) ? " overdue" : "");

  const check = document.createElement("input");
  check.type = "checkbox";
  check.className = "todo-check";
  check.checked = todo.done;
  check.setAttribute("aria-label", `„${todo.title}“ als erledigt markieren`);
  check.addEventListener("change", () => toggleDone(todo.id));

  const body = document.createElement("div");
  body.className = "todo-body";
  body.addEventListener("click", () => openEdit(todo.id));

  const title = document.createElement("div");
  title.className = "todo-title";
  title.textContent = todo.title;
  body.appendChild(title);

  const meta = document.createElement("div");
  meta.className = "todo-meta";
  const prio = document.createElement("span");
  prio.className = `prio-tag prio-${todo.priority || "medium"}`;
  prio.textContent = PRIORITY_LABEL[todo.priority || "medium"];
  meta.appendChild(prio);

  if (todo.scope !== "none" && todo.due) {
    const tag = document.createElement("span");
    const rel = relation(todo);
    tag.className = `due-tag scope-${todo.scope}`
      + (todo.done ? "" : rel === "overdue" ? " due-overdue" : rel === "current" ? " due-current" : "");
    // Im Tages-/Wochen-/Monatsreiter ist der Zeitraum klar, dort nur das Datum zeigen.
    tag.textContent = (view === "all" ? `${SCOPE_NAMES[todo.scope]} · ` : "") + periodLabel(todo.scope, todo.due);
    meta.appendChild(tag);
  }
  if (todo.postponed > 0) {
    const p = document.createElement("span");
    p.className = "postponed-tag";
    p.textContent = `↷ ${todo.postponed}× verschoben`;
    meta.appendChild(p);
  }
  if (todo.note) {
    const note = document.createElement("span");
    note.className = "note-preview";
    note.textContent = todo.note;
    meta.appendChild(note);
  }
  body.appendChild(meta);

  li.append(check, body);

  if (!todo.done && ["current", "overdue"].includes(relation(todo))) {
    const target = postponeTarget(todo);
    const targetLabel = periodLabel(todo.scope, target);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "postpone-btn";
    btn.innerHTML = `<span class="postpone-main">Nicht erledigt</span><span class="postpone-target">→ ${targetLabel}</span>`;
    btn.title = `Nicht geschafft – auf „${targetLabel}“ verschieben`;
    btn.addEventListener("click", () => postpone(todo.id));
    li.appendChild(btn);
  }

  const del = document.createElement("button");
  del.type = "button";
  del.className = "delete-btn";
  del.setAttribute("aria-label", `„${todo.title}“ löschen`);
  del.textContent = "✕";
  del.addEventListener("click", () => deleteTodo(todo.id));
  li.appendChild(del);
  return li;
}

// ---------- Aktionen ----------

function toggleDone(id) {
  const todo = todos.find(t => t.id === id);
  if (!todo) return;
  todo.done = !todo.done;
  todo.doneAt = todo.done ? Date.now() : null;
  TodoDaten.save(todos);
  render();
}

function postpone(id) {
  const todo = todos.find(t => t.id === id);
  if (!todo) return;
  const before = { due: todo.due, postponed: todo.postponed };
  todo.due = postponeTarget(todo);
  todo.postponed = (todo.postponed || 0) + 1;
  TodoDaten.save(todos);
  render();
  showToast(`„${todo.title}“ verschoben auf ${periodLabel(todo.scope, todo.due)}.`, () => {
    Object.assign(todo, before);
  });
}

function deleteTodo(id) {
  const idx = todos.findIndex(t => t.id === id);
  if (idx === -1) return;
  const [removed] = todos.splice(idx, 1);
  TodoDaten.save(todos);
  render();
  showToast(`„${removed.title}“ gelöscht.`, () => {
    todos.splice(idx, 0, removed);
  });
}

function showToast(text, undo) {
  undoState = undo;
  toastText.textContent = text;
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, 6000);
}

function hideToast() {
  toastEl.hidden = true;
  undoState = null;
}

document.getElementById("toastUndo").addEventListener("click", () => {
  if (undoState) {
    undoState();
    TodoDaten.save(todos);
    render();
  }
  hideToast();
});

function openEdit(id) {
  const todo = todos.find(t => t.id === id);
  if (!todo) return;
  editingId = id;
  editTitle.value = todo.title;
  editPriority.value = todo.priority || "medium";
  editNote.value = todo.note || "";

  fillWhenSelect(editWhen);
  const when = whenValueFor(todo);
  if (when === "keep") {
    const keep = new Option(`${SCOPE_NAMES[todo.scope]}: ${periodLabel(todo.scope, todo.due)} (unverändert)`, "keep");
    editWhen.add(keep, 0);
  }
  editWhen.value = when;
  editDate.value = todo.scope === "day" ? todo.due : "";
  updateDateField(editWhen, editDateField, editDate);

  editPostponed.hidden = !todo.postponed;
  editPostponed.textContent = `Bereits ${todo.postponed}× verschoben.`;

  editDialog.showModal();
  editTitle.focus();
}

addForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const title = newTitle.value.trim();
  if (!title) return;
  const { scope, due } = resolveWhen(newWhen.value, newDate.value);
  todos.push({
    id: crypto.randomUUID(),
    title,
    scope,
    due,
    priority: newPriority.value,
    note: "",
    done: false,
    postponed: 0,
    createdAt: Date.now(),
    doneAt: null,
  });
  TodoDaten.save(todos);
  newTitle.value = "";
  newPriority.value = "medium";
  newTitle.focus();
  render();
});

editForm.addEventListener("submit", () => {
  const todo = todos.find(t => t.id === editingId);
  const title = editTitle.value.trim();
  if (!todo || !title) return;
  todo.title = title;
  todo.priority = editPriority.value;
  todo.note = editNote.value.trim();
  if (editWhen.value !== "keep") {
    const { scope, due } = resolveWhen(editWhen.value, editDate.value);
    todo.scope = scope;
    todo.due = due;
  }
  TodoDaten.save(todos);
  render();
});

document.getElementById("editDeleteBtn").addEventListener("click", () => {
  editDialog.close();
  deleteTodo(editingId);
});

document.getElementById("editCancelBtn").addEventListener("click", () => editDialog.close());

newWhen.addEventListener("change", () => updateDateField(newWhen, newDateField, newDate));
editWhen.addEventListener("change", () => updateDateField(editWhen, editDateField, editDate));

document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    view = btn.dataset.view;
    document.querySelectorAll(".tab-btn").forEach(b => {
      b.classList.toggle("active", b === btn);
      b.setAttribute("aria-selected", String(b === btn));
    });
    newWhen.value = VIEW_DEFAULT_WHEN[view];
    updateDateField(newWhen, newDateField, newDate);
    render();
  });
});

showDoneInput.addEventListener("change", () => {
  showDone = showDoneInput.checked;
  render();
});

searchInput.addEventListener("input", (e) => {
  searchTerm = e.target.value;
  render();
});

clearDoneBtn.addEventListener("click", () => {
  const count = todos.filter(t => t.done).length;
  if (!confirm(`${count} erledigte Aufgabe${count === 1 ? "" : "n"} endgültig löschen?`)) return;
  todos = todos.filter(t => !t.done);
  TodoDaten.save(todos);
  render();
});

// Beim Tageswechsel (z. B. Tab über Nacht offen) Ansicht aktualisieren.
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) render();
});

fillWhenSelect(newWhen);
newWhen.value = VIEW_DEFAULT_WHEN[view];
render();

// Änderungen aus einem anderen Tab oder vom Google-Drive-Sync übernehmen.
window.addEventListener("storage", e => {
  if (e.key !== TodoDaten.STORAGE_KEY) return;
  todos = TodoDaten.load();
  render();
});
