// Einstellungen für den Google-Drive-Sync.
// clientId: OAuth-Client-ID aus der Google Cloud Console (Typ „Webanwendung“).
// Sie ist kein Geheimnis. Ein Clientschlüssel („Client Secret“) wird NICHT gebraucht
// und darf hier nie eingetragen werden.
window.SYNC_CONFIG = {
  clientId: "968019824962-7lnvfnmvuqdr689c68i48s6blj5uq396.apps.googleusercontent.com",
  // Diese localStorage-Einträge werden synchronisiert (je eine Datei im versteckten App-Ordner).
  keys: [
    "mein-kalender-events",
    "mein-kalender-vorlagen",
    "meine-todos",
    "meine-todos-vorlagen",
    "mein-fitness",
  ],
};
