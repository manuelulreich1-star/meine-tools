// Laden/Speichern der Termine und Wiederholungslogik.
// Wird vom Kalender und vom Dashboard (Zähler) genutzt.
window.KalenderDaten = (function () {
  const STORAGE_KEY = "mein-kalender-events";
  const VORLAGEN_KEY = "mein-kalender-vorlagen";

  function pad(n) { return String(n).padStart(2, "0"); }

  function dateKey(y, m, d) {
    return `${y}-${pad(m + 1)}-${pad(d)}`;
  }

  function todayKey() {
    const t = new Date();
    return dateKey(t.getFullYear(), t.getMonth(), t.getDate());
  }

  function occursOn(event, cellDate) {
    const candKey = dateKey(cellDate.getFullYear(), cellDate.getMonth(), cellDate.getDate());
    const rec = event.recurrence || { freq: "none" };

    if (!rec.freq || rec.freq === "none") {
      return candKey === event.date;
    }
    if (candKey < event.date) return false;
    if (rec.until && candKey > rec.until) return false;

    const start = new Date(event.date + "T00:00:00");
    const cand = new Date(candKey + "T00:00:00");
    const interval = Math.max(1, parseInt(rec.interval, 10) || 1);
    const msPerDay = 86400000;

    switch (rec.freq) {
      case "daily": {
        const diffDays = Math.round((cand - start) / msPerDay);
        return diffDays % interval === 0;
      }
      case "weekly": {
        const diffDays = Math.round((cand - start) / msPerDay);
        return diffDays % (7 * interval) === 0;
      }
      case "monthly": {
        const monthDiff = (cand.getFullYear() - start.getFullYear()) * 12 + (cand.getMonth() - start.getMonth());
        if (monthDiff < 0 || monthDiff % interval !== 0) return false;
        const lastDay = new Date(cand.getFullYear(), cand.getMonth() + 1, 0).getDate();
        return cand.getDate() === Math.min(start.getDate(), lastDay);
      }
      case "yearly": {
        const yearDiff = cand.getFullYear() - start.getFullYear();
        if (yearDiff < 0 || yearDiff % interval !== 0) return false;
        const lastDay = new Date(cand.getFullYear(), start.getMonth() + 1, 0).getDate();
        return cand.getMonth() === start.getMonth() && cand.getDate() === Math.min(start.getDate(), lastDay);
      }
      default:
        return false;
    }
  }

  function save(list) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }

  // Übernimmt jede Vorlage nur einmal, damit gelöschte Vorlagen nicht wiederkommen.
  function applyVorlagen(list) {
    if (typeof KALENDER_VORLAGEN === "undefined") return;
    let applied;
    try {
      applied = JSON.parse(localStorage.getItem(VORLAGEN_KEY)) || [];
    } catch {
      applied = [];
    }
    const neue = KALENDER_VORLAGEN.filter(v => !applied.includes(v.id));
    if (!neue.length) return;
    neue.forEach(v => {
      if (!list.some(e => e.id === v.id)) list.push({ ...v });
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
    applyVorlagen(list);
    return list;
  }

  // Termine von heute, davon die noch anstehenden (ohne Uhrzeit zählen den ganzen Tag).
  function stats(list) {
    const now = new Date();
    const nowTime = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const today = list
      .filter(e => occursOn(e, now))
      .sort((a, b) => (a.time || "").localeCompare(b.time || ""));
    const upcoming = today.filter(e => !e.time || (e.endTime || e.time) >= nowTime);
    const next = upcoming.find(e => e.time && e.time >= nowTime) || null;
    return { today: today.length, upcoming: upcoming.length, next };
  }

  return { STORAGE_KEY, pad, dateKey, todayKey, occursOn, load, save, stats };
})();
