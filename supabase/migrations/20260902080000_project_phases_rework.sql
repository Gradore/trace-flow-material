-- =====================================================================
-- Projektstruktur ohne Patentphase.
--
-- Fachliche Vorgabe des Projektinhabers: es wird kein Patent angemeldet.
-- Der Schwerpunkt liegt auf
--   * Maschinentests, um den eigenen Maschinenpark auszuwählen, und
--   * der Beschaffung unterschiedlicher GFK-Typen (M1-M7) für die Versuche.
--
-- Diese Migration ersetzt daher die IP-Phase durch einen Prüfrahmen, baut die
-- Materialbeschaffung auf die einzelnen Materialklassen um, ergänzt fehlende
-- Maschinentests und macht aus der Auswertungsphase eine Maschinenpark-Phase.
-- Alle Schritte sind idempotent.
-- =====================================================================

-- ---------------------------------------------------------------- 1. Patent raus
-- Die Abhängigkeiten hängen an der Task-ID und verschwinden per ON DELETE CASCADE.
DELETE FROM public.project_tasks WHERE code IN ('P0-1', 'P0-2')
  AND title IN ('Patentrecherche Scher-/Walkverfahren', 'Patentanmeldung einreichen');

DROP FUNCTION IF EXISTS public.is_patent_filed();

-- ---------------------------------------------------------------- 2. Umnummerierung
-- Die Codes werden anhand des Titels vergeben, nicht anhand des alten Codes.
-- Dadurch ist der Schritt beliebig oft wiederholbar, auch wenn der Seed
-- zwischendurch erneut läuft.

-- 2a. Doppelte Seed-Aufgaben entfernen (entstehen, wenn der Seed nach der
--     Umnummerierung erneut läuft und einen frei gewordenen Code neu belegt).
DELETE FROM public.project_tasks t
USING public.project_tasks keep
WHERE t.title = keep.title
  AND t.id <> keep.id
  AND t.code ~ '^P[0-7]-'
  AND keep.code ~ '^P[0-7]-'
  AND (t.created_at, t.id) > (keep.created_at, keep.id);

-- 2b. Betroffene Aufgaben auf temporäre Codes parken, damit die Zielcodes frei sind.
UPDATE public.project_tasks
   SET code = 'TMP-' || left(replace(id::text, '-', ''), 12)
 WHERE title IN (
   'NDA-Template erstellen',
   'Versuchsprotokoll-Template entwickeln',
   'Externes Analytik-Labor auswählen',
   'Fraktions-Spezifikationsblätter definieren (F1–F5)',
   'Material-Maschinen-Matrix vervollständigen',
   'Anlagenspezifikation 32 t/Tag ableiten',
   'CAPEX-Modell aus Testdaten',
   'Förderantrag vorbereiten',
   'Investoren-/Kundenpräsentation aus Testdaten generieren'
 );

-- 2c. Zielcodes anhand des Titels setzen.
UPDATE public.project_tasks t SET code = v.code
FROM (VALUES
  ('NDA-Template erstellen','P0-1'),
  ('Versuchsprotokoll-Template entwickeln','P0-2'),
  ('Externes Analytik-Labor auswählen','P0-3'),
  ('Fraktions-Spezifikationsblätter definieren (F1–F5)','P0-4'),
  ('Material-Maschinen-Matrix vervollständigen','P7-1'),
  ('Anlagenspezifikation 32 t/Tag ableiten','P7-4'),
  ('CAPEX-Modell aus Testdaten','P7-5'),
  ('Förderantrag vorbereiten','P7-6'),
  ('Investoren-/Kundenpräsentation aus Testdaten generieren','P7-7')
) AS v(title, code)
WHERE t.title = v.title;

-- 2d. Beschreibungen an den neuen Zuschnitt anpassen.
UPDATE public.project_tasks SET
  description = 'Gegenseitige Geheimhaltung mit Technikums- und Laborpartnern, bevor Material und Verfahrensdetails herausgehen.'
 WHERE code = 'P0-1';

UPDATE public.project_tasks SET
  description = 'Einheitliche Dokumentation für alle Technikumsversuche — Grundlage für die Vergleichbarkeit der Maschinen.'
 WHERE code = 'P0-2';

-- ---------------------------------------------------------------- 3. Phasen umbenennen
UPDATE public.project_phases SET
  name = 'Vorbereitung & Prüfrahmen',
  description = 'NDA, Versuchsprotokoll, Analytiklabor und die Bewertungskriterien, nach denen der Maschinenpark ausgewählt wird.'
 WHERE code = 'P0';

UPDATE public.project_phases SET
  name = 'Materialbeschaffung GFK-Typen',
  description = 'Unterschiedliche GFK-Typen M1–M7 für die Versuchsreihen beschaffen und je Charge dokumentieren. Fixstart: Optiplan und Lamilux (M1).'
 WHERE code = 'P1';

UPDATE public.project_phases SET
  name = 'Maschinentests im Technikum',
  description = 'Herstellertechnika: Eignung je Materialtyp und Prozessstufe ermitteln. Fixstart: Siempelkamp Sizereduction.'
 WHERE code = 'P2';

UPDATE public.project_phases SET
  name = 'Maschinenpark & Anlagenspezifikation',
  description = 'Maschinenauswahl je Prozessstufe, Angebotsvergleich, Anlagenspezifikation, CAPEX und Förderung.'
 WHERE code = 'P7';

-- Geheimhaltung statt Schutzrechte in der Wissenschaftskooperation
UPDATE public.project_tasks SET
  title = 'Kooperationsvertrag + Geheimhaltungsregelung',
  description = 'Beide TUs. Regelung zur Verwertung der Ergebnisse und zur Geheimhaltung der Verfahrensparameter.'
 WHERE code = 'P6-1';

UPDATE public.project_tasks SET
  title = 'Verwertbare Berichte für Förderung und Anlagenplanung erstellen',
  description = 'Beide TUs. Die Berichte fließen in den Förderantrag und in die Auslegung des Maschinenparks ein.'
 WHERE code = 'P6-7';

-- P1-4 wird zur Planungsklammer über die einzelnen Materialklassen
UPDATE public.project_tasks SET
  title = 'Materialbedarf und Bezugsquellen je Materialklasse festlegen',
  description = 'Welche Menge je Materialklasse M1–M7 wird für die Versuchsreihen gebraucht, und von wem.'
 WHERE code = 'P1-4';

-- ---------------------------------------------------------------- 5. Neue Aufgaben
INSERT INTO public.project_tasks
  (code, phase_id, title, description, priority, estimated_duration_weeks, estimated_cost_eur, partner_id)
SELECT v.code, ph.id, v.title, v.description, v.priority, v.weeks, v.cost,
       (SELECT id FROM public.project_partners pp WHERE lower(pp.name) = lower(v.partner) LIMIT 1)
FROM (VALUES
 ('P0','P0-5','Bewertungskriterien Maschinenauswahl festlegen',
  'Gewichtung von Faserlänge, Durchsatz, spezifischem Energiebedarf, Werkzeugverschleiß und Investitionskosten. Ohne dieses Raster sind die Technikumsergebnisse nicht vergleichbar.',
  'high',1,0,NULL),

 ('P1','P1-6','M2 SMC/BMC Pressreste beschaffen',
  'Hoher Füllstoffanteil (CaCO₃) — dient zugleich als Verschleißtest für die Werkzeuge.','high',4,0,'Menzolit GmbH'),
 ('P1','P1-7','M3 Pultrudat-Profile beschaffen',
  'Gerichtete Endlosfaser, hartzäh — der Härtefall für niedrige Drehzahl.','high',4,0,'Fiberline Composites'),
 ('P1','P1-8','M4 Sandwich mit Schaumkern beschaffen',
  'Kernmaterial muss abgetrennt werden. Bezugsquelle noch festzulegen.','medium',4,0,NULL),
 ('P1','P1-9','M5 Epoxid-Spezialverbund beschaffen',
  'Thermisch stabil, bevorzugt für hochreine Compound-Anwendungen.','high',4,0,'Röchling Industrial'),
 ('P1','P1-10','M6 Boots-/Yachtlaminat beschaffen',
  'Gemischte Laminate mit Gelcoat.','medium',4,0,'Bavaria Yachtbau GmbH'),
 ('P1','P1-11','M7 GFK-Rohr / Tank beschaffen',
  'Dickwandig, Vorzerkleinerung nötig. Ausdrücklich kein sandhaltiges Material (kein Schleuderguss mit Sandkern).','medium',4,0,'Amiblu Germany GmbH'),

 ('P2','P2-10','Zahnwalzenmühle Moditec testen',
  'Goliath 25 U/min — langsamlaufend und für hochabrasive Faser relevant.','medium',4,5000,'Moditec (Mo.Di.Tec)'),
 ('P2','P2-11','Sondermaschinen-Option ZENO prüfen',
  'Sondermaschinenbau, flexibel bei Kleinserien — Option für eine angepasste Schermühle im eigenen Park.','medium',3,5000,'ZENO GmbH'),

 ('P7','P7-2','Maschinenauswahl je Prozessstufe festlegen',
  'Verbindliche Auswahl für den eigenen Maschinenpark: Vorzerkleinerung, Schermühle/Granulator, Sichtung, Siebung — je Stufe Fabrikat und Baugröße, begründet aus den Technikumsergebnissen.',
  'critical',3,0,NULL),
 ('P7','P7-3','Angebote der Hersteller einholen und vergleichen',
  'Angebote je ausgewählter Maschine inklusive Verschleißteilkosten, Lieferzeit und Inbetriebnahme.','high',4,0,NULL)
) AS v(phase_code, code, title, description, priority, weeks, cost, partner)
JOIN public.project_phases ph ON ph.code = v.phase_code
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------- 6. Partner zuordnen
-- Maschinen- und Materialtests hängen an konkreten Partnern; ohne Zuordnung
-- ist die Partnerseite eines Versuchs leer.
UPDATE public.project_tasks t SET partner_id = p.id
FROM (VALUES
  ('P2-5','WEIMA Maschinenbau GmbH'),
  ('P2-7','SKZ – Das Kunststoff-Zentrum'),
  ('P5-1','AKRO-PLASTIC GmbH'),
  ('P5-2','Lehmann&Voss & Co. KG'),
  ('P5-3','SKZ – Das Kunststoff-Zentrum'),
  ('P4-7','BWS Betonwerk Schwerin')
) AS v(task_code, partner_name)
JOIN public.project_partners p ON lower(p.name) = lower(v.partner_name)
WHERE t.code = v.task_code AND t.partner_id IS NULL;

-- ---------------------------------------------------------------- 7. Abhängigkeiten
INSERT INTO public.project_task_dependencies (task_id, depends_on_task_id)
SELECT t.id, d.id
FROM (VALUES
  -- Materialklassen hängen an der Bedarfsplanung
  ('P1-6','P1-4'), ('P1-7','P1-4'), ('P1-8','P1-4'), ('P1-9','P1-4'), ('P1-10','P1-4'), ('P1-11','P1-4'),
  -- Beschaffung setzt das NDA voraus
  ('P1-6','P0-1'), ('P1-7','P0-1'), ('P1-9','P0-1'), ('P1-10','P0-1'), ('P1-11','P0-1'),
  -- Vergleichstests bauen auf dem ersten Technikumstest auf
  ('P2-10','P2-2'), ('P2-11','P2-2'),
  -- Maschinentests brauchen den Bewertungsrahmen
  ('P2-2','P0-5'), ('P2-9','P0-5'),
  -- Maschinenpark-Entscheidung
  ('P7-2','P7-1'), ('P7-3','P7-2'), ('P7-4','P7-2')
) AS v(task_code, depends_on_code)
JOIN public.project_tasks t ON t.code = v.task_code
JOIN public.project_tasks d ON d.code = v.depends_on_code
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------- 8. Risiko anpassen
-- Das IP-Risiko trifft nicht mehr zu; an seine Stelle tritt das reale Risiko
-- der Maschinenauswahl.
DELETE FROM public.project_risks WHERE title = 'Herstellerdemo vor Patentanmeldung';

INSERT INTO public.project_risks (title, description, category, probability, impact, mitigation_plan, owner, phase_id)
SELECT v.title, v.description, v.category, v.probability, v.impact, v.mitigation, v.owner, ph.id
FROM (VALUES
 ('Verfahrens-Know-how ohne NDA offengelegt',
  'Verfahrensparameter gehen im Technikum an einen Hersteller, bevor eine Geheimhaltungsvereinbarung unterschrieben ist.',
  'ip',3,4,'P0-1 (NDA-Template) vor dem ersten Herstellerkontakt abschließen; Versuchsprotokolle nur nach unterschriebenem NDA herausgeben.','manuel.buckow','P0'),
 ('Maschinenauswahl auf zu schmaler Datenbasis',
  'Der Maschinenpark wird festgelegt, obwohl nicht alle Materialklassen M1–M7 getestet wurden — im Betrieb zeigt sich dann eine Materialklasse als nicht verarbeitbar.',
  'technical',3,5,'Material-Maschinen-Matrix (P7-1) vor der Auswahl vollständig füllen; je Materialklasse mindestens einen dokumentierten Lauf fordern.','manuel.buckow','P7')
) AS v(title, description, category, probability, impact, mitigation, owner, phase_code)
LEFT JOIN public.project_phases ph ON ph.code = v.phase_code
WHERE NOT EXISTS (SELECT 1 FROM public.project_risks r WHERE r.title = v.title);
