// Registry aller Tools. Neue Tools werden hier eingetragen, sobald sie gebaut sind.
// Optional liefert `badge()` einen Zähler für das Dashboard:
// { count: Zahl im roten Kreis, news: kurze Zeilen darunter } oder null.
const TOOLS = [
  {
    icon: "📅",
    title: "Kalender",
    description: "Termine, Prioritäten, Wiederholungen, Feiertage & Schulferien für Baden-Württemberg.",
    category: "Produktivität",
    path: "kalender/index.html",
    status: "aktiv",
    badge: () => {
      if (!window.KalenderDaten) return null;
      const s = KalenderDaten.stats(KalenderDaten.load());
      if (!s.upcoming) return null;
      const news = [s.upcoming === 1 ? "1 Termin heute" : `${s.upcoming} Termine heute`];
      if (s.next) news.push(`als Nächstes ${s.next.time} ${s.next.title}`);
      return { count: s.upcoming, label: `${s.upcoming} anstehende Termine heute`, news };
    },
  },
  {
    icon: "✅",
    title: "To-Do-Liste",
    description: "Aufgaben für heute, die Woche und den Monat – Unerledigtes mit einem Klick verschieben.",
    category: "Produktivität",
    path: "todo/index.html",
    status: "aktiv",
    badge: () => {
      if (!window.TodoDaten) return null;
      const s = TodoDaten.stats(TodoDaten.load());
      const count = s.today + s.week + s.month + s.overdue;
      if (!count) return null;
      const news = [];
      if (s.overdue) news.push({ text: `${s.overdue} überfällig`, urgent: true });
      if (s.today) news.push(`${s.today} heute`);
      if (s.week) news.push(`${s.week} für die Woche – letzter Tag`);
      if (s.month) news.push(`${s.month} für den Monat – letzter Tag`);
      return { count, label: `${count} offene Aufgaben (${news.map(n => n.text || n).join(", ")})`, news };
    },
  },
  {
    icon: "🏋️",
    title: "Fitnessplaner",
    description: "Wochenplan, Training mit Pausen-Timer, Kalorien & Makros, Gewicht und Fortschritt.",
    category: "Gesundheit",
    path: "fitness/index.html",
    status: "aktiv",
    badge: () => {
      if (!window.FitnessDaten) return null;
      const s = FitnessDaten.stats(FitnessDaten.load());
      if (!s.count && !s.news.length) return null;
      return { count: s.count, label: `Fitness: ${s.news.map(n => n.text || n).join(", ")}`, news: s.news };
    },
  },
  {
    icon: "📊",
    title: "Statistiken",
    // Später: Fitnesskennzahlen über FitnessDaten.summary() einbinden.
    description: "Auswertungen und Verläufe auf einen Blick.",
    category: "Übersicht",
    status: "geplant",
  },
  {
    icon: "📧",
    title: "E-Mail-Übersicht",
    description: "Wichtige Nachrichten gesammelt anzeigen.",
    category: "Kommunikation",
    status: "geplant",
  },
];

const grid = document.getElementById("toolGrid");
const badgeSlots = [];

for (const tool of TOOLS) {
  const isActive = tool.status === "aktiv";
  const card = document.createElement(isActive ? "a" : "div");
  card.className = "tool-card" + (isActive ? "" : " tool-card-planned");
  if (isActive) card.href = tool.path;

  card.innerHTML = `
    <div class="tool-icon">${tool.icon}</div>
    <div class="tool-body">
      <div class="tool-title-row">
        <h2>${tool.title}</h2>
        <span class="status-badge ${isActive ? "status-active" : "status-planned"}">
          ${isActive ? "Aktiv" : "Geplant"}
        </span>
      </div>
      <p class="tool-desc">${tool.description}</p>
      <div class="tool-news" hidden></div>
      <span class="tool-category">${tool.category}</span>
    </div>
    <span class="notify-badge" hidden></span>
  `;

  if (isActive && tool.badge) {
    badgeSlots.push({ tool, card });
  }
  grid.appendChild(card);
}

function updateBadges() {
  for (const { tool, card } of badgeSlots) {
    let info = null;
    try {
      info = tool.badge();
    } catch (err) {
      console.error(`Zähler für ${tool.title} fehlgeschlagen`, err);
    }

    const badge = card.querySelector(".notify-badge");
    const newsEl = card.querySelector(".tool-news");
    const count = info ? info.count : 0;
    const prev = Number(badge.dataset.count || 0);

    badge.hidden = !count;
    badge.textContent = count > 99 ? "99+" : String(count);
    badge.dataset.count = count;
    badge.setAttribute("aria-label", info ? info.label : "");
    card.classList.toggle("has-news", count > 0);
    // Kurz aufploppen, wenn die Zahl steigt.
    if (count > prev) {
      badge.classList.remove("pop");
      void badge.offsetWidth;
      badge.classList.add("pop");
    }

    newsEl.hidden = !count;
    newsEl.innerHTML = "";
    (info ? info.news : []).forEach(n => {
      const item = document.createElement("span");
      item.className = "news-item" + (n.urgent ? " urgent" : "");
      item.textContent = n.text || n;
      newsEl.appendChild(item);
    });
  }
}

updateBadges();

// Aktualisieren, wenn man aus einem Tool zurückkommt, ein anderer Tab etwas ändert
// oder die Zeit fortschreitet (z. B. Termin ist vorbei, neuer Tag).
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) updateBadges();
});
window.addEventListener("pageshow", updateBadges);
window.addEventListener("storage", updateBadges);
setInterval(updateBadges, 60 * 1000);
