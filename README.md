# Padel Bielstein – Buchungssoftware

Buchungssystem für die 2 Padel-Courts der Tennisfreunde Bielstein e.V.
Live: **https://padel-bielstein.de**

## Stack

| Komponente | Details |
|---|---|
| Frontend | Eine einzige `index.html` – Vanilla HTML/CSS/JS, kein Build-Schritt |
| Hosting | GitHub Pages (dieses Repo), Custom Domain über `CNAME` |
| Datenbank | Supabase Postgres – Projekt `padel-bielstein-prod`, Organisation "Padel Bielstein" |
| Zahlung | Stripe Checkout |
| Bilder | `Header Padel Bielstein.png` / `Header Padel Original.png`, direkt aus diesem Repo geladen |

## Deployment

Jeder Push auf `main` aktualisiert automatisch die Live-Seite (GitHub Pages baut direkt aus diesem Branch).
Kein separater Build- oder Deploy-Schritt nötig.

## Datenmodell (Supabase, Schema `public`)

- `bookings` – Buchungen (Court, Datum, Uhrzeit, Status, Kunde)
- `payments`, `subscriptions` – Stripe-Zahlungen bzw. Abos
- `prices` – Preistabelle nach Wochentag/Uhrzeit
- `app_config` – Konfigurationswerte (u. a. `member_discount`)
- `admins` – Admin-Rollen (Zutritt zum Admin-Bereich)
- `users` – registrierte Bucher-Accounts
- `door_events` – Zutrittssteuerung
- `freibad_closures`, `freibad_config`, `freibad_exceptions` – Öffnungszeiten/Ausnahmen im Rahmen der Kooperation mit dem benachbarten Freibad Bielstein (Dauerkarteninhaber erhalten ebenfalls Mitgliedskonditionen)

Zugangsdaten (DB-Passwort, API-Keys) liegen ausschließlich in Supabase/im Passwort-Manager der Verantwortlichen – nicht in diesem Repo.

## Bekannte offene Punkte

- Stripe-Webhooks / Pending→Active-Buchungsflow
- Row-Level-Security-Policies vervollständigen
- Admin-Rollenmodell (aktuell nur `admins`-Tabelle angelegt, Flow noch nicht fertig)
- Schutz gegen Doppelbuchungen auf DB-Ebene
- Mitgliederverwaltung: Login/Accounts für TFB-Mitglieder und externe Bucher (in Arbeit)
- Vollständiger Testplan vor nächstem Feature-Push

## Verantwortlich

Entwicklung & Pflege: Jörn Kämper (Tennisfreunde Bielstein e.V.)
