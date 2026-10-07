# Lokal ausgelieferte Fremddateien

Diese Dateien werden zusammen mit der Website ausgeliefert, damit der Browser
keine Schrift- oder Programmbibliotheken von fremden CDN-Domains laden muss.

| Komponente | Version | Lizenz | Verwendung |
|---|---:|---|---|
| Manrope | Google Fonts v20 | SIL Open Font License 1.1 | App-Schrift |
| Space Grotesk | Google Fonts v22 | SIL Open Font License 1.1 | Überschriften |
| Supabase JS | 2.117.2 | MIT | Anmeldung und Datenbankzugriff |
| Chart.js | 4.4.1 | MIT | MIS-Diagramme |
| SheetJS Community Edition | 0.18.5 | Apache-2.0 | Mitgliederimport aus Excel |
| jsPDF | 4.2.1 | MIT | Lokale MIS- und Finanz-PDFs |
| jsPDF-AutoTable | 5.0.8 | MIT | Paginierte Finanz-PDF-Tabellen |
| html2canvas | 1.4.1 | MIT | Bestehendes MIS-Layout in Druckauflösung |
| ExcelJS | 4.4.0 | MIT | Formatierte Monatslisten als XLSX |

Die vier Exportbibliotheken stammen aus den offiziellen npm-Paketen. Ihre
SHA-512-Paketpruefsummen wurden vor der lokalen Uebernahme gegen die
Registry-Metadaten verifiziert. Laden erst bei einem Export, keine CDN-Aufrufe.

Die jeweiligen Lizenztexte liegen im Unterordner der Komponente. Bei einem
Versionswechsel müssen Datei, Versionsangabe, Lizenz und Datenschutztest
gemeinsam aktualisiert werden.
