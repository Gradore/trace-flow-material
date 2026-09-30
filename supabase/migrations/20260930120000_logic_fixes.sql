-- Logikkorrekturen Projektmodul (idempotent)
--
-- 1. Ausbeute (output_fractions.yield_pct) wurde nur berechnet, solange sie
--    leer war. Nach einer Gewichtskorrektur blieb der alte Wert stehen, obwohl
--    die Oberfläche "von der Datenbank berechnet" anzeigt. Jetzt wird bei jeder
--    Änderung von Gewicht oder Versuch neu gerechnet, ebenso bei Änderung des
--    Einsatzgewichts im Versuch.
-- 2. pass_fail (Analyse) und delta_pct (Produkttest) blieben stehen, wenn der
--    Messwert oder die Referenz nachträglich gelöscht wurde. Sie werden jetzt
--    geleert, wenn keine Bewertung mehr möglich ist.
-- 3. Mail-Vorlage SCIENCE_COOP behauptete eine laufende Patentanmeldung.
--    Das Projekt wird ohne Patent geführt.

CREATE OR REPLACE FUNCTION public.compute_fraction_yield()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  input_kg numeric;
BEGIN
  -- Eine mitgegebene bzw. unverändert gelassene Ausbeute bleibt stehen, solange
  -- sich weder Gewicht noch Versuch ändern (manuelle Angabe).
  IF TG_OP = 'INSERT' AND NEW.yield_pct IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE'
     AND NEW.weight_kg IS NOT DISTINCT FROM OLD.weight_kg
     AND NEW.test_run_id IS NOT DISTINCT FROM OLD.test_run_id
     AND (NEW.yield_pct IS NOT NULL OR OLD.yield_pct IS NOT NULL) THEN
    RETURN NEW;
  END IF;

  NEW.yield_pct := NULL;
  IF NEW.test_run_id IS NOT NULL AND NEW.weight_kg IS NOT NULL THEN
    SELECT input_weight_kg INTO input_kg FROM public.test_runs WHERE id = NEW.test_run_id;
    IF input_kg IS NOT NULL AND input_kg > 0 THEN
      NEW.yield_pct := round((NEW.weight_kg / input_kg) * 100, 2);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_fraction_yields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE public.output_fractions f
     SET yield_pct = CASE
           WHEN NEW.input_weight_kg IS NOT NULL AND NEW.input_weight_kg > 0 AND f.weight_kg IS NOT NULL
             THEN round((f.weight_kg / NEW.input_weight_kg) * 100, 2)
           ELSE NULL
         END
   WHERE f.test_run_id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS refresh_fraction_yields ON public.test_runs;
CREATE TRIGGER refresh_fraction_yields
  AFTER UPDATE OF input_weight_kg ON public.test_runs
  FOR EACH ROW
  WHEN (NEW.input_weight_kg IS DISTINCT FROM OLD.input_weight_kg)
  EXECUTE FUNCTION public.refresh_fraction_yields();

CREATE OR REPLACE FUNCTION public.evaluate_analysis_result()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  spec public.fraction_specs%ROWTYPE;
  v_min numeric;
  v_max numeric;
BEGIN
  SELECT fs.* INTO spec
  FROM public.fraction_analyses fa
  JOIN public.output_fractions f ON f.id = fa.output_fraction_id
  JOIN public.fraction_specs fs ON fs.id = f.target_fraction_id
  WHERE fa.id = NEW.analysis_id;

  IF FOUND AND NEW.spec_min IS NULL AND NEW.spec_max IS NULL THEN
    CASE NEW.parameter_key
      WHEN 'fiber_length_median_mm' THEN
        v_min := spec.fiber_length_min_mm; v_max := spec.fiber_length_max_mm;
      WHEN 'glass_content_pct' THEN
        v_min := spec.glass_content_min_pct; v_max := NULL;
      WHEN 'moisture_pct' THEN
        v_min := NULL; v_max := spec.moisture_max_pct;
      WHEN 'fines_below_05mm_pct' THEN
        v_min := NULL; v_max := spec.fines_max_pct;
      WHEN 'energy_kwh_t' THEN
        v_min := NULL; v_max := 350;
      ELSE
        v_min := NULL; v_max := NULL;
    END CASE;
    NEW.spec_min := v_min;
    NEW.spec_max := v_max;
  END IF;

  IF NEW.value_numeric IS NOT NULL AND (NEW.spec_min IS NOT NULL OR NEW.spec_max IS NOT NULL) THEN
    NEW.pass_fail :=
      (NEW.spec_min IS NULL OR NEW.value_numeric >= NEW.spec_min)
      AND (NEW.spec_max IS NULL OR NEW.value_numeric <= NEW.spec_max);
  ELSE
    NEW.pass_fail := NULL;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.compute_product_test_delta()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.baseline_value IS NOT NULL AND NEW.baseline_value <> 0 AND NEW.value_numeric IS NOT NULL THEN
    NEW.delta_pct := round(((NEW.value_numeric - NEW.baseline_value) / NEW.baseline_value) * 100, 2);
  ELSE
    NEW.delta_pct := NULL;
  END IF;
  RETURN NEW;
END;
$$;

-- Bestehende Ausbeuten einmal gegen die aktuellen Gewichte abgleichen.
UPDATE public.output_fractions f
   SET yield_pct = round((f.weight_kg / r.input_weight_kg) * 100, 2)
  FROM public.test_runs r
 WHERE r.id = f.test_run_id
   AND r.input_weight_kg > 0
   AND f.weight_kg IS NOT NULL
   AND f.yield_pct IS DISTINCT FROM round((f.weight_kg / r.input_weight_kg) * 100, 2);

UPDATE public.project_email_templates
   SET body_md = regexp_replace(
         body_md,
         'Wichtig ist uns eine klare Regelung zu Geheimhaltung und Schutzrechten, da eine\s+Patentanmeldung zum Verfahren läuft\.',
         E'Wichtig ist uns eine klare Regelung zu Geheimhaltung und Nutzungsrechten, da das\nVerfahrens-Know-how nicht patentiert ist und vertraulich bleiben muss.')
 WHERE code = 'SCIENCE_COOP'
   AND body_md ~ 'Patentanmeldung zum Verfahren läuft';
