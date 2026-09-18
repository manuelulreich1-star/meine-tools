# Meine Tools

Ein kleines, wachsendes Dashboard für selbstgebaute Web-Tools. Alles läuft ohne Build-Schritt und ohne Abhängigkeiten direkt im Browser.

## Struktur

| Pfad | Inhalt |
|---|---|
| `index.html`, `style.css`, `script.js` | Dashboard/Übersicht mit Kacheln und Benachrichtigungs-Zählern für alle Tools |
| `shared/theme.css` | Gemeinsames Design (Farben, Schrift, Buttons) für alle Tools |
| `shared/sync.js`, `shared/sync-config.js` | Google-Drive-Sync für alle Tools (siehe unten) |
| `kalender/` | Kalender-Tool (siehe unten) |
| `todo/` | To-Do-Liste (siehe unten) |
| `fitness/` | Fitnessplaner (siehe unten) |
| `serve.ps1` | Lokaler Entwicklungsserver für das gesamte Projekt (Port 8081) |

Neue Tools bekommen jeweils einen eigenen Unterordner und werden im `TOOLS`-Array in `script.js` als Kachel eingetragen.

Über eine optionale `badge()`-Funktion zeigt eine Kachel einen roten Zähler oben rechts (wie bei App-Icons) plus kurze Hinweise. Aktuell:

- **Kalender:** Termine heute, die noch anstehen, und der nächste Termin
- **To-Do-Liste:** offene Tagesaufgaben für heute, Wochen-/Monatsaufgaben nur am letzten Tag der Woche (Sonntag) bzw. des Monats, plus überfällige Aufgaben
- **Fitnessplaner:** heute noch offene geplante Trainings plus fehlender Gewichtseintrag; dazu Hinweise wie „Heute: Push“ und verbleibende kcal

Damit das Dashboard die Daten lesen kann, liegt die Lade-Logik jedes Tools in einer eigenen `daten.js`.

## Öffnen

Am einfachsten: Doppelklick auf `index.html` öffnet das Dashboard im Standardbrowser — kein Server nötig, da alles über `localStorage` läuft.

Alternativ, z. B. wenn der Browser lokale Dateien beim Doppelklick blockiert, mit lokalem Server starten:

```powershell
powershell -ExecutionPolicy Bypass -File serve.ps1
```

Danach unter <http://localhost:8081/> öffnen.

## Kalender

Termine mit Uhrzeit, Farbe, Priorität und Notiz anlegen, bearbeiten und löschen.

- Monatsansicht mit Navigation (vorheriger/nächster Monat, „Heute")
- Prioritäten (niedrig/mittel/hoch) inkl. farblicher Hervorhebung
- Wiederkehrende Termine (täglich, wöchentlich, monatlich, jährlich) mit Intervall und optionalem Enddatum
- Suche in Titeln und Notizen
- Gesetzliche Feiertage in Baden-Württemberg (berechnet, auch bewegliche wie Ostern)
- Schulferien in Baden-Württemberg für 2025–2028

Die Termine werden im `localStorage` des Browsers gespeichert und bleiben nur in diesem Browser auf diesem Gerät erhalten.

### Dateien

| Datei | Inhalt |
|---|---|
| `kalender/index.html` | Aufbau der Seite und Termin-Dialog |
| `kalender/script.js` | Kalenderansichten, Termin-Dialog, Suche |
| `kalender/daten.js` | Laden/Speichern, Wiederholungslogik, Zähler fürs Dashboard |
| `kalender/feiertage.js` | Feiertage und Schulferien für Baden-Württemberg |
| `kalender/vorlagen.js` | Allgemeine feste Termine, die beim Öffnen einmalig übernommen werden (persönliche in `vorlagen.lokal.js`) |
| `kalender/style.css` | Kalender-spezifische Gestaltung |

### Schulferien aktualisieren

Die Ferientermine stehen fest im Array `FERIEN_BW` in `kalender/feiertage.js`. Nach 2028 müssen dort neue Termine eingetragen werden (Quelle: KMK / schulferien.org).

## To-Do-Liste

Aufgaben anlegen, abhaken, bearbeiten und löschen.

- Zeiträume: Aufgaben für einen Tag (heute, morgen, bestimmter Tag), eine Woche (Mo–So) oder einen Monat, oder ohne Zeitraum
- Reiter „Heute“, „Woche“, „Monat“ (jeweils aktueller und nächster Zeitraum) und „Alle“
- Überfällige Aufgaben werden oben rot angezeigt
- „Nicht erledigt“ verschiebt eine Aufgabe in den nächsten Zeitraum (morgen / nächste Woche / nächster Monat); überfällige landen im aktuellen Zeitraum. Verschiebungen werden gezählt, Verschieben und Löschen lassen sich rückgängig machen
- Prioritäten (niedrig/mittel/hoch), farbig am linken Rand
- Notiz pro Aufgabe (im Bearbeiten-Dialog, Klick auf die Aufgabe)
- Suche, „Erledigte anzeigen“ und „Erledigte löschen“

Die Aufgaben werden im `localStorage` unter `meine-todos` gespeichert.

| Datei | Inhalt |
|---|---|
| `todo/index.html` | Aufbau der Seite und Bearbeiten-Dialog |
| `todo/script.js` | Ansicht: Reiter, Verschieben, Anlegen, Abhaken, Sortieren |
| `todo/daten.js` | Laden/Speichern, Zeitraum-Logik, Zähler fürs Dashboard |
| `todo/vorlagen.js` | Allgemeine feste Aufgaben, die beim Öffnen einmalig übernommen werden (persönliche in `vorlagen.lokal.js`) |
| `todo/style.css` | To-Do-spezifische Gestaltung |

## Fitnessplaner

Fürs Handy gebaut, mit Tab-Leiste unten: **Heute · Plan · Ernährung · Körper · Statistik**, Einstellungen über ⚙️.

- **Profil:** beim ersten Start abgefragt (Geschlecht, Geburtsjahr, Größe, Gewicht, Zielgewicht, Alltag). Kalorienbedarf nach Mifflin-St Jeor, Tagesziel = Bedarf − Defizit (Standard 500 kcal) + verbrannte kcal aus dem Training
- **Plan:** fester Wochenplan (Einheiten pro Wochentag, optional mit Uhrzeit), eigene Einheiten mit Sätzen/Wdh./Pause/Gewicht bzw. Dauer/Strecke. Vorlagen: Push/Pull/Beine, Heimtraining ohne Geräte, Lauf-Einsteiger
- **Training (Live-Modus):** jeden Satz mit kg, Wdh. (oder Sekunden) und Anstrengung (RPE) abhaken, Pausen-Timer mit Ton/Vibration, Halte-Timer für Übungen auf Zeit, Stoppuhr, Werte vom letzten Mal, Steigerungsvorschlag (+kg bzw. +Wdh., wenn alles geschafft wurde und es nicht zu schwer war), Notiz beim Beenden. Ein laufendes Training übersteht das Neuladen der Seite. Nachtragen: Training starten und beim Beenden Datum und Dauer ändern
- **Übungen:** rund 60 vorgegebene Übungen (Gym, Körpergewicht, Cardio) mit Ausführungshinweisen, eigene lassen sich ergänzen
- **Ernährung:** Mahlzeiten mit kcal, Eiweiß, Kohlenhydraten und Fett, rund 240 Lebensmittel in 15 Kategorien (Richtwerte pro 100 g bzw. 100 ml, eigene pro 100 g oder pro Portion), Suche ohne Rücksicht auf Umlaute, Barcode-Scan per Handykamera (Chrome auf Android) oder Nummerneingabe mit Nährwerten aus Open Food Facts – gescannte Produkte werden gespeichert und beim nächsten Scan sofort erkannt, eigene Gerichte aus Zutaten (mit Portionen, auch direkt aus einer Mahlzeit „Als Gericht speichern“), „Wie am Vortag“, Makroziele (Eiweiß 1,8 g/kg Zielgewicht, Fett 25 %)
- **Körper:** Gewicht, Körperfett, BMI, Schritte, Wasser, Schlaf mit Tageszielen, Zielprognose
- **Statistik:** Serie, Wochenfortschritt, Gewichtsverlauf mit 7-Tage-Schnitt, Trainingstage als Heatmap, Fortschritt pro Übung (Bestwerte, geschätztes 1RM, Volumen, Pace), Kalorienbilanz, Trainingsverlauf
- **Verknüpfungen:** Kachel-Zähler im Dashboard, geplante und erledigte Trainings erscheinen im Kalender (Klick öffnet den Fitnessplaner), `FitnessDaten.summary()` liefert Kennzahlen für die geplante Statistik-Kachel

Alle Daten liegen im `localStorage` unter `mein-fitness` (ein einziges Objekt).

| Datei | Inhalt |
|---|---|
| `fitness/index.html` | Aufbau: Tabs, Live-Training, Fenster |
| `fitness/daten.js` | Laden/Speichern, Berechnungen (Kalorien, BMI, 1RM, Steigerung, Serie), Zähler fürs Dashboard, Termine für den Kalender |
| `fitness/vorlagen.js` | Übungen, Plan-Vorlagen |
| `fitness/lebensmittel.js` | Mitgelieferte Lebensmittel mit Kategorien |
| `fitness/barcode.js` | Barcode-Scanner (Kamera) und Abfrage bei Open Food Facts |
| `fitness/app.js` | Grundgerüst: Navigation, Fenster, Hinweise, Hilfsfunktionen |
| `fitness/heute.js` | Tab „Heute“ |
| `fitness/training.js` | Laufendes Training mit Timern |
| `fitness/plan.js` | Tab „Plan“, Vorlagen, Übungsauswahl, eigene Übungen |
| `fitness/ernaehrung.js` | Tab „Ernährung“, Lebensmittel- und Gerichteverwaltung |
| `fitness/koerper.js` | Tab „Körper“ |
| `fitness/statistik.js` | Tab „Statistik“ |
| `fitness/diagramme.js` | SVG-Diagramme (Linie, Balken, Heatmap) ohne Bibliothek |
| `fitness/einstellungen.js` | Profil, Tagesziele, Übungen, Daten löschen |
| `fitness/style.css` | Fitness-spezifische Gestaltung |

## Persönliche Vorlagen

Persönliche Termine und Aufgaben stehen in `kalender/vorlagen.lokal.js` bzw. `todo/vorlagen.lokal.js`. Diese Dateien ignoriert Git (`.gitignore`), damit sie nie veröffentlicht werden. Sie ergänzen die allgemeinen Listen mit `KALENDER_VORLAGEN.push({ … })` bzw. `TODO_VORLAGEN.push({ … })`. Fehlt eine lokale Datei (z. B. in der Online-Version), meldet der Browser nur einen harmlosen 404-Fehler in der Konsole.

## Google-Drive-Sync

Gleicht Kalender, To-Do-Liste und Fitnessplaner zwischen Geräten ab.

- **Berechtigung:** nur `drive.appdata` – die App sieht ausschließlich ihren eigenen, versteckten App-Ordner im Google Drive, keine anderen Dateien
- **Ablage:** je Speicher-Eintrag eine Datei (`mein-kalender-events.json`, `meine-todos.json`, `mein-fitness.json`, …)
- **Abgleich:** automatisch beim Öffnen, kurz nach jeder Änderung, beim Zurückkehren zur Seite und alle 2 Minuten. Drei-Wege-Zusammenführung: Einträge mit `id` werden einzeln abgeglichen, Löschungen übernommen; ändern beide Geräte denselben Wert, gewinnt die jüngere Änderung
- **Anmeldung:** über Google im Browser (ohne Server, ohne Client Secret). Der Zugriffsschlüssel gilt eine Stunde und liegt nur im `sessionStorage`; danach zeigt die Statusanzeige 🔒 „Tippen zum Synchronisieren“. Ungesicherte Änderungen bleiben bis dahin lokal erhalten
- **Status:** im Dashboard unter der Überschrift (mit „Trennen“), im Fitnessplaner oben, in Kalender und To-Do-Liste unten links
- **Einrichtung:** OAuth-Client-ID (Typ „Webanwendung“, autorisierte JavaScript-Quellen `http://localhost:8081` und die spätere Web-Adresse) in `shared/sync-config.js` eintragen. Funktioniert nicht beim Öffnen per Doppelklick (`file://`), nur über `serve.ps1` oder die Web-Adresse

- **Sicherheitsnetz:** Bevor der Sync lokale Daten überschreibt, wird der vorherige Stand aufgehoben (je Bereich die letzte Version, 7 Tage). Im Dashboard holt „Stand vor Sync zurückholen“ ihn wieder – er wird dann auf alle Geräte übertragen. Dateien in fremdem Format werden nicht übernommen

Interne Einträge im `localStorage`: `sync-meta` (Status, offene Änderungen), `sync-base:<Schlüssel>` (letzter gemeinsamer Stand) und `sync-backup:<Schlüssel>` (Stand vor dem letzten Abgleich).

## Sicherheit und Veröffentlichung

Die Online-Version liegt im **öffentlichen** Repo `manuelulreich1-star/meine-tools` (GitHub Pages: <https://manuelulreich1-star.github.io/meine-tools/>). Dieses Repo hier bleibt privat.

**Veröffentlichen** nur mit dem Skript:

```powershell
powershell -ExecutionPolicy Bypass -File veroeffentlichen.ps1 -NurAnzeigen   # erst prüfen
powershell -ExecutionPolicy Bypass -File veroeffentlichen.ps1                # dann hochladen
```

- Übernommen wird nur der eingecheckte Stand von `main` – ohne Verlauf, ohne `.claude/` und ohne `*.lokal.*`-Dateien (dafür leere Platzhalter)
- Vor dem Hochladen sucht das Skript nach E-Mail-Adressen, Zugangsdaten (Google-/GitHub-Schlüssel, private Schlüssel, Passwörter), IBANs, Telefonnummern und nach den Begriffen aus `veroeffentlichen.sperrliste.lokal.txt` (lokal, nie veröffentlicht). Bei einem Treffer bricht es ab
- Öffentliche Commits laufen über die anonyme GitHub-Adresse

**Grundregel:** Alles Persönliche (Namen, Termine, Adressen, Gesundheitsdaten, Zugangsdaten) gehört nie in eingecheckte Dateien, sondern in `*.lokal.*`-Dateien oder in die Browserdaten. Was einmal öffentlich war, lässt sich nicht sicher zurückholen.

**Schutzmaßnahmen in den Seiten:**

- Content-Security-Policy: Skripte nur von der eigenen Seite und von Googles Anmeldung, Datenverbindungen nur zu Google Drive (im Fitnessplaner zusätzlich zu Open Food Facts für den Barcode-Scan, dabei wird nur die Barcode-Nummer gesendet), keine eingebetteten Fremdinhalte, keine Inline-Skripte
- `shared/schutz.js`: Die Seiten bleiben leer, wenn eine fremde Seite sie einbettet (Schutz vor Clickjacking, weil GitHub Pages keine Header setzen kann)
- `noindex`: Suchmaschinen sollen die Seiten nicht aufnehmen
- Referrer nur als Adresse ohne Pfad, keine externen Schriftarten (keine Anfragen an Google Fonts)
- Nutzertexte werden vor der Anzeige maskiert (`esc`) oder als reiner Text eingesetzt

**Wichtig:** Alle GitHub-Pages-Projekte unter `manuelulreich1-star.github.io` teilen sich im Browser denselben Speicher. Dort deshalb nur eigenen, vertrauenswürdigen Code veröffentlichen.

**Google-Cloud-Projekt „Meine Tools“:** im Status „Test“ lassen, nur die eigene Adresse als Testnutzer, keinen Clientschlüssel anlegen oder weitergeben. Zugriff entziehen: <https://myaccount.google.com/connections>.
