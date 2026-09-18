// Barcode scannen (Kamera über die im Browser eingebaute BarcodeDetector-Schnittstelle)
// und Produkt in Open Food Facts nachschlagen. Übertragen wird nur die Barcode-Nummer.
const Barcode = (function () {
  const API = "https://world.openfoodfacts.org/api/v2/product/";
  const FIELDS = [
    "code", "product_name", "product_name_de", "generic_name", "brands", "nutriments",
    "serving_quantity", "quantity", "product_quantity", "product_quantity_unit", "categories_tags",
  ].join(",");
  const FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e"];

  // Grobe Zuordnung der Open-Food-Facts-Kategorien zu den eigenen.
  const CATEGORY_MAP = [
    ["en:beverages", "Getränke"],
    ["en:dairies", "Milch & Käse"],
    ["en:cheeses", "Milch & Käse"],
    ["en:breads", "Brot & Backwaren"],
    ["en:breakfast-cereals", "Getreide & Beilagen"],
    ["en:pastas", "Getreide & Beilagen"],
    ["en:meats", "Fleisch & Wurst"],
    ["en:fishes", "Fisch"],
    ["en:fruits", "Obst"],
    ["en:vegetables", "Gemüse"],
    ["en:nuts", "Nüsse & Samen"],
    ["en:sauces", "Soßen"],
    ["en:snacks", "Süßes & Snacks"],
    ["en:sweets", "Süßes & Snacks"],
  ];

  function valid(code) {
    return /^\d{8,14}$/.test(code);
  }

  function supported() {
    return "BarcodeDetector" in window && !!navigator.mediaDevices?.getUserMedia;
  }

  function numOrNull(v) {
    const n = typeof v === "string" ? parseFloat(v.replace(",", ".")) : v;
    return Number.isFinite(n) ? n : null;
  }

  // Antwort von Open Food Facts in ein Lebensmittel (pro 100 g/ml) umwandeln.
  function toFood(code, p) {
    const n = p.nutriments || {};
    let kcal = numOrNull(n["energy-kcal_100g"]);
    const kj = numOrNull(n["energy-kj_100g"] ?? n.energy_100g);
    if (kcal == null && kj != null) kcal = kj / 4.184;
    const round1 = v => (v == null ? null : Math.round(v * 10) / 10);

    const baseName = (p.product_name_de || p.product_name || p.generic_name || "").trim();
    const brand = (p.brands || "").split(",")[0].trim();
    let name = baseName || (brand ? `${brand}-Produkt` : `Produkt ${code}`);
    if (brand && baseName && !normalize(baseName).includes(normalize(brand))) name = `${baseName} (${brand})`;

    const liquid = p.product_quantity_unit === "ml" || /\d\s*(ml|cl|l)\b/i.test(p.quantity || "");
    const serving = numOrNull(p.serving_quantity);
    const packSize = numOrNull(p.product_quantity);
    let portion = null;
    if (serving && serving > 0) portion = { name: "Portion", g: Math.round(serving) };
    else if (packSize && packSize > 0 && packSize <= 250) portion = { name: liquid ? "Flasche" : "Packung", g: Math.round(packSize) };

    const tags = p.categories_tags || [];
    const hit = CATEGORY_MAP.find(([tag]) => tags.includes(tag));
    const cat = liquid ? "Getränke" : hit ? hit[1] : undefined;

    return {
      name: name.slice(0, 60),
      cat,
      liquid: cat === "Getränke" || undefined,
      per: "100g",
      kcal: kcal == null ? null : Math.round(kcal),
      protein: round1(numOrNull(n.proteins_100g)),
      carbs: round1(numOrNull(n.carbohydrates_100g)),
      fat: round1(numOrNull(n.fat_100g)),
      portion,
      barcode: code,
      source: "openfoodfacts",
    };
  }

  function normalize(s) {
    return String(s).toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
  }

  // { found: true, food } | { found: false }. Wirft bei Netzwerkfehlern.
  async function lookup(code) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10000);
    try {
      const res = await fetch(`${API}${encodeURIComponent(code)}.json?fields=${FIELDS}`, {
        signal: ctrl.signal,
        credentials: "omit",
        referrerPolicy: "no-referrer",
      });
      if (res.status === 404) return { found: false };
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.status !== 1 || !data.product) return { found: false };
      return { found: true, food: toFood(code, data.product) };
    } finally {
      clearTimeout(timer);
    }
  }

  // Scanner-Fenster. onCode(code, ui) wird mit bereits gestoppter Kamera aufgerufen;
  // ui.status(text) zeigt einen Hinweis, ui.close() schließt das Fenster.
  function openScanner(level, onCode) {
    const dlg = document.getElementById(`sheet${level}`);
    let stream = null;
    let running = false;

    const stop = () => {
      running = false;
      if (stream) stream.getTracks().forEach(t => t.stop());
      stream = null;
    };

    App.sheet("Barcode scannen", (body, close) => {
      const canScan = supported();
      body.innerHTML = `
        ${canScan ? `<div class="scan-box"><video playsinline muted></video><div class="scan-line"></div></div>` : ""}
        <p class="scan-status muted">${canScan
          ? "Kamera wird gestartet…"
          : "Dieser Browser kann Barcodes nicht mit der Kamera lesen (z. B. am PC). Gib die Nummer unter dem Strichcode ein – am Handy mit Chrome klappt das Scannen."}</p>
        <label class="field">${canScan ? "Oder Nummer eingeben" : "Barcode-Nummer"}
          <span class="scan-manual">
            <input type="text" inputmode="numeric" autocomplete="off" maxlength="14" placeholder="z. B. 4001234567890" ${canScan ? "" : "autofocus"}>
            <button type="button" class="primary-btn">Suchen</button>
          </span>
        </label>
        <p class="muted small-text">Produktdaten von Open Food Facts (freie Datenbank, ODbL). Gesendet wird nur die Barcode-Nummer.</p>`;
      const statusEl = body.querySelector(".scan-status");
      const ui = {
        status: (text, isError) => {
          statusEl.textContent = text;
          statusEl.classList.toggle("bad-text", !!isError);
        },
        close,
      };
      const done = code => {
        stop();
        if (navigator.vibrate && navigator.userActivation?.hasBeenActive) navigator.vibrate(60);
        onCode(code, ui);
      };

      const manual = body.querySelector(".scan-manual input");
      const submit = () => {
        const code = manual.value.replace(/\s/g, "");
        if (!valid(code)) { App.toast("Bitte 8 bis 14 Ziffern eingeben"); return; }
        done(code);
      };
      body.querySelector(".scan-manual button").onclick = submit;
      manual.onkeydown = e => { if (e.key === "Enter") submit(); };

      if (!canScan) return;
      const video = body.querySelector("video");
      (async () => {
        try {
          const supportedFormats = await BarcodeDetector.getSupportedFormats();
          const formats = FORMATS.filter(f => supportedFormats.includes(f));
          const detector = new BarcodeDetector(formats.length ? { formats } : undefined);
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: "environment" } },
            audio: false,
          });
          // Fenster wurde schon geschlossen, während die Kamera startete.
          if (!dlg.open || !body.contains(video)) { stop(); return; }
          video.srcObject = stream;
          await video.play();
          running = true;
          ui.status("Halte den Barcode in den Rahmen.");
          const tick = async () => {
            if (!running) return;
            try {
              const codes = await detector.detect(video);
              const hit = codes.find(c => valid(c.rawValue));
              if (hit) { done(hit.rawValue); return; }
            } catch { /* nächster Versuch */ }
            setTimeout(tick, 200);
          };
          tick();
        } catch (err) {
          stop();
          ui.status(err && err.name === "NotAllowedError"
            ? "Kein Zugriff auf die Kamera. Erlaube ihn in den Browser-Einstellungen oder gib die Nummer ein."
            : "Die Kamera konnte nicht gestartet werden. Gib die Nummer ein.", true);
        }
      })();
    }, level);

    // Kamera immer ausschalten, sobald das Fenster zugeht.
    dlg.addEventListener("close", stop, { once: true });
  }

  return { lookup, openScanner, valid, supported };
})();
