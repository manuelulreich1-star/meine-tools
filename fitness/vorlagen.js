// Vorgegebene Übungen, Trainingsplan-Vorlagen und Lebensmittel für den Fitnessplaner.
// Übungen: type "kraft" (mit Gewicht), "koerper" (Körpergewicht), "cardio" (Dauer/Distanz).
// measure "time" = Satz wird in Sekunden statt Wiederholungen gemessen.
// met = Stoffwechseläquivalent für die Kalorienschätzung, inc = Steigerung in kg.
// Neue Einträge brauchen eine eigene, feste id.
const FITNESS_UEBUNGEN = [
  // Brust
  { id: "bankdruecken", name: "Bankdrücken (Langhantel)", group: "Brust", type: "kraft", inc: 2.5, hint: "Schulterblätter zusammen, Stange zur unteren Brust, Füße fest am Boden." },
  { id: "schraegbank-kh", name: "Schrägbankdrücken (Kurzhantel)", group: "Brust", type: "kraft", inc: 2, hint: "Bank auf 30–45°, Hanteln kontrolliert bis auf Brusthöhe senken." },
  { id: "bankdruecken-kh", name: "Bankdrücken (Kurzhantel)", group: "Brust", type: "kraft", inc: 2, hint: "Ellbogen ca. 45° vom Körper, oben nicht ganz durchstrecken." },
  { id: "butterfly", name: "Butterfly (Maschine)", group: "Brust", type: "kraft", inc: 2.5, hint: "Leicht gebeugte Arme, Brust bewusst zusammendrücken." },
  { id: "dips", name: "Dips", group: "Brust", type: "koerper", hint: "Oberkörper leicht nach vorn, bis Oberarme etwa waagrecht." },
  { id: "liegestuetze", name: "Liegestütze", group: "Brust", type: "koerper", hint: "Körper bildet eine Linie, Brust fast bis zum Boden." },
  { id: "knie-liegestuetze", name: "Knie-Liegestütze", group: "Brust", type: "koerper", hint: "Einsteigervariante: Knie am Boden, Hüfte gestreckt." },

  // Rücken
  { id: "klimmzuege", name: "Klimmzüge", group: "Rücken", type: "koerper", hint: "Aus dem Hang, Brust zur Stange. Alternativ mit Band unterstützen." },
  { id: "latzug", name: "Latzug", group: "Rücken", type: "kraft", inc: 2.5, hint: "Stange zur oberen Brust, Schultern unten lassen." },
  { id: "rudern-lh", name: "Rudern vorgebeugt (Langhantel)", group: "Rücken", type: "kraft", inc: 2.5, hint: "Rücken gerade, Stange zum Bauchnabel ziehen." },
  { id: "rudern-kh", name: "Einarmiges Rudern (Kurzhantel)", group: "Rücken", type: "kraft", inc: 2, hint: "Auf Bank abstützen, Ellbogen eng am Körper nach hinten." },
  { id: "rudern-kabel", name: "Rudern am Kabel (sitzend)", group: "Rücken", type: "kraft", inc: 2.5, hint: "Aufrecht sitzen, Griff zum Bauch, Schulterblätter zusammen." },
  { id: "kreuzheben", name: "Kreuzheben", group: "Rücken", type: "kraft", inc: 5, hint: "Stange nah am Körper, Rücken neutral, aus Beinen und Hüfte drücken." },
  { id: "hyperextensions", name: "Hyperextensions", group: "Rücken", type: "koerper", hint: "Langsam absenken, oben nicht ins Hohlkreuz gehen." },
  { id: "face-pulls", name: "Face Pulls", group: "Rücken", type: "kraft", inc: 2.5, hint: "Seil zum Gesicht ziehen, Hände nach außen drehen." },

  // Schultern
  { id: "schulterdruecken-kh", name: "Schulterdrücken (Kurzhantel)", group: "Schultern", type: "kraft", inc: 2, hint: "Sitzend, Hanteln von Ohrhöhe nach oben drücken." },
  { id: "military-press", name: "Military Press (Langhantel)", group: "Schultern", type: "kraft", inc: 2.5, hint: "Stehend, Bauch und Po fest, Stange über den Kopf." },
  { id: "seitheben", name: "Seitheben", group: "Schultern", type: "kraft", inc: 1, hint: "Arme leicht gebeugt bis Schulterhöhe heben, langsam senken." },
  { id: "reverse-butterfly", name: "Reverse Butterfly", group: "Schultern", type: "kraft", inc: 2.5, hint: "Hintere Schulter: Arme nach hinten öffnen." },
  { id: "pike-liegestuetze", name: "Pike-Liegestütze", group: "Schultern", type: "koerper", hint: "Hüfte hoch (umgekehrtes V), Kopf Richtung Boden senken." },

  // Arme
  { id: "bizepscurls", name: "Bizepscurls (Kurzhantel)", group: "Arme", type: "kraft", inc: 2, hint: "Ellbogen fest am Körper, nicht schwingen." },
  { id: "hammercurls", name: "Hammercurls", group: "Arme", type: "kraft", inc: 2, hint: "Daumen zeigen nach oben, kontrolliert curlen." },
  { id: "sz-curls", name: "SZ-Curls", group: "Arme", type: "kraft", inc: 2.5, hint: "Schulterbreiter Griff, volle Bewegung." },
  { id: "trizeps-kabel", name: "Trizepsdrücken am Kabel", group: "Arme", type: "kraft", inc: 2.5, hint: "Ellbogen bleiben am Körper, unten voll strecken." },
  { id: "french-press", name: "French Press", group: "Arme", type: "kraft", inc: 2.5, hint: "Liegend, Stange zur Stirn senken, Ellbogen zeigen nach oben." },
  { id: "bank-dips", name: "Trizeps-Dips an der Bank", group: "Arme", type: "koerper", hint: "Hände hinter dir auf der Bank, Po nah an der Kante." },

  // Beine & Po
  { id: "kniebeugen-lh", name: "Kniebeugen (Langhantel)", group: "Beine", type: "kraft", inc: 5, hint: "Brust raus, Knie in Richtung Zehen, mindestens bis Oberschenkel waagrecht." },
  { id: "goblet-squat", name: "Goblet Squat", group: "Beine", type: "kraft", inc: 2, hint: "Kurzhantel vor der Brust, tief und aufrecht in die Hocke." },
  { id: "beinpresse", name: "Beinpresse", group: "Beine", type: "kraft", inc: 5, hint: "Unterer Rücken bleibt am Polster, Knie nicht ganz durchstrecken." },
  { id: "rdl", name: "Rumänisches Kreuzheben", group: "Beine", type: "kraft", inc: 5, hint: "Knie leicht gebeugt, Hüfte nach hinten schieben, Dehnung in der Beinrückseite." },
  { id: "ausfallschritte-kh", name: "Ausfallschritte (Kurzhantel)", group: "Beine", type: "kraft", inc: 2, hint: "Großer Schritt, hinteres Knie Richtung Boden." },
  { id: "beinstrecker", name: "Beinstrecker", group: "Beine", type: "kraft", inc: 2.5, hint: "Oben kurz halten, langsam ablassen." },
  { id: "beinbeuger", name: "Beinbeuger", group: "Beine", type: "kraft", inc: 2.5, hint: "Hüfte bleibt am Polster, kontrolliert beugen." },
  { id: "wadenheben", name: "Wadenheben", group: "Beine", type: "kraft", inc: 5, hint: "Voller Bewegungsumfang, oben kurz halten." },
  { id: "hip-thrust", name: "Hip Thrust (Langhantel)", group: "Po", type: "kraft", inc: 5, hint: "Schultern auf der Bank, Hüfte ganz strecken, Po anspannen." },
  { id: "kniebeugen", name: "Kniebeugen ohne Gewicht", group: "Beine", type: "koerper", hint: "Arme nach vorn, Gewicht auf den Fersen." },
  { id: "ausfallschritte", name: "Ausfallschritte ohne Gewicht", group: "Beine", type: "koerper", hint: "Wiederholungen pro Bein zählen." },
  { id: "bulgarian-split", name: "Bulgarian Split Squats", group: "Beine", type: "koerper", hint: "Hinterer Fuß auf Stuhl/Sofa, Wiederholungen pro Bein." },
  { id: "wandsitzen", name: "Wandsitzen", group: "Beine", type: "koerper", measure: "time", hint: "Rücken an der Wand, Knie im 90°-Winkel halten." },
  { id: "glute-bridge", name: "Glute Bridge", group: "Po", type: "koerper", hint: "Rückenlage, Hüfte hochdrücken, oben Po anspannen." },

  // Core
  { id: "plank", name: "Plank", group: "Core", type: "koerper", measure: "time", hint: "Unterarmstütz, Körper gerade, Bauch fest." },
  { id: "seitstuetz", name: "Seitstütz", group: "Core", type: "koerper", measure: "time", hint: "Zeit pro Seite, Hüfte oben halten." },
  { id: "crunches", name: "Crunches", group: "Core", type: "koerper", hint: "Schultern nur leicht anheben, Nacken locker." },
  { id: "beinheben", name: "Beinheben liegend", group: "Core", type: "koerper", hint: "Unterer Rücken bleibt am Boden." },
  { id: "russian-twists", name: "Russian Twists", group: "Core", type: "koerper", hint: "Oberkörper zurücklehnen, Wiederholungen pro Seite." },
  { id: "mountain-climbers", name: "Mountain Climbers", group: "Core", type: "koerper", met: 8, hint: "Liegestützposition, Knie abwechselnd zügig zur Brust." },
  { id: "haengendes-beinheben", name: "Hängendes Beinheben", group: "Core", type: "koerper", hint: "An der Stange hängen, Beine ohne Schwung heben." },

  // Ganzkörper
  { id: "burpees", name: "Burpees", group: "Ganzkörper", type: "koerper", met: 8, hint: "Hocke, Liegestütz, zurück in die Hocke, Strecksprung." },
  { id: "hampelmaenner", name: "Hampelmänner", group: "Ganzkörper", type: "koerper", met: 7, hint: "Locker und rhythmisch springen." },
  { id: "kettlebell-swings", name: "Kettlebell Swings", group: "Ganzkörper", type: "kraft", inc: 4, met: 8, hint: "Kraft aus der Hüfte, Arme nur führen." },

  // Cardio (distance: false = keine Strecke)
  { id: "laufen", name: "Laufen", group: "Cardio", type: "cardio", met: 8.3, kind: "laufen", hint: "Tempo, bei dem du dich noch unterhalten kannst." },
  { id: "intervall-laufen", name: "Intervall-Laufen", group: "Cardio", type: "cardio", met: 7, kind: "laufen", hint: "Z. B. 1 Min. laufen, 2 Min. gehen – im Wechsel." },
  { id: "walking", name: "Gehen / Walking", group: "Cardio", type: "cardio", met: 3.5, kind: "gehen", hint: "Zügiges Gehen, Arme mitschwingen." },
  { id: "nordic-walking", name: "Nordic Walking", group: "Cardio", type: "cardio", met: 4.8, kind: "gehen", hint: "Stöcke diagonal zum Schritt einsetzen." },
  { id: "wandern", name: "Wandern", group: "Cardio", type: "cardio", met: 6, hint: "Mit Höhenmetern zählt es deutlich mehr." },
  { id: "radfahren", name: "Radfahren", group: "Cardio", type: "cardio", met: 6.8, kind: "rad", hint: "Gleichmäßiges Tempo, Trittfrequenz ca. 80–90." },
  { id: "ergometer", name: "Ergometer / Heimtrainer", group: "Cardio", type: "cardio", met: 6.8, distance: false, hint: "Mittlere Stufe, du solltest leicht außer Atem sein." },
  { id: "rudergeraet", name: "Rudergerät", group: "Cardio", type: "cardio", met: 7, hint: "Beine – Rücken – Arme, zurück in umgekehrter Reihenfolge." },
  { id: "crosstrainer", name: "Crosstrainer", group: "Cardio", type: "cardio", met: 5, distance: false, hint: "Aufrecht bleiben, Arme aktiv mitnehmen." },
  { id: "schwimmen", name: "Schwimmen", group: "Cardio", type: "cardio", met: 5.8, hint: "Gleichmäßige Bahnen, Distanz in km." },
  { id: "seilspringen", name: "Seilspringen", group: "Cardio", type: "cardio", met: 11, distance: false, hint: "Kleine Sprünge auf den Fußballen." },
  { id: "stepper", name: "Stepper / Treppensteigen", group: "Cardio", type: "cardio", met: 9, distance: false, hint: "Nicht auf den Griffen abstützen." },
];

// Trainingsplan-Vorlagen: Einheiten plus Vorschlag für den Wochenplan (0 = Sonntag … 6 = Samstag).
// Gewicht null = beim ersten Training selbst wählen.
const FITNESS_PLAN_VORLAGEN = [
  {
    id: "ppl",
    name: "Push / Pull / Beine",
    description: "Klassischer 3er-Split fürs Studio: Drücken, Ziehen, Beine – je einmal pro Woche.",
    workouts: [
      {
        key: "push", name: "Push", color: "blue",
        items: [
          { exerciseId: "bankdruecken", sets: 3, reps: 8, rest: 120 },
          { exerciseId: "schulterdruecken-kh", sets: 3, reps: 10, rest: 90 },
          { exerciseId: "schraegbank-kh", sets: 3, reps: 10, rest: 90 },
          { exerciseId: "seitheben", sets: 3, reps: 12, rest: 60 },
          { exerciseId: "trizeps-kabel", sets: 3, reps: 12, rest: 60 },
        ],
      },
      {
        key: "pull", name: "Pull", color: "purple",
        items: [
          { exerciseId: "latzug", sets: 3, reps: 10, rest: 90 },
          { exerciseId: "rudern-lh", sets: 3, reps: 8, rest: 120 },
          { exerciseId: "face-pulls", sets: 3, reps: 15, rest: 60 },
          { exerciseId: "bizepscurls", sets: 3, reps: 12, rest: 60 },
          { exerciseId: "hammercurls", sets: 3, reps: 12, rest: 60 },
        ],
      },
      {
        key: "beine", name: "Beine", color: "orange",
        items: [
          { exerciseId: "kniebeugen-lh", sets: 3, reps: 8, rest: 150 },
          { exerciseId: "rdl", sets: 3, reps: 10, rest: 120 },
          { exerciseId: "beinpresse", sets: 3, reps: 12, rest: 90 },
          { exerciseId: "beinbeuger", sets: 3, reps: 12, rest: 60 },
          { exerciseId: "wadenheben", sets: 3, reps: 15, rest: 60 },
          { exerciseId: "plank", sets: 3, reps: 45, rest: 45 },
        ],
      },
    ],
    week: { 1: ["push"], 3: ["pull"], 5: ["beine"] },
  },
  {
    id: "heim",
    name: "Heimtraining ohne Geräte",
    description: "Zwei Zirkel mit dem eigenen Körpergewicht, kurze Pausen – gut für den Kalorienverbrauch.",
    workouts: [
      {
        key: "zirkel-a", name: "Heim-Zirkel A", color: "green",
        items: [
          { exerciseId: "kniebeugen", sets: 3, reps: 15, rest: 45 },
          { exerciseId: "liegestuetze", sets: 3, reps: 10, rest: 45 },
          { exerciseId: "ausfallschritte", sets: 3, reps: 10, rest: 45 },
          { exerciseId: "glute-bridge", sets: 3, reps: 15, rest: 45 },
          { exerciseId: "plank", sets: 3, reps: 30, rest: 45 },
          { exerciseId: "mountain-climbers", sets: 3, reps: 20, rest: 45 },
        ],
      },
      {
        key: "zirkel-b", name: "Heim-Zirkel B", color: "pink",
        items: [
          { exerciseId: "burpees", sets: 3, reps: 8, rest: 45 },
          { exerciseId: "pike-liegestuetze", sets: 3, reps: 8, rest: 45 },
          { exerciseId: "bulgarian-split", sets: 3, reps: 8, rest: 45 },
          { exerciseId: "hampelmaenner", sets: 3, reps: 30, rest: 30 },
          { exerciseId: "seitstuetz", sets: 3, reps: 30, rest: 30 },
          { exerciseId: "crunches", sets: 3, reps: 15, rest: 30 },
        ],
      },
    ],
    week: { 2: ["zirkel-a"], 4: ["zirkel-b"], 6: ["zirkel-a"] },
  },
  {
    id: "lauf",
    name: "Cardio / Lauf-Einsteiger",
    description: "Vom Gehen zum Laufen: Intervalle, lockerer Dauerlauf und eine lange Walking-Runde.",
    workouts: [
      {
        key: "intervalle", name: "Lauf-Intervalle", color: "green",
        note: "5 Min. einlaufen (gehen), dann 8× 1 Min. laufen / 2 Min. gehen. Jede Woche die Laufphase etwas verlängern.",
        items: [{ exerciseId: "intervall-laufen", duration: 30, distance: 3.5 }],
      },
      {
        key: "dauerlauf", name: "Lockerer Dauerlauf", color: "blue",
        items: [{ exerciseId: "laufen", duration: 20, distance: 2.5 }],
      },
      {
        key: "walking", name: "Lange Walking-Runde", color: "orange",
        items: [{ exerciseId: "walking", duration: 45, distance: 4.5 }],
      },
    ],
    week: { 2: ["intervalle"], 4: ["dauerlauf"], 0: ["walking"] },
  },
];

// Lebensmittel mit Nährwerten pro 100 g (Richtwerte). portion = typische Menge in g.
const FITNESS_LEBENSMITTEL = [
  { id: "haferflocken", name: "Haferflocken", kcal: 372, protein: 13.5, carbs: 58.7, fat: 7, portion: { name: "Portion", g: 50 } },
  { id: "vollkornbrot", name: "Vollkornbrot", kcal: 216, protein: 7, carbs: 39, fat: 1.4, portion: { name: "Scheibe", g: 50 } },
  { id: "broetchen", name: "Brötchen (Weizen)", kcal: 270, protein: 9, carbs: 53, fat: 1.5, portion: { name: "Stück", g: 55 } },
  { id: "reis", name: "Reis, gekocht", kcal: 130, protein: 2.7, carbs: 28, fat: 0.3, portion: { name: "Portion", g: 200 } },
  { id: "nudeln", name: "Nudeln, gekocht", kcal: 158, protein: 5.8, carbs: 31, fat: 0.9, portion: { name: "Portion", g: 250 } },
  { id: "kartoffeln", name: "Kartoffeln, gekocht", kcal: 72, protein: 2, carbs: 15.5, fat: 0.1, portion: { name: "Portion", g: 250 } },
  { id: "haehnchenbrust", name: "Hähnchenbrust", kcal: 110, protein: 23.5, carbs: 0, fat: 1.5, portion: { name: "Filet", g: 150 } },
  { id: "rinderhack", name: "Rinderhackfleisch (mager)", kcal: 137, protein: 21, carbs: 0, fat: 5.5, portion: { name: "Portion", g: 125 } },
  { id: "lachs", name: "Lachs", kcal: 202, protein: 20, carbs: 0, fat: 13.6, portion: { name: "Filet", g: 125 } },
  { id: "thunfisch", name: "Thunfisch (Dose, Saft)", kcal: 110, protein: 25, carbs: 0, fat: 1, portion: { name: "Dose", g: 150 } },
  { id: "ei", name: "Hühnerei", kcal: 137, protein: 12, carbs: 1, fat: 9.5, portion: { name: "Stück", g: 58 } },
  { id: "magerquark", name: "Magerquark", kcal: 67, protein: 12, carbs: 4, fat: 0.3, portion: { name: "Becher", g: 250 } },
  { id: "skyr", name: "Skyr", kcal: 63, protein: 11, carbs: 4, fat: 0.2, portion: { name: "Becher", g: 150 } },
  { id: "joghurt", name: "Naturjoghurt 3,5 %", kcal: 64, protein: 3.5, carbs: 4.5, fat: 3.5, portion: { name: "Becher", g: 150 } },
  { id: "milch", name: "Milch 1,5 %", kcal: 47, protein: 3.4, carbs: 4.9, fat: 1.5, portion: { name: "Glas", g: 200 } },
  { id: "gouda", name: "Gouda", kcal: 364, protein: 25, carbs: 0, fat: 29, portion: { name: "Scheibe", g: 25 } },
  { id: "huettenkaese", name: "Hüttenkäse", kcal: 98, protein: 12.3, carbs: 2.7, fat: 4.3, portion: { name: "Becher", g: 200 } },
  { id: "tofu", name: "Tofu natur", kcal: 122, protein: 13, carbs: 1.5, fat: 7, portion: { name: "Portion", g: 150 } },
  { id: "linsen", name: "Linsen, gekocht", kcal: 116, protein: 9, carbs: 20, fat: 0.4, portion: { name: "Portion", g: 200 } },
  { id: "apfel", name: "Apfel", kcal: 52, protein: 0.3, carbs: 12, fat: 0.2, portion: { name: "Stück", g: 180 } },
  { id: "banane", name: "Banane", kcal: 93, protein: 1.2, carbs: 20, fat: 0.2, portion: { name: "Stück", g: 120 } },
  { id: "beeren", name: "Beeren (TK)", kcal: 45, protein: 1, carbs: 8, fat: 0.5, portion: { name: "Handvoll", g: 100 } },
  { id: "brokkoli", name: "Brokkoli", kcal: 35, protein: 3.8, carbs: 2.7, fat: 0.2, portion: { name: "Portion", g: 200 } },
  { id: "tomate", name: "Tomate", kcal: 18, protein: 0.9, carbs: 3, fat: 0.2, portion: { name: "Stück", g: 80 } },
  { id: "gurke", name: "Gurke", kcal: 12, protein: 0.6, carbs: 2, fat: 0.1, portion: { name: "Portion", g: 150 } },
  { id: "olivenoel", name: "Olivenöl", kcal: 884, protein: 0, carbs: 0, fat: 100, portion: { name: "EL", g: 10 } },
  { id: "butter", name: "Butter", kcal: 741, protein: 0.7, carbs: 0.6, fat: 83, portion: { name: "Portion", g: 10 } },
  { id: "erdnussbutter", name: "Erdnussbutter", kcal: 600, protein: 25, carbs: 14, fat: 50, portion: { name: "EL", g: 15 } },
  { id: "mandeln", name: "Mandeln", kcal: 589, protein: 24, carbs: 5.7, fat: 54, portion: { name: "Handvoll", g: 25 } },
  { id: "whey", name: "Whey-Proteinpulver", kcal: 380, protein: 78, carbs: 7, fat: 5, portion: { name: "Shake", g: 30 } },
  { id: "schokolade", name: "Zartbitterschokolade 70 %", kcal: 580, protein: 8, carbs: 34, fat: 43, portion: { name: "Riegel", g: 20 } },
  { id: "pizza", name: "Pizza Margherita (TK)", kcal: 235, protein: 9, carbs: 30, fat: 8, portion: { name: "Pizza", g: 350 } },
  { id: "cola", name: "Cola", kcal: 42, protein: 0, carbs: 10.6, fat: 0, portion: { name: "Glas", g: 330 } },
  { id: "bier", name: "Bier", kcal: 43, protein: 0.5, carbs: 3.6, fat: 0, portion: { name: "Flasche", g: 500 } },
];
