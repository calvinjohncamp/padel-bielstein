# Padel Bielstein – Buchungssoftware

Buchungssystem für die 2 Padel-Courts der Tennisfreunde Bielstein e.V.
Live: **https://padel-bielstein.de** · Anlage geht Anfang 2027 in Betrieb.

## Stack

| Komponente | Details |
|---|---|
| Frontend | Eine einzige `index.html` – Vanilla HTML/CSS/JS, kein Build-Schritt |
| Hosting | GitHub Pages (dieses Repo), Custom Domain über `CNAME` |
| Datenbank | Supabase Postgres – Projekt `padel-bielstein-prod` |
| Zahlung | Stripe Checkout |
| E-Mail | Resend über Supabase Edge Function |

## Deployment

Jeder Push auf `main` aktualisiert automatisch die Live-Seite.
Kein separater Build- oder Deploy-Schritt.

> **`CNAME` niemals löschen.** Die Datei bindet die Domain padel-bielstein.de
> an GitHub Pages. Ohne sie ist die Seite nur noch unter der github.io-Adresse
> erreichbar.

## Sicherheitsgrundsätze

Diese Regeln sind in Datenbank und Edge Functions durchgesetzt – nicht nur
im Frontend:

- **Preise und Rabatte werden ausschließlich serverseitig berechnet.**
  Werte aus dem Browser (`price_cents`, `customer_type`) werden ignoriert.
- **Mitgliedschaft wird nicht behauptet, sondern hergeleitet.** Der Server
  vergleicht die *bestätigte* E-Mail-Adresse mit der offiziellen Vereinsliste.
  Es gibt kein Eingabefeld und kein speicherbares Häkchen.
- **Guthaben ist ein Kontobuch** (`credit_ledger`). Der Saldo ist die Summe
  aller Bewegungen, nicht ein änderbares Feld. Schreiben nur serverseitig.
- **Buchungen und Abos entstehen nur über Edge Functions.** Das Frontend hat
  keine Schreibrechte auf `bookings` und `subscriptions`.
- **Doppelbuchungen** verhindert ein EXCLUDE-Constraint in der Datenbank,
  nicht eine Prüfung im Browser.

## Nicht in diesem Repo

Datenbank-Skripte, Edge-Function-Quellcode, Design-Referenzen und die
Projektdokumentation liegen bewusst außerhalb – sie gehören nicht auf eine
öffentliche Website.

## Verantwortlich

Entwicklung & Pflege: Jörn Kämper (Tennisfreunde Bielstein e.V.)
