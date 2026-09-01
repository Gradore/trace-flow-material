-- seed part 2: DoE series, templates, risks, reference test

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

-- Email templates
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

-- Starter risks
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

-- Reference product test data (VELOSIT 503)
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