// Schutz gegen Einbetten in fremde Seiten (Clickjacking).
// GitHub Pages kann dafür keine HTTP-Header setzen, deshalb prüft die Seite es selbst:
// Läuft sie in einem Rahmen einer anderen Adresse, bleibt sie leer.
(function () {
  if (window.top === window.self) return;
  let sameOrigin = false;
  try {
    sameOrigin = window.top.location.origin === window.location.origin;
  } catch {
    sameOrigin = false;
  }
  if (sameOrigin) return;
  document.documentElement.style.display = "none";
  try {
    window.top.location.replace(window.location.href);
  } catch {
    // Wenn die fremde Seite das Umleiten verhindert, bleibt die Seite einfach unsichtbar.
  }
})();
