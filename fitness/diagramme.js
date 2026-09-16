// Kleine SVG-Diagramme ohne Bibliothek: Linie mit Fadenkreuz, Balken (±), Kalender-Heatmap.
// Farben kommen aus CSS-Variablen (--viz-*), damit hell/dunkel automatisch passt.
const Charts = (function () {
  const NS = "http://www.w3.org/2000/svg";
  const tip = document.getElementById("chartTip");
  const observers = new WeakMap();

  function el(name, attrs = {}, parent) {
    const node = document.createElementNS(NS, name);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    if (parent) parent.appendChild(node);
    return node;
  }

  function dayIndex(key) {
    return Math.round(F.parseKey(key).getTime() / 86400000);
  }

  function niceTicks(min, max, count = 4) {
    if (min === max) { min -= 1; max += 1; }
    const raw = (max - min) / count;
    const mag = 10 ** Math.floor(Math.log10(raw));
    const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw) || raw;
    const lo = Math.floor(min / step) * step;
    const hi = Math.ceil(max / step) * step;
    const ticks = [];
    for (let v = lo; v <= hi + step / 2; v += step) ticks.push(F.round(v, 4));
    return ticks;
  }

  // Neu zeichnen, wenn sich die Breite ändert.
  function responsive(container, draw) {
    draw();
    const old = observers.get(container);
    if (old) old.disconnect();
    let lastWidth = container.clientWidth;
    const ro = new ResizeObserver(() => {
      if (Math.abs(container.clientWidth - lastWidth) < 4) return;
      lastWidth = container.clientWidth;
      draw();
    });
    ro.observe(container);
    observers.set(container, ro);
  }

  // rows: [{ value, label, key(css-Klasse für Linienfarbe) }]
  function showTip(evt, title, rows) {
    tip.innerHTML = "";
    const t = document.createElement("div");
    t.className = "tip-title";
    t.textContent = title;
    tip.appendChild(t);
    for (const r of rows) {
      const row = document.createElement("div");
      row.className = "tip-row";
      if (r.key) {
        const k = document.createElement("span");
        k.className = `tip-key ${r.key}`;
        row.appendChild(k);
      }
      const v = document.createElement("strong");
      v.textContent = r.value;
      const l = document.createElement("span");
      l.textContent = r.label;
      row.append(v, l);
      tip.appendChild(row);
    }
    tip.hidden = false;
    const x = evt.clientX;
    const y = evt.clientY;
    const w = tip.offsetWidth;
    const h = tip.offsetHeight;
    let left = x + 14;
    if (left + w > window.innerWidth - 8) left = x - w - 14;
    let top = y - h - 12;
    if (top < 8) top = y + 16;
    tip.style.left = `${Math.max(8, left)}px`;
    tip.style.top = `${top}px`;
  }

  function hideTip() { tip.hidden = true; }

  // ---------- Liniendiagramm ----------
  // opts: { series: [{ name, cls, style: "line"|"dots", points: [{ x: dateKey, y }] }],
  //         goal: { y, label }, unit, digits, height }
  function line(container, opts) {
    responsive(container, () => drawLine(container, opts));
  }

  function drawLine(container, opts) {
    container.innerHTML = "";
    const all = opts.series.flatMap(s => s.points);
    if (!all.length) {
      container.innerHTML = `<p class="muted chart-empty">Noch keine Daten im Zeitraum.</p>`;
      return;
    }
    const W = Math.max(260, container.clientWidth);
    const H = opts.height || 200;
    const m = { top: 12, right: 12, bottom: 24, left: 40 };
    const xs = all.map(p => dayIndex(p.x));
    let x0 = Math.min(...xs);
    let x1 = Math.max(...xs);
    if (x0 === x1) { x0 -= 1; x1 += 1; }
    const ys = all.map(p => p.y);
    if (opts.goal && opts.goal.y != null) ys.push(opts.goal.y);
    const spread = Math.max(...ys) - Math.min(...ys);
    const ticks = niceTicks(Math.min(...ys) - spread * 0.05, Math.max(...ys) + spread * 0.05);
    const y0 = ticks[0];
    const y1 = ticks[ticks.length - 1];
    const sx = v => m.left + (v - x0) / (x1 - x0) * (W - m.left - m.right);
    const sy = v => H - m.bottom - (v - y0) / (y1 - y0) * (H - m.top - m.bottom);

    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, class: "chart", role: "img", "aria-label": opts.label || "Diagramm" }, container);

    for (const t of ticks) {
      el("line", { x1: m.left, x2: W - m.right, y1: sy(t), y2: sy(t), class: "viz-grid" }, svg);
      el("text", { x: m.left - 6, y: sy(t) + 4, class: "viz-axis", "text-anchor": "end" }, svg).textContent = fmt(t, 1);
    }
    // Datumsbeschriftung: Anfang, Mitte, Ende.
    const labelDays = x1 - x0 > 2 ? [x0, Math.round((x0 + x1) / 2), x1] : [x0, x1];
    labelDays.forEach((d, i) => {
      const date = new Date(d * 86400000);
      const anchor = i === 0 ? "start" : i === labelDays.length - 1 ? "end" : "middle";
      el("text", { x: sx(d), y: H - 6, class: "viz-axis", "text-anchor": anchor }, svg)
        .textContent = `${F.pad(date.getDate())}.${F.pad(date.getMonth() + 1)}.`;
    });

    if (opts.goal && opts.goal.y != null) {
      el("line", { x1: m.left, x2: W - m.right, y1: sy(opts.goal.y), y2: sy(opts.goal.y), class: "viz-ref" }, svg);
      el("text", { x: W - m.right - 2, y: sy(opts.goal.y) - 5, class: "viz-ref-label", "text-anchor": "end" }, svg).textContent = opts.goal.label;
    }

    for (const s of opts.series) {
      const pts = s.points.map(p => [sx(dayIndex(p.x)), sy(p.y)]);
      if (s.style === "dots") {
        pts.forEach(([x, y]) => el("circle", { cx: x, cy: y, r: 4, class: `viz-dot ${s.cls}` }, svg));
      } else if (pts.length) {
        el("path", { d: pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(""), class: `viz-line ${s.cls}` }, svg);
        // Markierungen bei wenigen Punkten (Trainings), sonst nur bei einem einzelnen Punkt.
        if (pts.length === 1 || (s.markers && pts.length <= 40)) {
          pts.forEach(([x, y]) => el("circle", { cx: x, cy: y, r: 4, class: `viz-dot ${s.cls}` }, svg));
        }
      }
    }

    // Fadenkreuz: rastet auf das nächste Datum ein und zeigt alle Reihen.
    const hover = el("g", { class: "viz-hover", visibility: "hidden" }, svg);
    const vline = el("line", { y1: m.top, y2: H - m.bottom, class: "viz-crosshair" }, hover);
    const marks = opts.series.map(s => el("circle", { r: 5, class: `viz-focus ${s.cls}` }, hover));
    const days = [...new Set(xs)].sort((a, b) => a - b);
    const byDay = opts.series.map(s => new Map(s.points.map(p => [dayIndex(p.x), p])));
    const hit = el("rect", { x: m.left, y: 0, width: W - m.left - m.right, height: H, class: "viz-hit", tabindex: 0 }, svg);
    let focusIdx = days.length - 1;

    const showAt = (d, evt) => {
      hover.setAttribute("visibility", "visible");
      vline.setAttribute("x1", sx(d));
      vline.setAttribute("x2", sx(d));
      const rows = [];
      opts.series.forEach((s, i) => {
        const p = byDay[i].get(d);
        marks[i].setAttribute("visibility", p ? "visible" : "hidden");
        if (!p) return;
        marks[i].setAttribute("cx", sx(d));
        marks[i].setAttribute("cy", sy(p.y));
        rows.push({ value: `${fmt(p.y, opts.digits ?? 1)} ${opts.unit || ""}`.trim(), label: s.name, key: s.cls });
      });
      const key = F.keyOf(new Date(d * 86400000));
      showTip(evt, dateLong(key), rows);
    };
    hit.addEventListener("pointermove", evt => {
      const rect = svg.getBoundingClientRect();
      const px = (evt.clientX - rect.left) / rect.width * W;
      const target = x0 + (px - m.left) / (W - m.left - m.right) * (x1 - x0);
      let best = days[0];
      for (const d of days) if (Math.abs(d - target) < Math.abs(best - target)) best = d;
      focusIdx = days.indexOf(best);
      showAt(best, evt);
    });
    const leave = () => { hover.setAttribute("visibility", "hidden"); hideTip(); };
    hit.addEventListener("pointerleave", leave);
    hit.addEventListener("blur", leave);
    const keyShow = () => {
      const r = svg.getBoundingClientRect();
      showAt(days[focusIdx], { clientX: r.left + sx(days[focusIdx]) / W * r.width, clientY: r.top + 20 });
    };
    hit.addEventListener("focus", keyShow);
    hit.addEventListener("keydown", e => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      focusIdx = Math.max(0, Math.min(days.length - 1, focusIdx + (e.key === "ArrowRight" ? 1 : -1)));
      keyShow();
    });
  }

  // ---------- Balken um die Nulllinie ----------
  // opts: { data: [{ x: dateKey, y, detail }], ref: { y, label }, unit, posLabel, negLabel }
  function bars(container, opts) {
    responsive(container, () => drawBars(container, opts));
  }

  function barPath(x, w, yBase, yEnd, r) {
    const h = Math.abs(yEnd - yBase);
    r = Math.min(r, w / 2, h);
    if (yEnd < yBase) {
      return `M${x},${yBase}V${yEnd + r}Q${x},${yEnd} ${x + r},${yEnd}H${x + w - r}Q${x + w},${yEnd} ${x + w},${yEnd + r}V${yBase}Z`;
    }
    return `M${x},${yBase}V${yEnd - r}Q${x},${yEnd} ${x + r},${yEnd}H${x + w - r}Q${x + w},${yEnd} ${x + w},${yEnd - r}V${yBase}Z`;
  }

  function drawBars(container, opts) {
    container.innerHTML = "";
    if (!opts.data.length) {
      container.innerHTML = `<p class="muted chart-empty">Noch keine Daten im Zeitraum.</p>`;
      return;
    }
    const W = Math.max(260, container.clientWidth);
    const H = opts.height || 200;
    const m = { top: 12, right: 12, bottom: 24, left: 46 };
    const ys = opts.data.map(d => d.y).concat([0]);
    if (opts.ref) ys.push(opts.ref.y);
    const ticks = niceTicks(Math.min(...ys), Math.max(...ys));
    const y0 = ticks[0];
    const y1 = ticks[ticks.length - 1];
    const sy = v => H - m.bottom - (v - y0) / (y1 - y0) * (H - m.top - m.bottom);

    const first = dayIndex(opts.data[0].x);
    const last = dayIndex(opts.data[opts.data.length - 1].x);
    const slots = last - first + 1;
    const slotW = (W - m.left - m.right) / slots;
    const gap = Math.min(2, slotW * 0.2);
    const barW = Math.max(1, slotW - gap);

    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, class: "chart", role: "img", "aria-label": opts.label || "Diagramm" }, container);
    for (const t of ticks) {
      el("line", { x1: m.left, x2: W - m.right, y1: sy(t), y2: sy(t), class: t === 0 ? "viz-zero" : "viz-grid" }, svg);
      el("text", { x: m.left - 6, y: sy(t) + 4, class: "viz-axis", "text-anchor": "end" }, svg).textContent = fmt(t);
    }
    [first, last].forEach((d, i) => {
      const date = new Date(d * 86400000);
      el("text", { x: i ? W - m.right : m.left, y: H - 6, class: "viz-axis", "text-anchor": i ? "end" : "start" }, svg)
        .textContent = `${F.pad(date.getDate())}.${F.pad(date.getMonth() + 1)}.`;
    });

    for (const d of opts.data) {
      const x = m.left + (dayIndex(d.x) - first) * slotW + gap / 2;
      const cls = d.y > 0 ? "viz-pos" : "viz-neg";
      const g = el("g", { class: "viz-bar", tabindex: 0 }, svg);
      el("rect", { x: x - gap / 2, y: m.top, width: slotW, height: H - m.top - m.bottom, class: "viz-hit" }, g);
      if (d.y !== 0) el("path", { d: barPath(x, barW, sy(0), sy(d.y), 4), class: cls }, g);
      const show = evt => showTip(evt, dateLong(d.x), [
        { value: `${d.y > 0 ? "+" : ""}${fmt(d.y)} ${opts.unit || ""}`, label: d.y > 0 ? opts.posLabel : opts.negLabel, key: cls },
        ...(d.detail || []),
      ]);
      g.addEventListener("pointermove", show);
      g.addEventListener("pointerleave", hideTip);
      g.addEventListener("focus", () => {
        const r = g.getBoundingClientRect();
        show({ clientX: r.left + r.width / 2, clientY: r.top + 10 });
      });
      g.addEventListener("blur", hideTip);
    }

    if (opts.ref) {
      el("line", { x1: m.left, x2: W - m.right, y1: sy(opts.ref.y), y2: sy(opts.ref.y), class: "viz-ref" }, svg);
      el("text", { x: W - m.right - 2, y: sy(opts.ref.y) + 14, class: "viz-ref-label", "text-anchor": "end" }, svg).textContent = opts.ref.label;
    }
  }

  // ---------- Heatmap (Wochen × Wochentage) ----------
  // opts: { weeks, valueOf(key) → { level 0–4, title, rows } }
  function heatmap(container, opts) {
    responsive(container, () => drawHeatmap(container, opts));
  }

  function drawHeatmap(container, opts) {
    container.innerHTML = "";
    const W = Math.max(260, container.clientWidth);
    const labelW = 22;
    const gap = 2;
    const weeks = opts.weeks;
    const cell = Math.min(22, Math.floor((W - labelW) / weeks) - gap);
    const H = 7 * (cell + gap) + 16;
    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, class: "chart", role: "img", "aria-label": "Trainingstage" }, container);

    const today = F.todayKey();
    const startKey = F.addDays(F.weekStart(today), -(weeks - 1) * 7);
    ["Mo", "", "Mi", "", "Fr", "", "So"].forEach((l, r) => {
      if (l) el("text", { x: 0, y: 16 + r * (cell + gap) + cell * 0.72, class: "viz-axis" }, svg).textContent = l;
    });

    let lastMonth = -1;
    let lastLabelX = -Infinity;
    for (let w = 0; w < weeks; w++) {
      const weekKey = F.addDays(startKey, w * 7);
      const month = F.parseKey(weekKey).getMonth();
      const x = labelW + w * (cell + gap);
      // Monatsname nur mit genug Abstand zum vorigen, damit nichts überlappt.
      if (month !== lastMonth) {
        if (w < weeks - 2 && x - lastLabelX >= 30) {
          el("text", { x, y: 10, class: "viz-axis" }, svg).textContent = MONTHS[month].slice(0, 3);
          lastLabelX = x;
        }
        lastMonth = month;
      }
      for (let d = 0; d < 7; d++) {
        const key = F.addDays(weekKey, d);
        if (key > today) continue;
        const info = opts.valueOf(key);
        const rect = el("rect", {
          x, y: 16 + d * (cell + gap), width: cell, height: cell, rx: 3,
          class: `heat heat-${info.level}${key === today ? " heat-today" : ""}${info.missed ? " heat-missed" : ""}`,
        }, svg);
        rect.addEventListener("pointermove", evt => showTip(evt, dateLong(key), info.rows));
        rect.addEventListener("pointerleave", hideTip);
        rect.addEventListener("click", evt => { showTip(evt, dateLong(key), info.rows); if (opts.onClick) opts.onClick(key); });
      }
    }
  }

  document.addEventListener("scroll", hideTip, { passive: true });

  return { line, bars, heatmap, hideTip };
})();
