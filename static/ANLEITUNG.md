# FLOZENTH mit Firebase: Einrichtung

Solange `firebase-config.js` noch DEIN_... enthält, läuft alles im Demo-Modus (Beispielartikel, nur in deinem Browser, Passwort der Verwaltung: demo).

## 1. Firebase-Projekt anlegen
1. Öffne https://console.firebase.google.com und melde dich mit einem Google-Konto an.
2. "Projekt erstellen", Name z. B. flozenth. Google Analytics kannst du ausschalten.

## 2. Datenbank
1. Links "Build" (Erstellen) > "Firestore Database" > "Datenbank erstellen".
2. Standort in Europa wählen (z. B. eur3 oder europe-west3). Im Produktionsmodus starten.

## 3. Anmeldung
1. "Build" > "Authentication" > "Los geht's".
2. Anmeldemethode "E-Mail/Passwort" aktivieren (nicht "E-Mail-Link"), speichern.
3. Reiter "Nutzer" > "Nutzer hinzufügen": deine E-Mail und ein langes Passwort. Das ist dein Login für admin.html.
4. Kopiere danach die "Nutzer-UID" dieses Nutzers (lange Zeichenfolge in der Liste).

## 4. Regeln (wichtig für die Sicherheit)
Firestore > Reiter "Regeln". Ersetze alles durch den folgenden Text, setze statt DEINE_UID die kopierte UID ein und klicke auf "Veröffentlichen":

    rules_version = '2';
    service cloud.firestore {
      match /databases/{database}/documents {
        match /products/{id} {
          allow read: if true;
          allow write: if request.auth != null && request.auth.uid == "DEINE_UID";
        }
        match /settings/{id} {
          allow read: if true;
          allow write: if request.auth != null && request.auth.uid == "DEINE_UID";
        }
      }
    }

Jeder darf die Artikel lesen (der Shop ist öffentlich). Schreiben darf nur dein Konto.

## 5. Zugangsdaten in den Shop eintragen
1. Projekteinstellungen (Zahnrad oben links) > "Allgemein" > ganz unten "Meine Apps" > Web-Symbol </> > App registrieren (Name egal, Hosting nicht einrichten).
2. Du siehst ein Feld firebaseConfig. Kopiere apiKey, authDomain und projectId.
3. Trage sie in die Datei firebase-config.js ein und lade den Ordner bei Netlify neu hoch (oder ändere die Datei auf GitHub, wenn Netlify mit GitHub verbunden ist).
Der apiKey ist kein Geheimnis. Geschützt wird deine Datenbank durch die Regeln aus Schritt 4.

## 6. Benutzen
- Shop: deine Netlify-Adresse
- Verwaltung: deine Netlify-Adresse + /admin.html (Login aus Schritt 3)
Artikel, Fotos, Preise und Bestand ändern sich sofort, es muss nichts mehr hochgeladen werden.

## Hinweise
- Anfragen: Der Shop sendet sie über Netlify Forms. Dort unter "Forms" die E-Mail-Benachrichtigung einrichten.
- Fotos werden verkleinert (max. 800 px) und in der Datenbank gespeichert. Bei sehr vielen Artikeln lohnt später ein eigener Bilderspeicher.
- Der kostenlose Firebase-Tarif hat Tageslimits für Lesezugriffe. Bei kleinem Shop reicht das, prüfe die aktuellen Grenzen in der Firebase-Konsole.
- Falls die Anmeldung wegen der Domain scheitert: Authentication > Einstellungen > Autorisierte Domains > deine Netlify-Adresse hinzufügen.
