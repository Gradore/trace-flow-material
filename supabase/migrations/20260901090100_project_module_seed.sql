-- =====================================================================
-- Seed data for the GFK recycling project module.
-- Idempotent: safe to run repeatedly.
-- Domain values come from the project specification and must not be altered.
-- =====================================================================

-- ---------------------------------------------------------------- F1-F5
INSERT INTO public.fraction_specs
  (id, name, fiber_length_min_mm, fiber_length_max_mm, glass_content_min_pct,
   moisture_max_pct, fines_max_pct, application, target_price_eur_t, process_line) VALUES
  ('F1','Makrofaser lang',      8,   15, 80, 0.5,   5, 'Beton-/GRC-Bewehrung, Asphalt', 800, 'A_baustoff'),
  ('F2','Polymerbeton',         4,   10, 80, 0.5,   5, 'Polymerbeton',                 1100, 'A_baustoff'),
  ('F3','Mörtel / Zement',      3,    8, 75, 0.5,   8, 'Mörtel, zementäre Matrix',      800, 'A_baustoff'),
  ('F4','Compound kurz',        1,    3, 75, 0.2,  10, 'PP-GF / PA6-GF Compounding',    900, 'B_compound'),
  ('F5','Feinanteil / Füller',  0,  0.5,  0, 1.0, 100, 'Füllstoff, Zementzuschlag',     300, 'A_baustoff')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  fiber_length_min_mm = EXCLUDED.fiber_length_min_mm,
  fiber_length_max_mm = EXCLUDED.fiber_length_max_mm,
  glass_content_min_pct = EXCLUDED.glass_content_min_pct,
  moisture_max_pct = EXCLUDED.moisture_max_pct,
  fines_max_pct = EXCLUDED.fines_max_pct,
  application = EXCLUDED.application,
  target_price_eur_t = EXCLUDED.target_price_eur_t,
  process_line = EXCLUDED.process_line;

-- ---------------------------------------------------------------- Partners
INSERT INTO public.project_partners
  (name, category, subcategory, street, postal_code, city, country, phone, email,
   status, suitability_rating, is_fixed_partner, material_classes, fraction_ids, notes) VALUES
-- 4.2 machine manufacturers
 ('Siempelkamp Sizereduction (ex-Pallmann)','machine_manufacturer','shear_mill','Wolfslochstr. 51','66482','Zweibrücken','DE','+49 6332 802-0',NULL,'prospect',5,true,'{M1,M2,M3,M4,M5,M6,M7}','{F1,F2,F3,F4,F5}','Größtes Zerkleinerungs-Technikum, 900+ Maschinentypen. Sondermaschinen möglich. Zentrale +49 6332 802-0'),
 ('Vecoplan AG','machine_manufacturer','shear_mill','Vor der Bitz 10','56470','Bad Marienberg','DE','+49 2661 62670',NULL,'prospect',5,false,'{M1,M2,M3,M7}','{F1,F2,F3}','Testcenter mit bis zu 100 Konfigurationen. VAZ druckschneidend, 60–130 U/min. Wasserkühlung Schneidraum optional.'),
 ('Herbold Meckesheim GmbH','machine_manufacturer','shear_mill','Industriestr. 33','74909','Meckesheim','DE','+49 6226 932-149','herbold@herbold.com','prospect',4,false,'{M1,M2,M3}','{F1,F3,F4}','SMS Doppelschrägschnitt, verschleißarm. Komplette Kette im Technikum.'),
 ('WEIMA Maschinenbau GmbH','machine_manufacturer','pre_shredder','Bustadt 6–10','74360','Ilsfeld','DE','+49 7062 9570-0','info@weima.com','prospect',3,false,'{M3,M6,M7}','{}','WLK Einwellen druckschneidend, Schneidplatten.'),
 ('Lindner Recyclingtech GmbH','machine_manufacturer','pre_shredder','Lindenstr. 6','99819','Krauthausen','DE','+49 36920 7269620','office@lindner.com','prospect',3,false,'{M6,M7}','{}','Atlas/Micromat. AT +43 4762 2742-0'),
 ('UNTHA Shredding Technology','machine_manufacturer','pre_shredder','Kellau 141','5431','Kuchl','AT','+43 6244 7016-0',NULL,'prospect',3,false,'{M6,M7}','{}','XR-Serie langsamlaufend.'),
 ('ZENO GmbH','machine_manufacturer','shear_mill','Grüninger Weg 28','35415','Pohlheim','DE','+49 6403 90090',NULL,'prospect',4,false,'{M1,M2,M5}','{F1,F2,F3}','Sondermaschinenbau, flexibel bei Kleinserien.'),
 ('BHS-Sonthofen GmbH','machine_manufacturer','impact_benchmark','An der Eisenschmelze 47','87527','Sonthofen','DE','+49 8321 6099-0',NULL,'prospect',1,false,'{M1}','{F5}','Rotorprallmühle RPMV — NUR als Gegentest/Benchmark, gegenteiliges Prinzip.'),
 ('Getecha GmbH','machine_manufacturer','granulator','Am Gemeindegraben 13','63741','Aschaffenburg','DE','+49 6021 8400-0','mail@getecha.de','prospect',2,false,'{M1,M5}','{F4}','Kunststoff-Schneidmühlen, kleinere Chargen.'),
 ('Moditec (Mo.Di.Tec)','machine_manufacturer','tooth_roller',NULL,NULL,NULL,'FR',NULL,NULL,'prospect',4,false,'{M2,M3}','{F1,F3}','Goliath Zahnwalzenmühle 25 U/min — für hochabrasive Faser relevant.'),
-- 4.3 classification & screening
 ('Hosokawa Alpine AG','machine_manufacturer','classification','Peter-Dörfler-Str. 13–25','86199','Augsburg','DE',NULL,NULL,'prospect',5,false,'{}','{F1,F4,F5}',NULL),
 ('Westeria GmbH','machine_manufacturer','classification',NULL,NULL,'Ostbevern','DE',NULL,NULL,'prospect',4,false,'{}','{F1,F5}',NULL),
 ('Trennso-Technik GmbH','machine_manufacturer','classification',NULL,NULL,'Weißenhorn','DE',NULL,NULL,'prospect',4,false,'{}','{F1,F5}',NULL),
 ('Spaleck GmbH & Co. KG','machine_manufacturer','screening',NULL,NULL,'Bocholt','DE',NULL,NULL,'prospect',4,false,'{}','{F1,F2,F3}',NULL),
 ('RHEWUM GmbH','machine_manufacturer','screening','Rosentalstr. 24','42899','Remscheid','DE',NULL,NULL,'prospect',4,false,'{}','{F3,F4,F5}',NULL),
 ('JÖST GmbH + Co. KG','machine_manufacturer','screening',NULL,NULL,'Dülmen','DE',NULL,NULL,'prospect',4,false,'{}','{F1,F3}',NULL),
 ('Hamos GmbH','machine_manufacturer','electrostatic_separation',NULL,NULL,'Penzberg','DE',NULL,NULL,'prospect',3,false,'{}','{F4}',NULL),
 ('Allgaier Process Technology','machine_manufacturer','screening','Ulmer Str. 75','73066','Uhingen','DE',NULL,NULL,'prospect',4,false,'{}','{F3,F5}',NULL),
-- 4.4 material suppliers
 ('Optiplan','material_supplier',NULL,NULL,NULL,NULL,'DE',NULL,NULL,'prospect',5,true,'{M1}','{}','Startmaterial. Vollständiger Firmenname, Standort und Ansprechpartner noch zu verifizieren.'),
 ('Lamilux Heinrich Strunz GmbH','material_supplier',NULL,NULL,NULL,'Rehau','DE',NULL,NULL,'prospect',5,true,'{M1}','{}','Startmaterial.'),
 ('Fiberline Composites','material_supplier',NULL,NULL,NULL,'Lohne','DE',NULL,NULL,'prospect',4,false,'{M3}','{}','DE-Vertrieb.'),
 ('Werzalit GmbH + Co. KG','material_supplier',NULL,NULL,NULL,'Oberstenfeld','DE',NULL,NULL,'prospect',3,false,'{M1,M3}','{}',NULL),
 ('Röchling Industrial','material_supplier',NULL,NULL,NULL,'Haren','DE',NULL,NULL,'prospect',4,false,'{M1,M5}','{}',NULL),
 ('BÜFA Composite Systems','material_supplier',NULL,NULL,NULL,'Rastede','DE',NULL,NULL,'prospect',4,false,'{M2}','{}',NULL),
 ('Menzolit GmbH','material_supplier',NULL,'Industriestr. 35','75015','Bretten','DE',NULL,NULL,'prospect',5,false,'{M2}','{}',NULL),
 ('Polytec Composites Germany','material_supplier',NULL,NULL,'97469','Gochsheim','DE',NULL,NULL,'prospect',4,false,'{M2}','{}',NULL),
 ('Amiblu Germany GmbH','material_supplier',NULL,'Am Fuchsloch 19','04720','Mochau','DE',NULL,NULL,'prospect',5,false,'{M7}','{}','Kein Sandkern-Material annehmen.'),
 ('Bavaria Yachtbau GmbH','material_supplier',NULL,'Bavariastr. 1','97232','Giebelstadt','DE',NULL,NULL,'prospect',5,false,'{M6}','{}',NULL),
 ('HanseYachts AG','material_supplier',NULL,'Ladebower Chaussee 11','17493','Greifswald','DE',NULL,NULL,'prospect',5,false,'{M6}','{}',NULL),
 ('Haase Tank GmbH','material_supplier',NULL,'Auweg 6','23843','Bad Oldesloe','DE',NULL,NULL,'prospect',4,false,'{M7}','{}',NULL),
 ('Roth Industries GmbH','material_supplier',NULL,'Am Seerain 2','35232','Dautphetal','DE',NULL,NULL,'prospect',4,false,'{M7}','{}',NULL),
 ('Lorenz Kunststofftechnik','material_supplier',NULL,NULL,NULL,'Wellingholzhausen','DE',NULL,NULL,'prospect',4,false,'{M2}','{}',NULL),
 ('Fibrolux GmbH','material_supplier',NULL,NULL,NULL,'Hofheim am Taunus','DE',NULL,NULL,'prospect',3,false,'{M3}','{}',NULL),
-- 4.5 product partners & customers
 ('Koch CC','product_partner',NULL,NULL,NULL,NULL,'DE',NULL,NULL,'prospect',5,true,'{}','{F1,F2,F3,F5}','Fixpartner Baustoffvalidierung. Vollständiger Firmenname, Standort und Ansprechpartner noch zu ergänzen.'),
 ('STRABAG TPA','customer',NULL,NULL,NULL,'Wien / Köln','AT',NULL,NULL,'prospect',4,false,'{}','{F1}','Asphalt.'),
 ('C3 Bremen (STRABAG)','customer',NULL,NULL,NULL,'Bremen','DE',NULL,NULL,'prospect',4,false,'{}','{F1}',NULL),
 ('Heidelberg Materials','customer',NULL,NULL,NULL,'Rüdersdorf','DE',NULL,NULL,'prospect',5,false,'{}','{F3,F5}',NULL),
 ('BASF SE','customer',NULL,NULL,NULL,'Schwarzheide','DE',NULL,NULL,'prospect',4,false,'{}','{F2,F4}',NULL),
 ('Rieder Smart Elements','customer',NULL,NULL,NULL,NULL,'AT',NULL,NULL,'prospect',4,false,'{}','{F1,F3}',NULL),
 ('Dyckerhoff GmbH','customer',NULL,NULL,NULL,'Wiesbaden','DE',NULL,NULL,'prospect',4,false,'{}','{F3,F5}',NULL),
 ('BWS Betonwerk Schwerin','customer',NULL,NULL,NULL,'Schwerin','DE',NULL,NULL,'prospect',5,false,'{}','{F1,F3}',NULL),
 ('GP Hanse Frischbeton','customer',NULL,NULL,NULL,'Rostock','DE',NULL,NULL,'prospect',5,false,'{}','{F1,F3}',NULL),
 ('AKRO-PLASTIC GmbH','product_partner',NULL,'BioParK 1','56651','Niederzissen','DE',NULL,NULL,'prospect',5,false,'{}','{F4}',NULL),
 ('BARLOG plastics GmbH','product_partner',NULL,'Am Weidenbusch 13','51491','Overath','DE',NULL,NULL,'prospect',4,false,'{}','{F4}',NULL),
 ('Lehmann&Voss & Co. KG','product_partner',NULL,'Alsterufer 19','20354','Hamburg','DE',NULL,NULL,'prospect',5,false,'{}','{F4}',NULL),
 ('ALBIS (Otto Krahn Group)','product_partner',NULL,'Mühlenhagen 35','20539','Hamburg','DE',NULL,NULL,'prospect',4,false,'{}','{F4}',NULL),
 ('EconCore N.V.','product_partner',NULL,NULL,NULL,'Houthalen-Helchteren','BE',NULL,NULL,'prospect',4,false,'{}','{F4}',NULL),
 ('VELOSIT GmbH','product_partner',NULL,NULL,NULL,'Herford','DE',NULL,NULL,'prospect',4,false,'{}','{F3}','Referenzdaten VELOSIT 503: Biegezug 8,4 MPa Baseline -> 12,8–13,2 MPa bei 80 Tagen.'),
-- 4.6 science & labs
 ('TU Dresden (ILK — Institut für Leichtbau)','research_institute',NULL,NULL,NULL,'Dresden','DE',NULL,NULL,'prospect',5,true,'{}','{F1,F2,F3,F4}','Faserlängen-/Schädigungsanalyse, Verfahrensbewertung, mechanische Charakterisierung.'),
 ('TU Bergakademie Freiberg','research_institute',NULL,NULL,NULL,'Freiberg','DE',NULL,NULL,'prospect',5,true,'{}','{F1,F3,F5}','Aufbereitungstechnik, Sichtung, Korngrößen, Baustoffeignung, Stoffstromanalyse.'),
 ('SKZ – Das Kunststoff-Zentrum','lab',NULL,'Friedrich-Bergius-Ring 22','97076','Würzburg','DE',NULL,NULL,'prospect',4,false,'{}','{F1,F2,F3,F4,F5}','Faserlänge, Aschegehalt, mechanische Prüfung, Compoundierung.'),
 ('Fraunhofer ICT','lab',NULL,'Joseph-von-Fraunhofer-Str. 7','76327','Pfinztal','DE',NULL,NULL,'prospect',4,false,'{}','{F1,F2,F3,F4,F5}','Composite-Technikum, DoE-Begleitung, LCA.'),
 ('Currenta GmbH','lab',NULL,'Chempark','51368','Leverkusen','DE',NULL,NULL,'prospect',4,false,'{}','{F4}','Akkreditierte Polymeranalytik.'),
 ('Kunststoff-Institut Lüdenscheid','lab',NULL,'Karolinenstr. 8','58507','Lüdenscheid','DE',NULL,NULL,'prospect',4,false,'{}','{F4}','Spritzguss, Bauteilprüfung.')
ON CONFLICT (lower(name)) DO NOTHING;

-- ---------------------------------------------------------------- Contacts
INSERT INTO public.project_contacts (partner_id, name, role, email, phone, is_primary, is_decision_maker, notes)
SELECT p.id, v.name, v.role, v.email, v.phone, v.is_primary, v.is_decision_maker, v.notes
FROM (VALUES
  ('Siempelkamp Sizereduction (ex-Pallmann)','Angelo Martuccio','Vertrieb / Technikum','angelo.martuccio@siempelkamp.com','+49 6332 802-270',true,true,'Kontaktdaten auf Aktualität prüfen.'),
  ('Siempelkamp Sizereduction (ex-Pallmann)','Rosario Kindlein','Technikum',NULL,'+49 6332 802-0',false,false,NULL),
  ('Herbold Meckesheim GmbH','Achim Ebel','Vertrieb','herbold@herbold.com','+49 6226 932-149',true,true,'Kontaktdaten auf Aktualität prüfen.')
) AS v(partner_name, name, role, email, phone, is_primary, is_decision_maker, notes)
JOIN public.project_partners p ON lower(p.name) = lower(v.partner_name)
WHERE NOT EXISTS (
  SELECT 1 FROM public.project_contacts c WHERE c.partner_id = p.id AND c.name = v.name
);

-- ---------------------------------------------------------------- Phases
INSERT INTO public.project_phases (code, name, description, order_num, status) VALUES
  ('P0','Vorbereitung & IP-Sicherung','Kritisch — muss vor Herstellerkontakt abgeschlossen sein.',0,'in_progress'),
  ('P1','Materialbeschaffung','Fixstart: Optiplan und Lamilux.',1,'not_started'),
  ('P2','Maschinen- & Verfahrenstests','Fixstart: Siempelkamp Sizereduction.',2,'not_started'),
  ('P3','Fraktionsherstellung','Definierte Materialmengen je Zielfraktion für die Produkttests.',3,'not_started'),
  ('P4','Produktvalidierung Baustoff','Fixpartner: Koch CC.',4,'not_started'),
  ('P5','Produktvalidierung Kunststoff','Compoundier-Trials PP-GF und PA6-GF.',5,'not_started'),
  ('P6','Wissenschaftliche Begleitung','Fixpartner: TU Dresden, TU Bergakademie Freiberg — laufend ab Phase 2.',6,'not_started'),
  ('P7','Auswertung & Anlagenspezifikation','Material-Maschinen-Matrix, CAPEX, Förderantrag.',7,'not_started')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name, description = EXCLUDED.description, order_num = EXCLUDED.order_num;

-- ---------------------------------------------------------------- Tasks
INSERT INTO public.project_tasks
  (code, phase_id, title, description, priority, estimated_duration_weeks, estimated_cost_eur, partner_id)
SELECT v.code, ph.id, v.title, v.description, v.priority, v.weeks, v.cost,
       (SELECT id FROM public.project_partners pp WHERE lower(pp.name) = lower(v.partner) LIMIT 1)
FROM (VALUES
 ('P0','P0-1','Patentrecherche Scher-/Walkverfahren','Freedom-to-Operate klären, Abgrenzung gegen Prallverfahren (Regen Fiber).','critical',3.5,4000,NULL),
 ('P0','P0-2','Patentanmeldung einreichen','Stumpfe Messer, Low-RPM, Walk-Vorlockerung. Sperrt Phase-2-Aktivitäten bis erledigt.','critical',5,11500,NULL),
 ('P0','P0-3','NDA-Template erstellen','Herstellerschutz mit IP-Ausnahme.','high',1.5,2500,NULL),
 ('P0','P0-4','Versuchsprotokoll-Template entwickeln','Grundlage für Patentnachweis und Herstellerdoku.','high',1,0,NULL),
 ('P0','P0-5','Externes Analytik-Labor auswählen','SKZ Würzburg / Fraunhofer ICT / Currenta.','high',2,0,NULL),
 ('P0','P0-6','Fraktions-Spezifikationsblätter definieren (F1–F5)','Sollwerte je Zielfraktion festschreiben.','high',1,0,NULL),
 ('P1','P1-1','Materialanfrage Optiplan (M1, 0,5–2 t)','Startmaterial, homogene UP-Plattenware.','high',3,0,'Optiplan'),
 ('P1','P1-2','Materialanfrage Lamilux (M1, 0,5–2 t)','Startmaterial, homogene UP-Plattenware.','high',3,0,'Lamilux Heinrich Strunz GmbH'),
 ('P1','P1-3','Materialdokumentation je Charge','Harztyp, Faseranteil, Füllstoff, Datenblatt.','medium',NULL,0,NULL),
 ('P1','P1-4','Weitere Materialtypen anfragen (M2–M7)','Breite der Materialbasis für die Material-Maschinen-Matrix.','medium',5,7500,NULL),
 ('P1','P1-5','Wareneingangskontrolle + Chargen-Anlage im System','Jede Charge als material_batch erfassen.','medium',NULL,0,NULL),
 ('P2','P2-1','Hersteller-Longlist finalisieren + priorisieren','Bewertung nach Eignung 1–5.','high',2,0,NULL),
 ('P2','P2-2','Technikumstest Siempelkamp','Granulator + Sichtung/Siebung.','critical',5,7500,'Siempelkamp Sizereduction (ex-Pallmann)'),
 ('P2','P2-3','Vergleichstest Vecoplan (VAZ Einwellen)','Druckschneidend, 60–130 U/min.','high',5,7500,'Vecoplan AG'),
 ('P2','P2-4','Vergleichstest Herbold (SMS Doppelschrägschnitt)','Verschleißarme Schnittführung.','high',5,7500,'Herbold Meckesheim GmbH'),
 ('P2','P2-5','Vorzerkleinerungs-Tests (Walzenbrecher / Einwellen)','Für dickwandiges Material M7.','medium',3,7500,NULL),
 ('P2','P2-6','Sicht- und Siebdemos (Windsichtung, Klassierung)','Trennung Faser / Feinanteil.','high',5,10000,'Hosokawa Alpine AG'),
 ('P2','P2-7','DoE-Läufe dokumentieren + Laboranalytik','27–30 Versuchsläufe je Linie.','critical',NULL,20000,NULL),
 ('P2','P2-8','Benchmark-Gegentest Prallverfahren','BHS-Sonthofen RPMV — Gegenprobe zum Scherprinzip.','low',2,4000,'BHS-Sonthofen GmbH'),
 ('P2','P2-9','Optimale Maschinenkombination je Materialtyp festlegen','Ergebnis der DoE-Auswertung.','high',2,0,NULL),
 ('P3','P3-1','Fraktion F1 (8–15 mm) herstellen','Zielmenge 100–200 kg.','high',NULL,0,NULL),
 ('P3','P3-2','Fraktion F2 (4–10 mm, Polymerbeton) herstellen','Zielmenge 100–200 kg.','high',NULL,0,NULL),
 ('P3','P3-3','Fraktion F3 (3–8 mm, Mörtel/Zement) herstellen','Zielmenge 200–300 kg.','high',NULL,0,NULL),
 ('P3','P3-4','Fraktion F4 (1–3 mm / Pellet, Compound) herstellen','Zielmenge 100–200 kg.','high',NULL,0,NULL),
 ('P3','P3-5','Fraktion F5 (Feinanteil) sammeln + charakterisieren','Zielmenge 100 kg — kein Abfall, Zement-/Füllerprodukt.','medium',NULL,0,NULL),
 ('P3','P3-6','Spezifikationsblatt je Fraktion erstellen','Kundendatenblatt inkl. Knockdown-Tabelle bei F4.','high',NULL,0,NULL),
 ('P3','P3-7','Rückstellmuster archivieren','Je Fraktion 2 kg, dokumentiert.','medium',NULL,0,NULL),
 ('P4','P4-1','Koch CC — Betontest','Druckfestigkeit, Biegezug, Rissverhalten.','high',NULL,0,'Koch CC'),
 ('P4','P4-2','Koch CC — Mörteltest','Haftzug, Schwindverhalten, Verarbeitbarkeit.','high',NULL,0,'Koch CC'),
 ('P4','P4-3','Koch CC — Zementtest','Festigkeitsentwicklung, Eluat, Eignung.','high',NULL,0,'Koch CC'),
 ('P4','P4-4','Koch CC — Polymerbeton','Biegezug, Druck, Faser-Matrix-Haftung.','high',NULL,0,'Koch CC'),
 ('P4','P4-5','Dosierraten-Reihe 5 / 10 / 15 / 20 %','Optimalen Substitutionsgrad bestimmen.','high',NULL,0,NULL),
 ('P4','P4-6','Faserlängen-Leiter testen','Längenklassen gegeneinander, optimale Länge je Anwendung.','medium',NULL,0,NULL),
 ('P4','P4-7','Kundenvalidierung bei Betonwerken','Praxistest.','medium',NULL,0,NULL),
 ('P5','P5-1','Compoundier-Trial PP-GF','Einarbeitung, Faserkürzung, Drehmoment.','high',NULL,0,NULL),
 ('P5','P5-2','Compoundier-Trial PA6-GF','Wie PP-GF, höhere Temperatur.','high',NULL,0,NULL),
 ('P5','P5-3','Mechanische Prüfung Prüfkörper','Zug ISO 527, Biege 178, Charpy 179, HDT 75.','high',NULL,0,NULL),
 ('P5','P5-4','MAPP/Haftvermittler-Optimierung','Grenzflächenhaftung.','medium',NULL,0,NULL),
 ('P5','P5-5','Ausgasungsverhalten UP-Rest bewerten','Styrol-Emission bei 200–280 °C.','medium',NULL,0,NULL),
 ('P5','P5-6','Datenblatt Compound-Grade erstellen','Ehrliche Knockdown-Tabelle vs. Virgin.','medium',NULL,0,NULL),
 ('P6','P6-1','Kooperationsvertrag + IP-/Geheimhaltungsregelung','Beide TUs.','high',NULL,0,NULL),
 ('P6','P6-2','Faserlängen-/Faserschädigungsanalyse','TU Dresden (ILK).','high',NULL,0,'TU Dresden (ILK — Institut für Leichtbau)'),
 ('P6','P6-3','Verfahrensbewertung Scher- vs. Prallprinzip','TU Dresden.','high',NULL,0,'TU Dresden (ILK — Institut für Leichtbau)'),
 ('P6','P6-4','Aufbereitungs-/Sichtungsanalyse, Korngrößen','TU Freiberg.','medium',NULL,0,'TU Bergakademie Freiberg'),
 ('P6','P6-5','Baustoff-Eignungsbewertung','TU Freiberg.','medium',NULL,0,'TU Bergakademie Freiberg'),
 ('P6','P6-6','Stoffstromanalyse / Massenbilanz','TU Freiberg.','medium',NULL,0,'TU Bergakademie Freiberg'),
 ('P6','P6-7','Verwertbare Berichte für Patent & Förderung erstellen','Beide TUs.','medium',NULL,0,NULL),
 ('P7','P7-1','Material-Maschinen-Matrix vervollständigen','Ergebnis aller Versuchsläufe.','high',NULL,0,NULL),
 ('P7','P7-2','Anlagenspezifikation 32 t/Tag ableiten','≈ 8.000 t/Jahr.','high',NULL,0,NULL),
 ('P7','P7-3','CAPEX-Modell aus Testdaten','Investitionsrechnung.','high',NULL,0,NULL),
 ('P7','P7-4','Förderantrag vorbereiten','EU Innovation Fund, BMUV, KfW, GRW.','high',NULL,0,NULL),
 ('P7','P7-5','Investoren-/Kundenpräsentation aus Testdaten generieren','Außenwirkung.','medium',NULL,0,NULL)
) AS v(phase_code, code, title, description, priority, weeks, cost, partner)
JOIN public.project_phases ph ON ph.code = v.phase_code
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------- Dependencies
INSERT INTO public.project_task_dependencies (task_id, depends_on_task_id)
SELECT t.id, d.id
FROM (VALUES
  ('P0-2','P0-1'),
  ('P1-1','P0-3'), ('P1-2','P0-3'),
  ('P1-3','P1-1'), ('P1-3','P1-2'),
  ('P1-4','P1-3'), ('P1-5','P1-1'),
  ('P2-2','P0-2'), ('P2-2','P1-3'),
  ('P2-3','P2-2'), ('P2-4','P2-2'), ('P2-5','P1-4'), ('P2-6','P2-2'),
  ('P2-7','P0-5'), ('P2-7','P2-2'), ('P2-8','P2-2'), ('P2-9','P2-7'),
  ('P3-1','P2-9'), ('P3-2','P2-9'), ('P3-3','P2-9'), ('P3-4','P2-9'), ('P3-5','P2-9'),
  ('P3-6','P3-1'), ('P3-6','P3-2'), ('P3-6','P3-3'), ('P3-6','P3-4'), ('P3-6','P3-5'),
  ('P3-7','P3-1'), ('P3-7','P3-2'), ('P3-7','P3-3'), ('P3-7','P3-4'), ('P3-7','P3-5'),
  ('P4-1','P3-1'), ('P4-1','P3-2'), ('P4-2','P3-3'),
  ('P4-3','P3-3'), ('P4-3','P3-5'), ('P4-4','P3-2'),
  ('P4-5','P4-1'), ('P4-5','P4-2'), ('P4-5','P4-3'), ('P4-5','P4-4'),
  ('P4-6','P4-5'), ('P4-7','P4-5'),
  ('P5-1','P3-4'), ('P5-2','P3-4'),
  ('P5-3','P5-1'), ('P5-3','P5-2'), ('P5-4','P5-3'), ('P5-5','P5-1'), ('P5-6','P5-3'),
  ('P7-1','P2-9'), ('P7-2','P7-1'), ('P7-3','P7-2'), ('P7-4','P7-3'), ('P7-5','P7-3')
) AS v(task_code, depends_on_code)
JOIN public.project_tasks t ON t.code = v.task_code
JOIN public.project_tasks d ON d.code = v.depends_on_code
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------- DoE series
INSERT INTO public.doe_series (code, name, process_line, description, factors, responses, planned_runs, design_type)
VALUES
 ('DOE-A-01','Linie A — Baustoff (längenerhaltend)','A_baustoff',
  'Vollfaktorieller Screening-Plan zur Maximierung der Faserlänge bei akzeptablem Energieeintrag.',
  '[{"key":"rpm","label":"Drehzahl","unit":"U/min","levels":[25,30,35]},
    {"key":"blade_edge_radius_mm","label":"Schneidkantenradius","unit":"mm","levels":[0.3,0.5,0.8]},
    {"key":"wedge_angle_deg","label":"Keilwinkel","unit":"°","levels":[60,70,80]},
    {"key":"cutting_gap_mm","label":"Schnittspalt","unit":"mm","levels":[0.5,0.65,0.8]},
    {"key":"screen_size_mm","label":"Siebung","unit":"mm","levels":[12,20,"ohne"]}]'::jsonb,
  '{fiber_length_median_mm,fiber_length_d10_mm,fiber_length_d90_mm,glass_content_pct,fines_below_05mm_pct,energy_kwh_t,tool_wear_g_t,throughput_kgh}',
  27,'full_factorial'),
 ('DOE-B-01','Linie B — Compound (definierte Kurzlänge)','B_compound',
  'Zweistufige Prozessführung: Granulator → Sieb → On-Spec-Fraktion 3–5 mm, Überkorn rückführen, Feinanteil in das Zement-/Füllerprodukt.',
  '[{"key":"rpm","label":"Drehzahl","unit":"U/min","levels":[100,150,200]},
    {"key":"blade_condition","label":"Messerzustand","unit":"","levels":["scharf","leicht stumpf"]},
    {"key":"cutting_gap_mm","label":"Schnittspalt","unit":"mm","levels":[0.1,0.2,0.3]},
    {"key":"screen_size_mm","label":"Sieblochung","unit":"mm","levels":[4,5,6]},
    {"key":"screen_type","label":"Siebtyp","unit":"","levels":["Rundloch","Schlitz"]}]'::jsonb,
  '{fiber_length_median_mm,fiber_length_d10_mm,fiber_length_d90_mm,glass_content_pct,fines_below_05mm_pct,energy_kwh_t,tool_wear_g_t,throughput_kgh}',
  30,'full_factorial')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name, description = EXCLUDED.description,
  factors = EXCLUDED.factors, responses = EXCLUDED.responses,
  planned_runs = EXCLUDED.planned_runs;

-- ---------------------------------------------------------------- Email templates
INSERT INTO public.project_email_templates (code, name, category, subject, body_md, placeholders) VALUES
('MAT_REQUEST','Materialanfrage','material_request',
 'Anfrage GFK-Produktionsreste für Recyclingversuche',
 E'Sehr geehrte(r) {{contact_name}},\n\nwir entwickeln ein kaltmechanisches Recyclingverfahren für glasfaserverstärkte\nKunststoffe, das die Faserlänge erhält und dadurch hochwertige Rezyklatfasern für\nBeton-, Mörtel- und Compoundanwendungen erzeugt.\n\nFür unsere Versuchsreihe suchen wir Produktionsreste aus Ihrer Fertigung:\n\n- Menge: {{quantity}} für erste Versuche\n- Material: {{material_description}}\n- Anforderung: sortenrein, ohne Sandanteil, ohne Fremdstoffe\n\nWir übernehmen Transport und Handling. Über die Ergebnisse berichten wir Ihnen\nselbstverständlich zurück — perspektivisch bietet das Verfahren eine\nVerwertungsalternative zur Entsorgung Ihrer Produktionsabfälle.\n\nKönnen wir dazu kurz telefonieren?\n\nMit freundlichen Grüßen\n{{sender_name}}',
 '{"{{contact_name}}","{{quantity}}","{{material_description}}","{{sender_name}}"}'),
('TRIAL_REQUEST','Technikumsanfrage Maschinenhersteller','trial_request',
 'Anfrage Technikumsversuch — Zerkleinerung GFK-Produktionsreste',
 E'Sehr geehrte Damen und Herren,\n\nfür ein GFK-Recyclingprojekt suchen wir Technikums-Kapazität zur Zerkleinerung und\nKlassierung von GFK-Produktionsresten.\n\nMATERIAL\n{{material_description}}, ca. {{quantity}} je Charge, saubere Produktionsreste\n(kein Sand, keine Rotorblätter).\n\nZIEL\nFaserschonende Zerkleinerung mit Erhalt möglichst langer Faserfraktion bei niedriger\nDrehzahl. Anschließend Windsichtung und Siebung in definierte Längenklassen.\n\nBITTE TEILEN SIE UNS MIT\n- Eignung Ihrer Maschinen (Modell/Serie) für dieses Material\n- Möglichkeiten der Kühlung (Wasser Schneidraum / Rotor / Sieb)\n- Optionen für Drehzahlregelung und Anpassung der Messergeometrie\n- Verfügbare Durchsätze im Technikum\n- Tagessatz Technikum inkl. Versuchsleitung und Siebanalyse\n- Verfügbarkeit in den nächsten {{timeframe}}\n\nEin gegenseitiges NDA ist aus unserer Sicht Voraussetzung; einen Entwurf stellen wir\ngern bereit.\n\nMit freundlichen Grüßen\n{{sender_name}}',
 '{"{{material_description}}","{{quantity}}","{{timeframe}}","{{sender_name}}"}'),
('LAB_ORDER','Analytik-Beauftragung','lab_order',
 'Beauftragung Analytik — Rezyklat-Glasfaser {{fraction_code}}',
 E'Sehr geehrte Damen und Herren,\n\nwir übersenden Ihnen Proben zur Analyse.\n\nPROBE\nKennung: {{fraction_code}}\nMaterial: Rezyklat-Glasfaser aus kaltmechanischem GFK-Recycling\nMenge: {{sample_weight}}\n\nGEWÜNSCHTE ANALYSEN\n- Faserlängenverteilung (Median, D10/D50/D90) — Bildanalyse\n- Glasgehalt / Aschegehalt nach EN ISO 1172\n- Restfeuchte\n- Schüttdichte nach DIN EN ISO 60\n- Siebanalyse mit Feinanteil < 0,5 mm\n- Fremdstoffe / Metallgehalt\n\nBitte nennen Sie uns Preis und Bearbeitungsdauer. Die Ergebnisse benötigen wir bis\n{{deadline}}.\n\nMit freundlichen Grüßen\n{{sender_name}}',
 '{"{{fraction_code}}","{{sample_weight}}","{{deadline}}","{{sender_name}}"}'),
('PRODUCT_TEST','Produkttest-Anfrage','product_test',
 'Testreihe Rezyklat-Glasfaser in {{application}}',
 E'Sehr geehrte(r) {{contact_name}},\n\nwie besprochen übersenden wir Rezyklat-Glasfaser aus unserem kaltmechanischen\nVerfahren für die geplante Testreihe.\n\nMATERIAL\nFraktion: {{fraction_code}} — {{fraction_name}}\nFaserlänge: {{fiber_length}}\nGlasgehalt: {{glass_content}}\nMenge: {{quantity}}\n\nVORGESCHLAGENE TESTREIHE\nDosierraten: 5 / 10 / 15 / 20 Gew.-%\nReferenz: Rezeptur ohne Faserzusatz als Baseline\nPrüfalter: 7 / 28 / 80 Tage\n\nGEWÜNSCHTE PRÜFGRÖSSEN\n{{test_parameters}}\n\nDas Datenblatt zur Fraktion liegt bei. Für Rückfragen zur Verarbeitung stehen wir\njederzeit zur Verfügung.\n\nMit freundlichen Grüßen\n{{sender_name}}',
 '{"{{contact_name}}","{{application}}","{{fraction_code}}","{{fraction_name}}","{{fiber_length}}","{{glass_content}}","{{quantity}}","{{test_parameters}}","{{sender_name}}"}'),
('SCIENCE_COOP','Wissenschaftliche Kooperation','science_coop',
 'Anfrage Forschungskooperation — kaltmechanisches GFK-Recycling',
 E'Sehr geehrte Frau / Herr Prof. {{contact_name}},\n\nwir entwickeln ein kaltmechanisches Verfahren zum Recycling glasfaserverstärkter\nKunststoffe, das gezielt den Unterschied der Bruchdehnungen von Harzmatrix und\nGlasfaser nutzt, um die Faserlänge zu erhalten.\n\nFür die wissenschaftliche Absicherung suchen wir einen Kooperationspartner mit\nExpertise in {{expertise_area}}.\n\nMÖGLICHE ARBEITSPAKETE\n{{work_packages}}\n\nWir stellen Versuchsmaterial, Anlagenzugang über unsere Technikumspartner und die\nvollständige Versuchsdokumentation bereit. Die Ergebnisse sollen in Förderanträge\n(EU Innovation Fund, BMUV, KfW) einfließen.\n\nWichtig ist uns eine klare Regelung zu Geheimhaltung und Schutzrechten, da eine\nPatentanmeldung zum Verfahren läuft.\n\nWären Sie zu einem ersten Gespräch bereit?\n\nMit freundlichen Grüßen\n{{sender_name}}',
 '{"{{contact_name}}","{{expertise_area}}","{{work_packages}}","{{sender_name}}"}'),
('FOLLOW_UP','Nachfassmail','follow_up',
 'Nachfrage zu unserer Anfrage vom {{original_date}}',
 E'Sehr geehrte(r) {{contact_name}},\n\nam {{original_date}} hatte ich Ihnen zu {{topic}} geschrieben.\n\nFalls die Anfrage untergegangen ist: gern fasse ich das Wichtigste zusammen —\n{{one_line_summary}}\n\nPasst ein kurzes Telefonat in den nächsten Tagen? Ich richte mich nach Ihrem Kalender.\n\nMit freundlichen Grüßen\n{{sender_name}}',
 '{"{{contact_name}}","{{original_date}}","{{topic}}","{{one_line_summary}}","{{sender_name}}"}'),
('RESULT_SHARE','Ergebnisübermittlung','result_share',
 'Ergebnisse Versuchsreihe {{run_code}}',
 E'Sehr geehrte(r) {{contact_name}},\n\nanbei die Ergebnisse unserer gemeinsamen Versuchsreihe.\n\nKERNERGEBNISSE\n{{key_results}}\n\nBEWERTUNG\n{{assessment}}\n\nNÄCHSTE SCHRITTE\n{{next_steps}}\n\nDas vollständige Versuchsprotokoll finden Sie im Anhang.\n\nMit freundlichen Grüßen\n{{sender_name}}',
 '{"{{contact_name}}","{{run_code}}","{{key_results}}","{{assessment}}","{{next_steps}}","{{sender_name}}"}')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name, category = EXCLUDED.category, subject = EXCLUDED.subject,
  body_md = EXCLUDED.body_md, placeholders = EXCLUDED.placeholders;

-- ---------------------------------------------------------------- Starter risks
INSERT INTO public.project_risks (title, description, category, probability, impact, mitigation_plan, owner, phase_id)
SELECT v.title, v.description, v.category, v.probability, v.impact, v.mitigation, v.owner, ph.id
FROM (VALUES
 ('Herstellerdemo vor Patentanmeldung','Ein Technikumstermin vor Einreichung der Patentanmeldung zerstört die Neuheit des Verfahrens.','ip',3,5,'Phase-2-Aufgaben erst nach Abschluss von P0-2 starten. NDA vorab abschließen (P0-3).','manuel.buckow','P0'),
 ('Werkzeugverschleiß bei SMC/BMC','Hoher CaCO3-Füllstoffanteil in M2 führt zu überproportionalem Verschleiß der Schneidwerkzeuge.','technical',4,3,'Verschleißschutz Wolframkarbid/Stellite testen, Verschleiß in g/t je Lauf dokumentieren.','manuel.buckow','P2'),
 ('Energieeintrag über 350 kWh/t','Überschreitung der wirtschaftlichen Schwelle macht das Verfahren nicht darstellbar.','financial',3,5,'Energiemessung in jedem DoE-Lauf verpflichtend; Drehzahl/Durchsatz-Trade-off systematisch auswerten.','manuel.buckow','P2'),
 ('Glasgehalt unter 50 % in der Faserfraktion','Compoundeure verlieren das Interesse, F4 fällt auf Füllstoffqualität zurück.','market',2,5,'Sichtung/Klassierung optimieren (P2-6), Epoxid-Material M5 für High-Purity-Compound priorisieren.','manuel.buckow','P3'),
 ('Materialverfügbarkeit Startmaterial','Optiplan/Lamilux liefern nicht in der benötigten Menge oder Qualität.','supplier',2,4,'Frühzeitig Zweitquellen aus M1-Liste aktivieren (Werzalit, Röchling).','manuel.buckow','P1')
) AS v(title, description, category, probability, impact, mitigation, owner, phase_code)
LEFT JOIN public.project_phases ph ON ph.code = v.phase_code
WHERE NOT EXISTS (SELECT 1 FROM public.project_risks r WHERE r.title = v.title);

-- ---------------------------------------------------------------- Reference product test data (VELOSIT 503)
DO $$
DECLARE
  v_partner uuid;
  v_test uuid;
BEGIN
  SELECT id INTO v_partner FROM public.project_partners WHERE lower(name) = lower('VELOSIT GmbH');

  INSERT INTO public.product_tests (test_code, title, category, partner_id, dosage_pct, recipe_notes, status, summary)
  VALUES ('PT-REF-VELOSIT-503','Referenz VELOSIT 503 — Mörtel mit Rezyklat-Glasfaser','mortar', v_partner, NULL,
          'Nachgewiesene Referenzdaten aus der Verfahrensentwicklung. Baseline = Rezeptur ohne Faser.',
          'completed',
          'Biegezugfestigkeit steigt von 8,4 MPa (Baseline ohne Faser) auf 12,8–13,2 MPa bei 80 Tagen — konkurrenzfähig gegenüber Carbon- und PVA-Fasern.')
  ON CONFLICT (test_code) DO NOTHING;

  SELECT id INTO v_test FROM public.product_tests WHERE test_code = 'PT-REF-VELOSIT-503';

  IF v_test IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.product_test_results WHERE product_test_id = v_test
  ) THEN
    INSERT INTO public.product_test_results (product_test_id, parameter_key, value_numeric, unit, age_days, baseline_value)
    VALUES
      (v_test,'flexural_strength_mpa', 8.4, 'MPa', 80, 8.4),
      (v_test,'flexural_strength_mpa',12.8, 'MPa', 80, 8.4),
      (v_test,'flexural_strength_mpa',13.2, 'MPa', 80, 8.4);
  END IF;
END $$;
