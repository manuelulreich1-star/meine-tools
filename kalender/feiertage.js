// Feiertage (berechnet) und Schulferien (offizielle Termine) für Baden-Württemberg.
(function () {
  function pad(n) { return String(n).padStart(2, "0"); }
  function key(y, m, d) { return `${y}-${pad(m + 1)}-${pad(d)}`; }
  function toKey(d) { return key(d.getFullYear(), d.getMonth(), d.getDate()); }
  function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }

  // Gauß'sche Osterformel
  function easterDate(year) {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month - 1, day);
  }

  const holidayCache = {};
  function getHolidaysForYear(year) {
    if (holidayCache[year]) return holidayCache[year];
    const easter = easterDate(year);
    const list = [
      [new Date(year, 0, 1), "Neujahr"],
      [new Date(year, 0, 6), "Heilige Drei Könige"],
      [addDays(easter, -2), "Karfreitag"],
      [addDays(easter, 1), "Ostermontag"],
      [new Date(year, 4, 1), "Tag der Arbeit"],
      [addDays(easter, 39), "Christi Himmelfahrt"],
      [addDays(easter, 50), "Pfingstmontag"],
      [addDays(easter, 60), "Fronleichnam"],
      [new Date(year, 9, 3), "Tag der Deutschen Einheit"],
      [new Date(year, 10, 1), "Allerheiligen"],
      [new Date(year, 11, 25), "1. Weihnachtsfeiertag"],
      [new Date(year, 11, 26), "2. Weihnachtsfeiertag"],
    ];
    const map = {};
    for (const [d, name] of list) map[toKey(d)] = name;
    holidayCache[year] = map;
    return map;
  }

  function getHoliday(dateKeyStr) {
    const year = parseInt(dateKeyStr.slice(0, 4), 10);
    return getHolidaysForYear(year)[dateKeyStr] || null;
  }

  // Offizielle Schulferien Baden-Württemberg (Quelle: KMK / schulferien.org)
  const FERIEN_BW = [
    { start: "2025-04-14", end: "2025-04-26", name: "Osterferien" },
    { start: "2025-06-10", end: "2025-06-20", name: "Pfingstferien" },
    { start: "2025-07-31", end: "2025-09-13", name: "Sommerferien" },
    { start: "2025-10-27", end: "2025-10-31", name: "Herbstferien" },
    { start: "2025-12-22", end: "2026-01-05", name: "Weihnachtsferien" },

    { start: "2026-03-30", end: "2026-04-11", name: "Osterferien" },
    { start: "2026-05-26", end: "2026-06-05", name: "Pfingstferien" },
    { start: "2026-07-30", end: "2026-09-12", name: "Sommerferien" },
    { start: "2026-10-26", end: "2026-10-31", name: "Herbstferien" },
    { start: "2026-12-23", end: "2027-01-09", name: "Weihnachtsferien" },

    { start: "2027-03-25", end: "2027-03-25", name: "Osterferien" },
    { start: "2027-03-30", end: "2027-04-03", name: "Osterferien" },
    { start: "2027-05-18", end: "2027-05-29", name: "Pfingstferien" },
    { start: "2027-07-29", end: "2027-09-11", name: "Sommerferien" },
    { start: "2027-11-02", end: "2027-11-06", name: "Herbstferien" },
    { start: "2027-12-23", end: "2028-01-08", name: "Weihnachtsferien" },

    { start: "2028-04-13", end: "2028-04-13", name: "Osterferien" },
    { start: "2028-04-18", end: "2028-04-22", name: "Osterferien" },
    { start: "2028-06-06", end: "2028-06-17", name: "Pfingstferien" },
    { start: "2028-07-27", end: "2028-09-09", name: "Sommerferien" },
    { start: "2028-10-30", end: "2028-11-03", name: "Herbstferien" },
    { start: "2028-12-23", end: "2029-01-05", name: "Weihnachtsferien" },
  ];

  function getFerien(dateKeyStr) {
    return FERIEN_BW.find(f => dateKeyStr >= f.start && dateKeyStr <= f.end) || null;
  }

  window.BW_DATA = { getHoliday, getFerien, FERIEN_BW };
})();
