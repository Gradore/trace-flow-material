# RekuFLOW — Betriebshandbuch

Kurzdokumentation der Dinge, die nach dem Einspielen dieses Stands **einmalig
von Hand** erledigt werden müssen, und der Konventionen, die dabei entstanden sind.

---

## 1. Selbstregistrierung endgültig schließen

Im Code ist die Selbstregistrierung vollständig entfernt:

| Ebene | Maßnahme |
|---|---|
| UI | `/auth` zeigt nur noch die Anmeldung, kein Registrieren-Tab |
| Client | `signUp` wurde aus dem `AuthContext` entfernt |
| RLS | `profiles` und `user_roles` nehmen `INSERT` nur noch von Administratoren an |
| Trigger | `guard_profile_insert()` weist jedes Profil ab, das kein Admin anlegt |
| RLS | `pending_registrations` nimmt keine neuen Zeilen mehr an |

**Noch von Hand zu erledigen:** Der Endpunkt `/auth/v1/signup` von Supabase ist
davon unabhängig und muss im Dashboard geschlossen werden:

> Supabase Dashboard → **Authentication** → **Sign In / Providers** →
> **Allow new users to sign up** ausschalten.

Ohne diesen Schritt kann zwar niemand mehr ein nutzbares Konto bekommen (ohne
Profil und Rolle sieht ein Konto nichts), es entstehen aber weiterhin leere
Auth-Einträge.

### Benutzer anlegen

Ausschließlich über **Verwaltung → Benutzer → „Neuen Benutzer anlegen"**.
Der Dialog ruft die Edge Function `admin-create-user` auf, die mit dem
Service-Role-Key arbeitet. Vorher legte der Dialog den Benutzer per
`supabase.auth.signUp()` im Browser an — dabei übernahm die Sitzung des
Administrators die Identität des neu angelegten Benutzers.

* Benutzername ist Pflicht und dient der Anmeldung.
* E-Mail ist optional. Ohne E-Mail bekommt das Konto intern die Adresse
  `<benutzername>@rekuflow.internal`; die Anmeldung per Benutzername
  funktioniert trotzdem.
* Für die externen Rollen **Kunde, Lieferant, Logistiker** ist eine
  Firmenzuordnung Pflicht — ohne sie sieht das Konto in seinem Portal nichts.
* Rollen werden über `set_user_role()` geändert. Die eigene Rolle kann niemand
  ändern, und es gibt genau eine Rolle je Benutzer (`UNIQUE (user_id)`).

---

## 2. Secrets für die KI-Auswertungen

Die Edge Function `project-ai` erledigt alle KI-Auswertungen des Projektmoduls
serverseitig. Im Client existiert kein API-Key.

| Secret | Zweck |
|---|---|
| `ANTHROPIC_API_KEY` | bevorzugt, nutzt `claude-sonnet-4-6` direkt |
| `LOVABLE_API_KEY` | Fallback über das Lovable-AI-Gateway (bereits gesetzt) |
| `APP_ORIGIN` | Basis-URL der App, für Links in Benachrichtigungs-Mails |

Setzen unter *Supabase Dashboard → Edge Functions → Secrets*. Ist
`ANTHROPIC_API_KEY` gesetzt, wird es verwendet, sonst das Gateway.

---

## 3. KI-Auswertungen zeitgesteuert

Das Projekt-Cockpit fordert das Tages-Briefing beim ersten Aufruf des Tages
automatisch an, sofern für den laufenden Tag noch keines gespeichert ist —
höchstens ein Modellaufruf pro Tag. Damit die Auswertungen unabhängig davon
laufen (und die übrigen Typen wie Wochenbericht, Risiko-Scan und
Partner-Nachfassen überhaupt), richtet man die Zeitpläne einmalig ein.

Im SQL-Editor, mit den echten Werten:

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select public.schedule_project_ai(
  'https://<PROJECT_REF>.supabase.co',
  '<SERVICE_ROLE_KEY>');
```

Das legt fünf Jobs an (Zeiten in UTC, 05:00 UTC = 06:00 MEZ):

| Job | Zeitplan | Auswertung |
|---|---|---|
| `rekuflow-daily-briefing` | täglich 05:00 | Tages-Briefing |
| `rekuflow-next-actions` | täglich 05:05 | Nächste Aktionen |
| `rekuflow-weekly-report` | montags 06:00 | Wochenbericht |
| `rekuflow-partner-followup` | montags 06:10 | Partner-Nachfassen |
| `rekuflow-risk-scan` | montags 06:20 | Risiko-Scan |

Der Aufruf ist wiederholbar — ein erneuter Aufruf ersetzt die Jobs. Entfernen:

```sql
select public.unschedule_project_ai();
```

Der Service-Role-Key steht bewusst in keiner Migration. `schedule_project_ai`
darf nur ein Administrator ausführen. `project-ai` verlangt einen Aufrufer mit
interner Rolle; der Service-Role-Key erfüllt das.

## 4. Rollen und Sichtbarkeiten

Die Navigation ist die **einzige Quelle** für Rollenrechte:
`src/components/layout/navigation.ts`. Aus ihr leiten sich ab

* die Seitenleiste (Desktop und Mobil, dieselbe Definition),
* der Routen-Guard `RoleRoute` über `accessRuleForPath()`,
* rollenabhängige Kopfzeilen-Bedienelemente über `hasAccess()`.

Ein Menüeintrag und seine Route können dadurch nicht mehr auseinanderlaufen.
Wer eine neue Seite ergänzt, trägt sie in `NAV_GROUPS` ein (oder, wenn sie kein
Menü haben soll, in `EXTRA_ROUTE_ACCESS`) und registriert die Route in
`src/App.tsx`.

Gruppen der Seitenleiste, jede mit eigener Farbe und eigenem Symbol:

| Gruppe | Farbe | Inhalt |
|---|---|---|
| Übersicht | Türkis | Dashboard, Reporting |
| GFK-Projekt | Violett | das komplette Projektmodul |
| Betrieb | Grün | Materialeingang bis Wartung |
| Vertrieb & Logistik | Blau | Aufträge, Firmen, Lieferscheine, Logistik |
| Dokumente & Rückverfolgung | Bernstein | Dokumente, Etiketten, Rückverfolgung, Archiv |
| KI-Werkzeuge | Magenta | Rezepturen, Vertriebssuche |
| Portale | Cyan | Kunden- und Lieferantenportal |
| Verwaltung | Rot | Benutzer, Audit-Log, Einstellungen, API-Docs |
| Konto | Grau | Profil |

---

## 5. Das GFK-Projektmodul

Setzt den Projektplan „trace-flow-material — GFK-Recycling Planungs- und
Testphase" um. Fachliche Kennwerte (Fraktionen F1–F5, Materialklassen M1–M7,
Prozesslinien A/B, Go-/No-Go-Schwellen, Wirtschaftsrahmen) liegen zentral in
`src/lib/project/constants.ts` und dürfen nicht verändert werden — sie stammen
aus realer Verfahrensentwicklung.

### Verzahnung mit dem operativen Teil

Der Projektplan ist kein Silo. Diese Brücken legen Daten wechselseitig an
(`src/lib/project/bridges.ts`):

| Projektobjekt | Aktion | Operatives Objekt |
|---|---|---|
| Projektpartner | „Als Firma anlegen / verknüpfen" | `companies` |
| Materialcharge | „In Wareneingang übernehmen" | `material_inputs` |
| Zielfraktion | „In Lagerbestand buchen" | `output_materials` |
| Analytik | „Probe + Ergebnisse übernehmen" | `samples` + `sample_results` |
| Dokumente | generischer Link `linked_to_type` / `linked_to_id` | `documents` |
| KI-Auswertung | erzeugt eine Benachrichtigung | `notifications` |

### Phasen und Reihenfolge

Es wird **kein Patent angemeldet** — die frühere IP-Sperre ist entfernt. Die
Reihenfolge wird ausschließlich über Aufgaben-Abhängigkeiten erzwungen: eine
Aufgabe lässt sich nicht auf `in Arbeit` setzen, solange ein Vorgänger offen
ist; ein bewusstes Übersteuern ist möglich, aber immer ein expliziter Klick.

| Phase | Inhalt |
|---|---|
| P0 | Vorbereitung & Prüfrahmen — NDA, Versuchsprotokoll, Labor, Bewertungskriterien für die Maschinenauswahl |
| P1 | Materialbeschaffung GFK-Typen — je Materialklasse M1–M7 eine eigene Aufgabe mit Lieferant |
| P2 | Maschinentests im Technikum — je Hersteller eine Aufgabe mit Partner |
| P3 | Fraktionsherstellung |
| P4 | Produktvalidierung Baustoff |
| P5 | Produktvalidierung Kunststoff |
| P6 | Wissenschaftliche Begleitung |
| P7 | Maschinenpark & Anlagenspezifikation — Auswahl je Prozessstufe, Angebotsvergleich, CAPEX, Förderung |

Das Verfahrens-Know-how ist weiterhin schützenswert, aber über das **NDA
(P0-1)** statt über eine Anmeldung: die Materialanfragen hängen als Nachfolger
an dieser Aufgabe, und das Risikoregister führt „Verfahrens-Know-how ohne NDA
offengelegt" als eigenen Eintrag.

### Spec-Konformität

`fraction_analysis_results` wird von einem Datenbank-Trigger gegen
`fraction_specs` geprüft; `spec_min`, `spec_max` und `pass_fail` werden dort
gesetzt und dürfen vom Client **nicht** geschrieben werden. Dasselbe gilt für
`output_fractions.yield_pct`, `product_test_results.delta_pct` und
`project_risks.severity`.

---

## 6. Was bei der Prüfung der Anwendung behoben wurde

Kurzfassung der wichtigsten Klassen (Details im Commit-Verlauf):

* **Rechte:** Routen hatten keine Rollenprüfung — jeder angemeldete Benutzer
  konnte jede Seite per URL öffnen. Jetzt greift `RoleRoute` überall.
* **RLS:** Mehrere Tabellen waren mit `USING (true)` für jeden angemeldeten
  Benutzer lesbar, `orders` und `batch_allocations` sogar für `anon`.
* **Edge Functions:** `search-manufacturers` gab ohne jede Authentifizierung
  das komplette Firmen- und Kontaktverzeichnis heraus; drei KI-Funktionen waren
  ein offener LLM-Proxy; `send-notification-email` war ein offenes Mailrelay.
* **Stille Fehlschläge:** Zahlreiche Aktionen meldeten Erfolg, obwohl RLS die
  Zeile herausgefiltert hatte. Schreibende Aktionen prüfen jetzt das
  Ergebnis mit `.select()`.
* **Tote Bedienelemente:** Filter-Buttons, Dropdown-Einträge und Karten ohne
  Handler wurden implementiert oder entfernt.
* **Referenzen:** Löschvorgänge scheiterten an Historieneinträgen ohne
  `ON DELETE`; Uploads scheiterten an einem Fremdschlüssel auf `profiles.id`.
* **Audit-Log:** `log_audit()` war mehrdeutig überladen und schlug immer fehl,
  die Tabelle blieb leer. Jetzt schreiben Datenbank-Trigger den Verlauf.
