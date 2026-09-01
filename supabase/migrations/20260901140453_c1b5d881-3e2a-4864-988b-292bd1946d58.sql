-- 20260901090100_project_module_seed

-- grants for the new project tables (Data API access)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_partners TO authenticated;
GRANT ALL ON public.project_partners TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_contacts TO authenticated;
GRANT ALL ON public.project_contacts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_phases TO authenticated;
GRANT ALL ON public.project_phases TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_tasks TO authenticated;
GRANT ALL ON public.project_tasks TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_task_dependencies TO authenticated;
GRANT ALL ON public.project_task_dependencies TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.material_batches TO authenticated;
GRANT ALL ON public.material_batches TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.doe_series TO authenticated;
GRANT ALL ON public.doe_series TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.test_runs TO authenticated;
GRANT ALL ON public.test_runs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.test_run_parameters TO authenticated;
GRANT ALL ON public.test_run_parameters TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fraction_specs TO authenticated;
GRANT ALL ON public.fraction_specs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.output_fractions TO authenticated;
GRANT ALL ON public.output_fractions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fraction_analyses TO authenticated;
GRANT ALL ON public.fraction_analyses TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fraction_analysis_results TO authenticated;
GRANT ALL ON public.fraction_analysis_results TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_tests TO authenticated;
GRANT ALL ON public.product_tests TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_test_results TO authenticated;
GRANT ALL ON public.product_test_results TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_email_templates TO authenticated;
GRANT ALL ON public.project_email_templates TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_communications TO authenticated;
GRANT ALL ON public.project_communications TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_analyses TO authenticated;
GRANT ALL ON public.ai_analyses TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_risks TO authenticated;
GRANT ALL ON public.project_risks TO service_role;

-- F1-F5
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

-- Partners
INSERT INTO public.project_partners
  (name, category, subcategory, street, postal_code, city, country, phone, email,
   status, suitability_rating, is_fixed_partner, material_classes, fraction_ids, notes) VALUES
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
 ('Hosokawa Alpine AG','machine_manufacturer','classification','Peter-Dörfler-Str. 13–25','86199','Augsburg','DE',NULL,NULL,'prospect',5,false,'{}','{F1,F4,F5}',NULL),
 ('Westeria GmbH','machine_manufacturer','classification',NULL,NULL,'Ostbevern','DE',NULL,NULL,'prospect',4,false,'{}','{F1,F5}',NULL),
 ('Trennso-Technik GmbH','machine_manufacturer','classification',NULL,NULL,'Weißenhorn','DE',NULL,NULL,'prospect',4,false,'{}','{F1,F5}',NULL),
 ('Spaleck GmbH & Co. KG','machine_manufacturer','screening',NULL,NULL,'Bocholt','DE',NULL,NULL,'prospect',4,false,'{}','{F1,F2,F3}',NULL),
 ('RHEWUM GmbH','machine_manufacturer','screening','Rosentalstr. 24','42899','Remscheid','DE',NULL,NULL,'prospect',4,false,'{}','{F3,F4,F5}',NULL),
 ('JÖST GmbH + Co. KG','machine_manufacturer','screening',NULL,NULL,'Dülmen','DE',NULL,NULL,'prospect',4,false,'{}','{F1,F3}',NULL),
 ('Hamos GmbH','machine_manufacturer','electrostatic_separation',NULL,NULL,'Penzberg','DE',NULL,NULL,'prospect',3,false,'{}','{F4}',NULL),
 ('Allgaier Process Technology','machine_manufacturer','screening','Ulmer Str. 75','73066','Uhingen','DE',NULL,NULL,'prospect',4,false,'{}','{F3,F5}',NULL),
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
 ('TU Dresden (ILK — Institut für Leichtbau)','research_institute',NULL,NULL,NULL,'Dresden','DE',NULL,NULL,'prospect',5,true,'{}','{F1,F2,F3,F4}','Faserlängen-/Schädigungsanalyse, Verfahrensbewertung, mechanische Charakterisierung.'),
 ('TU Bergakademie Freiberg','research_institute',NULL,NULL,NULL,'Freiberg','DE',NULL,NULL,'prospect',5,true,'{}','{F1,F3,F5}','Aufbereitungstechnik, Sichtung, Korngrößen, Baustoffeignung, Stoffstromanalyse.'),
 ('SKZ – Das Kunststoff-Zentrum','lab',NULL,'Friedrich-Bergius-Ring 22','97076','Würzburg','DE',NULL,NULL,'prospect',4,false,'{}','{F1,F2,F3,F4,F5}','Faserlänge, Aschegehalt, mechanische Prüfung, Compoundierung.'),
 ('Fraunhofer ICT','lab',NULL,'Joseph-von-Fraunhofer-Str. 7','76327','Pfinztal','DE',NULL,NULL,'prospect',4,false,'{}','{F1,F2,F3,F4,F5}','Composite-Technikum, DoE-Begleitung, LCA.'),
 ('Currenta GmbH','lab',NULL,'Chempark','51368','Leverkusen','DE',NULL,NULL,'prospect',4,false,'{}','{F4}','Akkreditierte Polymeranalytik.'),
 ('Kunststoff-Institut Lüdenscheid','lab',NULL,'Karolinenstr. 8','58507','Lüdenscheid','DE',NULL,NULL,'prospect',4,false,'{}','{F4}','Spritzguss, Bauteilprüfung.')
ON CONFLICT (lower(name)) DO NOTHING;

-- Contacts
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

-- Phases
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

-- Tasks
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

-- Dependencies
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