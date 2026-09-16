const { pad, dateKey, todayKey, occursOn } = KalenderDaten;

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const MONTHS = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember"
];

const WEEKDAYS_LONG = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

const RECUR_ICON = "↻";
const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };
const DAY_SCROLL_HOUR = 7;
const HOUR_HEIGHT = 44;          // muss zu .hour-row in style.css passen
const DEFAULT_DURATION = 60;     // Anzeigedauer für Termine ohne Endzeit
const MIN_BLOCK_HEIGHT = 22;
const MOBILE_CHIPS = 3;          // sichtbare Termine pro Tag in der schmalen Monatsansicht

let viewDate = new Date();
viewDate.setDate(1);
let viewMode = "month";
let dayViewKey = null;

let events = KalenderDaten.load();
let searchTerm = "";

const monthLabel = document.getElementById("monthLabel");
const weekdaysEl = document.getElementById("weekdays");
const gridEl = document.getElementById("grid");
const searchInput = document.getElementById("searchInput");
const monthViewEl = document.getElementById("monthView");
const yearViewEl = document.getElementById("yearView");
const viewToggleBtn = document.getElementById("viewToggleBtn");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");

const dayDialog = document.getElementById("dayDialog");
const dayTitle = document.getElementById("dayTitle");
const dayInfo = document.getElementById("dayInfo");
const dayAllDay = document.getElementById("dayAllDay");
const dayTimeline = document.getElementById("dayTimeline");

const dialog = document.getElementById("eventDialog");
const eventForm = document.getElementById("eventForm");
const dialogTitle = document.getElementById("dialogTitle");
const eventIdField = document.getElementById("eventId");
const eventDateField = document.getElementById("eventDate");
const eventTitleField = document.getElementById("eventTitle");
const eventTimeField = document.getElementById("eventTime");
const eventEndTimeField = document.getElementById("eventEndTime");
const eventColorField = document.getElementById("eventColor");
const eventPriorityField = document.getElementById("eventPriority");
const eventRecurrenceField = document.getElementById("eventRecurrence");
const recurrenceOptions = document.getElementById("recurrenceOptions");
const eventIntervalField = document.getElementById("eventInterval");
const eventUntilField = document.getElementById("eventUntil");
const eventNoteField = document.getElementById("eventNote");
const seriesHint = document.getElementById("seriesHint");
const deleteBtn = document.getElementById("deleteBtn");
const cancelBtn = document.getElementById("cancelBtn");

function renderWeekdays() {
  weekdaysEl.innerHTML = WEEKDAYS.map(w => `<div>${w}</div>`).join("");
}

function keyToDate(key) {
  return new Date(key + "T00:00:00");
}

// Trainingstage aus dem Fitnessplaner (nur lesend), wird bei jedem render() neu geladen.
let fitnessState = window.FitnessDaten ? FitnessDaten.load() : null;

function eventsOn(date) {
  const fitness = fitnessState ? FitnessDaten.calendarEvents(date, fitnessState) : [];
  return events
    .filter(e => occursOn(e, date))
    .concat(fitness)
    .sort((a, b) => {
      const pa = PRIORITY_ORDER[a.priority] ?? 1;
      const pb = PRIORITY_ORDER[b.priority] ?? 1;
      if (pa !== pb) return pa - pb;
      return (a.time || "99:99").localeCompare(b.time || "99:99");
    });
}

// Verknüpfte Einträge (z. B. Trainings) öffnen ihr Tool statt des Termin-Dialogs.
function openEvent(key, ev) {
  if (ev.link) window.location.href = ev.link;
  else openDialog(key, ev);
}

function matchesSearch(ev, term) {
  return !term || ev.title.toLowerCase().includes(term) || (ev.note || "").toLowerCase().includes(term);
}

function toMinutes(time) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function timeLabel(ev) {
  if (!ev.time) return "";
  return ev.endTime ? `${ev.time}–${ev.endTime}` : ev.time;
}

function isRecurring(ev) {
  return !!(ev.recurrence && ev.recurrence.freq && ev.recurrence.freq !== "none");
}

function createChip(ev, key, term, withTime) {
  const chip = document.createElement("div");
  const priority = ev.priority || "medium";
  chip.className = `event-chip ${ev.color || "blue"} priority-${priority}` + (matchesSearch(ev, term) ? "" : " dim");

  const dot = document.createElement("span");
  dot.className = `prio-dot dot-${priority}`;
  chip.appendChild(dot);

  const text = document.createElement("span");
  text.className = "chip-text";
  if (withTime && ev.time) {
    // Eigenes Element, damit die Uhrzeit auf schmalen Bildschirmen wegfallen kann.
    const time = document.createElement("span");
    time.className = "chip-time";
    time.textContent = `${timeLabel(ev)} `;
    text.appendChild(time);
  }
  text.append(ev.title);
  chip.appendChild(text);

  if (isRecurring(ev)) {
    const icon = document.createElement("span");
    icon.className = "recur-icon";
    icon.textContent = RECUR_ICON;
    chip.appendChild(icon);
  }

  chip.title = ev.note || "";
  chip.addEventListener("click", (e) => {
    e.stopPropagation();
    openEvent(key, ev);
  });
  return chip;
}

function render() {
  if (window.FitnessDaten) fitnessState = FitnessDaten.load();
  const isYear = viewMode === "year";
  monthViewEl.hidden = isYear;
  yearViewEl.hidden = !isYear;
  viewToggleBtn.textContent = isYear ? "Monat" : "Jahr";
  viewToggleBtn.setAttribute("aria-pressed", String(isYear));
  prevBtn.setAttribute("aria-label", isYear ? "Vorheriges Jahr" : "Vorheriger Monat");
  nextBtn.setAttribute("aria-label", isYear ? "Nächstes Jahr" : "Nächster Monat");

  if (isYear) renderYear();
  else renderMonth();
  if (dayDialog.open) renderDay();
}

function renderMonth() {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  monthLabel.textContent = `${MONTHS[month]} ${year}`;

  const firstOfMonth = new Date(year, month, 1);
  let startOffset = firstOfMonth.getDay() - 1;
  if (startOffset < 0) startOffset = 6;

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const cells = [];
  for (let i = 0; i < startOffset; i++) {
    const d = daysInPrevMonth - startOffset + 1 + i;
    cells.push({ day: d, y: year, m: month - 1, outside: true });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, y: year, m: month, outside: false });
  }
  while (cells.length % 7 !== 0 || cells.length < 42) {
    const d = cells.length - (startOffset + daysInMonth) + 1;
    cells.push({ day: d, y: year, m: month + 1, outside: true });
    if (cells.length >= 42) break;
  }

  const tKey = todayKey();
  const term = searchTerm.trim().toLowerCase();

  gridEl.innerHTML = "";
  for (const cell of cells) {
    const normalized = new Date(cell.y, cell.m, cell.day);
    const key = dateKey(normalized.getFullYear(), normalized.getMonth(), normalized.getDate());
    const weekday = normalized.getDay();
    const isWeekend = weekday === 0 || weekday === 6;
    const holiday = window.BW_DATA ? window.BW_DATA.getHoliday(key) : null;
    const ferien = window.BW_DATA ? window.BW_DATA.getFerien(key) : null;

    const cellEl = document.createElement("div");
    cellEl.className = "day-cell"
      + (cell.outside ? " outside" : "")
      + (key === tKey ? " today" : "")
      + (isWeekend ? " weekend" : "")
      + (ferien ? " ferien" : "")
      + (holiday ? " holiday" : "");
    cellEl.dataset.date = key;
    if (holiday) cellEl.title = holiday;

    const numEl = document.createElement("div");
    numEl.className = "day-num";
    numEl.textContent = normalized.getDate();
    cellEl.appendChild(numEl);

    if (ferien && (key === ferien.start || normalized.getDate() === 1)) {
      const label = document.createElement("div");
      label.className = "ferien-label";
      label.textContent = ferien.name;
      label.title = `${ferien.name} (${ferien.start} bis ${ferien.end})`;
      cellEl.appendChild(label);
    }

    const eventsEl = document.createElement("div");
    eventsEl.className = "events";

    if (holiday) {
      const badge = document.createElement("div");
      badge.className = "holiday-badge";
      badge.textContent = holiday;
      badge.title = holiday;
      eventsEl.appendChild(badge);
    }

    const dayEvents = eventsOn(normalized);
    dayEvents.forEach((ev, i) => {
      const chip = createChip(ev, key, term, true);
      // Auf dem Handy nur die ersten Termine zeigen, der Rest steckt in „+N“.
      if (i >= MOBILE_CHIPS) chip.classList.add("extra");
      eventsEl.appendChild(chip);
    });
    if (dayEvents.length > MOBILE_CHIPS) {
      const more = document.createElement("div");
      more.className = "more-badge";
      more.textContent = `+${dayEvents.length - MOBILE_CHIPS}`;
      eventsEl.appendChild(more);
    }

    cellEl.appendChild(eventsEl);
    cellEl.addEventListener("click", () => openDayView(key));
    gridEl.appendChild(cellEl);
  }
}

function renderYear() {
  const year = viewDate.getFullYear();
  monthLabel.textContent = String(year);

  const tKey = todayKey();
  const term = searchTerm.trim().toLowerCase();
  yearViewEl.innerHTML = "";

  for (let m = 0; m < 12; m++) {
    const card = document.createElement("section");
    card.className = "mini-month";

    const head = document.createElement("button");
    head.type = "button";
    head.className = "mini-month-title";
    head.addEventListener("click", () => {
      viewDate = new Date(year, m, 1);
      viewMode = "month";
      render();
    });
    card.appendChild(head);

    const daysEl = document.createElement("div");
    daysEl.className = "mini-grid";
    WEEKDAYS.forEach(w => {
      const wd = document.createElement("div");
      wd.className = "mini-wd";
      wd.textContent = w.charAt(0);
      daysEl.appendChild(wd);
    });

    let offset = new Date(year, m, 1).getDay() - 1;
    if (offset < 0) offset = 6;
    for (let i = 0; i < offset; i++) daysEl.appendChild(document.createElement("div"));

    const daysInMonth = new Date(year, m + 1, 0).getDate();
    let monthCount = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, m, d);
      const key = dateKey(year, m, d);
      const weekday = date.getDay();
      const holiday = window.BW_DATA ? window.BW_DATA.getHoliday(key) : null;
      const ferien = window.BW_DATA ? window.BW_DATA.getFerien(key) : null;
      const dayEvents = eventsOn(date).filter(ev => matchesSearch(ev, term));
      monthCount += dayEvents.length;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "mini-day"
        + (key === tKey ? " today" : "")
        + (weekday === 0 || weekday === 6 ? " weekend" : "")
        + (ferien ? " ferien" : "")
        + (holiday ? " holiday" : "")
        + (dayEvents.length ? " has-events" : "");
      btn.textContent = d;

      const tips = [];
      if (holiday) tips.push(holiday);
      if (ferien) tips.push(ferien.name);
      dayEvents.forEach(ev => tips.push((ev.time ? timeLabel(ev) + " " : "") + ev.title));
      btn.title = tips.join("\n");

      if (dayEvents.length) {
        const dot = document.createElement("span");
        dot.className = `mini-dot ${dayEvents[0].color || "blue"}`;
        btn.appendChild(dot);
      }
      btn.addEventListener("click", () => openDayView(key));
      daysEl.appendChild(btn);
    }

    head.innerHTML = "";
    const name = document.createElement("span");
    name.textContent = MONTHS[m];
    head.appendChild(name);
    if (monthCount) {
      const count = document.createElement("span");
      count.className = "mini-count";
      count.textContent = monthCount === 1 ? "1 Termin" : `${monthCount} Termine`;
      head.appendChild(count);
    }

    card.appendChild(daysEl);
    yearViewEl.appendChild(card);
  }
}

function openDayView(key) {
  dayViewKey = key;
  renderDay();
  if (!dayDialog.open) dayDialog.showModal();
  const firstTimed = eventsOn(keyToDate(key)).map(e => e.time).filter(Boolean).sort()[0];
  const scrollHour = firstTimed ? Math.min(parseInt(firstTimed, 10), DAY_SCROLL_HOUR) : DAY_SCROLL_HOUR;
  dayTimeline.scrollTop = scrollHour * HOUR_HEIGHT;
}

// Verteilt überlappende Termine nebeneinander auf Spalten.
function layoutTimed(list) {
  const items = list
    .map(ev => {
      const start = toMinutes(ev.time);
      const end = ev.endTime ? toMinutes(ev.endTime) : Math.min(start + DEFAULT_DURATION, 24 * 60);
      return { ev, start, end: Math.max(end, start + 1) };
    })
    .sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));

  let cluster = [];
  let columns = [];
  let clusterEnd = -1;
  const finish = () => {
    cluster.forEach(it => { it.cols = columns.length; });
    cluster = [];
    columns = [];
  };

  for (const it of items) {
    if (it.start >= clusterEnd) finish();
    let col = columns.findIndex(lastEnd => lastEnd <= it.start);
    if (col === -1) {
      col = columns.length;
      columns.push(it.end);
    } else {
      columns[col] = it.end;
    }
    it.col = col;
    cluster.push(it);
    clusterEnd = Math.max(clusterEnd, it.end);
  }
  finish();
  return items;
}

function createBlock(item, key, term) {
  const { ev, start, end, col, cols } = item;
  const priority = ev.priority || "medium";
  const block = document.createElement("div");
  block.className = `event-block ${ev.color || "blue"} priority-${priority}`
    + (matchesSearch(ev, term) ? "" : " dim")
    + (ev.endTime ? "" : " open-end");

  const height = Math.max((end - start) / 60 * HOUR_HEIGHT - 2, MIN_BLOCK_HEIGHT);
  if (height < 40) block.classList.add("compact");
  block.style.top = `${start / 60 * HOUR_HEIGHT + 1}px`;
  block.style.height = `${height}px`;
  block.style.left = `calc(${col / cols * 100}% + 2px)`;
  block.style.width = `calc(${100 / cols}% - 4px)`;

  const title = document.createElement("div");
  title.className = "block-title";
  const dot = document.createElement("span");
  dot.className = `prio-dot dot-${priority}`;
  title.appendChild(dot);
  title.append(ev.title + (isRecurring(ev) ? ` ${RECUR_ICON}` : ""));

  const time = document.createElement("div");
  time.className = "block-time";
  time.textContent = timeLabel(ev);

  block.append(title, time);
  block.title = `${timeLabel(ev)} ${ev.title}` + (ev.note ? `\n${ev.note}` : "");
  block.addEventListener("click", (e) => {
    e.stopPropagation();
    openEvent(key, ev);
  });
  return block;
}

function renderDay() {
  const key = dayViewKey;
  const date = keyToDate(key);
  const term = searchTerm.trim().toLowerCase();
  dayTitle.textContent = `${WEEKDAYS_LONG[date.getDay()]}, ${date.getDate()}. ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;

  const holiday = window.BW_DATA ? window.BW_DATA.getHoliday(key) : null;
  const ferien = window.BW_DATA ? window.BW_DATA.getFerien(key) : null;
  dayInfo.innerHTML = "";
  if (key === todayKey()) addInfoBadge("Heute", "info-today");
  if (holiday) addInfoBadge(holiday, "holiday-badge");
  if (ferien) addInfoBadge(ferien.name, "info-ferien");

  const dayEvents = eventsOn(date);
  const untimed = dayEvents.filter(ev => !ev.time);
  const timed = dayEvents.filter(ev => ev.time);

  dayAllDay.innerHTML = "";
  dayAllDay.hidden = !untimed.length;
  if (untimed.length) {
    const label = document.createElement("div");
    label.className = "hour-label";
    label.textContent = "ganztägig";
    const slot = document.createElement("div");
    slot.className = "hour-slot";
    untimed.forEach(ev => slot.appendChild(createChip(ev, key, term, false)));
    dayAllDay.append(label, slot);
  }

  const now = new Date();
  const currentHour = key === todayKey() ? now.getHours() : -1;

  dayTimeline.innerHTML = "";
  for (let h = 0; h < 24; h++) {
    const row = document.createElement("div");
    row.className = "hour-row" + (h === currentHour ? " now" : "");
    row.dataset.hour = h;

    const label = document.createElement("div");
    label.className = "hour-label";
    label.textContent = `${pad(h)}:00`;

    const slot = document.createElement("div");
    slot.className = "hour-slot";
    slot.title = `Neuer Termin um ${pad(h)}:00`;
    const endPreset = h === 23 ? "23:59" : `${pad(h + 1)}:00`;
    slot.addEventListener("click", () => openDialog(key, null, `${pad(h)}:00`, endPreset));

    row.append(label, slot);
    dayTimeline.appendChild(row);
  }

  const layer = document.createElement("div");
  layer.className = "timeline-events";
  layoutTimed(timed).forEach(item => layer.appendChild(createBlock(item, key, term)));

  if (currentHour !== -1) {
    const line = document.createElement("div");
    line.className = "now-line";
    line.style.top = `${(now.getHours() * 60 + now.getMinutes()) / 60 * HOUR_HEIGHT}px`;
    layer.appendChild(line);
  }
  dayTimeline.appendChild(layer);
}

function addInfoBadge(text, cls) {
  const b = document.createElement("span");
  b.className = `info-badge ${cls}`;
  b.textContent = text;
  dayInfo.appendChild(b);
}

function shiftDay(delta) {
  const d = keyToDate(dayViewKey);
  d.setDate(d.getDate() + delta);
  openDayView(dateKey(d.getFullYear(), d.getMonth(), d.getDate()));
}

function updateRecurrenceVisibility() {
  recurrenceOptions.hidden = eventRecurrenceField.value === "none";
}

function validateTimes() {
  const start = eventTimeField.value;
  const end = eventEndTimeField.value;
  let msg = "";
  if (end && !start) msg = "Bitte zuerst eine Startzeit angeben.";
  else if (end && start && end <= start) msg = "Das Ende muss nach dem Beginn liegen.";
  eventEndTimeField.setCustomValidity(msg);
}

function openDialog(dateStr, existing, presetTime, presetEndTime) {
  eventForm.reset();
  eventDateField.value = dateStr;

  if (existing) {
    dialogTitle.textContent = "Termin bearbeiten";
    eventIdField.value = existing.id;
    eventDateField.value = existing.date;
    eventTitleField.value = existing.title;
    eventTimeField.value = existing.time || "";
    eventEndTimeField.value = existing.endTime || "";
    eventColorField.value = existing.color || "blue";
    eventPriorityField.value = existing.priority || "medium";
    eventNoteField.value = existing.note || "";
    const rec = existing.recurrence || { freq: "none" };
    eventRecurrenceField.value = rec.freq || "none";
    eventIntervalField.value = rec.interval || 1;
    eventUntilField.value = rec.until || "";
    deleteBtn.hidden = false;
    seriesHint.hidden = !(rec.freq && rec.freq !== "none");
  } else {
    dialogTitle.textContent = "Termin hinzufügen";
    eventIdField.value = "";
    eventPriorityField.value = "medium";
    eventRecurrenceField.value = "none";
    eventIntervalField.value = 1;
    eventTimeField.value = presetTime || "";
    eventEndTimeField.value = presetEndTime || "";
    deleteBtn.hidden = true;
    seriesHint.hidden = true;
  }

  validateTimes();
  updateRecurrenceVisibility();
  dialog.showModal();
  eventTitleField.focus();
}

eventTimeField.addEventListener("input", validateTimes);
eventEndTimeField.addEventListener("input", validateTimes);

eventRecurrenceField.addEventListener("change", () => {
  updateRecurrenceVisibility();
  seriesHint.hidden = eventRecurrenceField.value === "none";
});

eventForm.addEventListener("submit", () => {
  const id = eventIdField.value;
  const freq = eventRecurrenceField.value;
  const data = {
    id: id || crypto.randomUUID(),
    date: eventDateField.value,
    title: eventTitleField.value.trim(),
    time: eventTimeField.value,
    endTime: eventTimeField.value ? eventEndTimeField.value : "",
    color: eventColorField.value,
    priority: eventPriorityField.value,
    note: eventNoteField.value.trim(),
    recurrence: freq === "none" ? { freq: "none" } : {
      freq,
      interval: Math.max(1, parseInt(eventIntervalField.value, 10) || 1),
      until: eventUntilField.value || null,
    },
  };
  if (!data.title) return;

  if (id) {
    const idx = events.findIndex(e => e.id === id);
    if (idx !== -1) events[idx] = data;
  } else {
    events.push(data);
  }
  KalenderDaten.save(events);
  render();
});

deleteBtn.addEventListener("click", () => {
  const id = eventIdField.value;
  events = events.filter(e => e.id !== id);
  KalenderDaten.save(events);
  dialog.close();
  render();
});

cancelBtn.addEventListener("click", () => dialog.close());

function stepView(delta) {
  if (viewMode === "year") viewDate.setFullYear(viewDate.getFullYear() + delta);
  else viewDate.setMonth(viewDate.getMonth() + delta);
  render();
}

prevBtn.addEventListener("click", () => stepView(-1));
nextBtn.addEventListener("click", () => stepView(1));

viewToggleBtn.addEventListener("click", () => {
  viewMode = viewMode === "year" ? "month" : "year";
  render();
});

document.getElementById("dayPrevBtn").addEventListener("click", () => shiftDay(-1));
document.getElementById("dayNextBtn").addEventListener("click", () => shiftDay(1));
document.getElementById("dayAddBtn").addEventListener("click", () => openDialog(dayViewKey));
document.getElementById("dayCloseBtn").addEventListener("click", () => dayDialog.close());

// Klick auf den abgedunkelten Hintergrund schließt die Tagesansicht.
dayDialog.addEventListener("click", (e) => {
  if (e.target === dayDialog) dayDialog.close();
});

document.getElementById("todayBtn").addEventListener("click", () => {
  viewDate = new Date();
  viewDate.setDate(1);
  render();
});

searchInput.addEventListener("input", (e) => {
  searchTerm = e.target.value;
  render();
});

renderWeekdays();
render();

// Änderungen aus einem anderen Tab oder vom Google-Drive-Sync übernehmen.
window.addEventListener("storage", e => {
  if (e.key === KalenderDaten.STORAGE_KEY) events = KalenderDaten.load();
  else if (!window.FitnessDaten || e.key !== FitnessDaten.STORAGE_KEY) return;
  render();
});
