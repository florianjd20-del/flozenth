# FLOZENTH Shop

Shop mit Anmeldung, Bestandsverwaltung (inkl. "Ausverkauft") und Foto-Upload.
Braucht nur Node.js ab Version 18, keine weiteren Pakete.

## Lokal ausprobieren
    ADMIN_PASSWORD="dein-langes-passwort" node server.js
Dann http://localhost:3000 öffnen. Anmelden: unten auf der Seite "Anmelden" oder direkt /admin.

## Einstellungen (Umgebungsvariablen)
- ADMIN_PASSWORD  Pflicht, mindestens 8 Zeichen. Wähle ein langes, einzigartiges Passwort.
- DATA_DIR        Ordner für Artikel und Fotos (Standard: ./data). Muss auf dem Server dauerhaft gespeichert werden.
- PORT            Standard 3000 (Hosting-Anbieter setzen ihn meist selbst).

## Anfragen direkt per E-Mail senden (optional)
Ohne diese Einstellungen zeigt der Shop den Kunden einen Text zum Kopieren.
Mit ihnen geht die Anfrage direkt als E-Mail an dich. Genutzt wird der Dienst Resend (resend.com).
- RESEND_API_KEY  Dein API-Schlüssel von resend.com (Pflicht für den Versand)
- MAIL_TO         E-Mail-Adresse, an die die Anfragen gehen. Ohne diese Variable gilt die E-Mail aus der Verwaltung (Shop-Angaben).
- MAIL_FROM       Absender, z. B. FLOZENTH <anfragen@deine-domain.de>. Ohne Angabe wird onboarding@resend.dev genutzt.
Hinweis: Mit dem Standard-Absender onboarding@resend.dev kann Resend nach meinem Kenntnisstand nur an die E-Mail-Adresse
deines Resend-Kontos senden. Prüfe das und die aktuellen Bedingungen bei Resend. Für andere Empfänger braucht man eine bestätigte eigene Domain.
Die Antwort-Adresse der Mail ist die des Kunden, du kannst also direkt antworten.

## Online stellen
Du brauchst einen Anbieter, der Node.js-Programme betreibt UND einen dauerhaften Speicher (Volume/Disk) anbietet.
Ohne dauerhaften Speicher gehen Artikel und Fotos bei jedem Neustart verloren.
- Start-Befehl: node server.js
- ADMIN_PASSWORD als Umgebungsvariable setzen
- Dauerhaften Speicher einhängen und DATA_DIR auf dessen Pfad setzen (z. B. /data)
Geeignet sind z. B. Render (bezahlter Dienst mit Disk), Railway (Volume), Fly.io (Volume) oder ein kleiner eigener Server (VPS).
HTTPS und eine eigene Domain (z. B. flozenth.de) richtest du beim Anbieter ein.

## Sicherung
Der Ordner DATA_DIR enthält alles (products.json, shop.json, uploads/). Kopiere ihn regelmäßig.
