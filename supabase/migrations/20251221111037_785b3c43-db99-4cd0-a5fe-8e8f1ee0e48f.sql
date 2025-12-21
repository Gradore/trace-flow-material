-- Tabelle für Rezepturen (vom KI generiert/vorgeschlagen)
CREATE TABLE public.recipes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recipe_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  material_composition JSONB, -- z.B. {"pp_percentage": 70, "glass_fiber_percentage": 30}
  target_properties JSONB, -- z.B. {"tensile_strength": "50 MPa", "flexural_modulus": "8 GPa"}
  applications TEXT[], -- Array von Anwendungsbereichen
  recommended_for TEXT[], -- z.B. ["Automobilbau", "Elektrogehäuse"]
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id),
  source TEXT DEFAULT 'ai_generated', -- 'ai_generated', 'manual', 'imported'
  confidence_score DECIMAL(3,2) -- KI-Konfidenz 0.00 - 1.00
);

-- Tabelle für Anwendungen/Bauteile
CREATE TABLE public.applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  application_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  industry TEXT, -- z.B. "Automotive", "Elektronik", "Bauwesen"
  category TEXT, -- z.B. "Strukturbauteile", "Gehäuse", "Verkleidungen"
  required_properties JSONB, -- Mindestanforderungen an Materialeigenschaften
  typical_materials TEXT[], -- Typische Materialien für diese Anwendung
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id),
  source TEXT DEFAULT 'ai_generated'
);

-- Verknüpfungstabelle: Aufträge zu Rezepturen/Anwendungen
CREATE TABLE public.order_recipe_matches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  recipe_id UUID REFERENCES public.recipes(id) ON DELETE SET NULL,
  application_id UUID REFERENCES public.applications(id) ON DELETE SET NULL,
  match_score DECIMAL(3,2), -- Übereinstimmungsgrad 0.00 - 1.00
  match_reason TEXT, -- Begründung der KI
  status TEXT DEFAULT 'suggested', -- 'suggested', 'approved', 'rejected'
  reviewed_by UUID REFERENCES public.profiles(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabelle für Hersteller-Matches (Vertriebssuche)
CREATE TABLE public.manufacturer_matches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  search_query TEXT NOT NULL, -- Original-Suchanfrage/Datenblatt-Info
  manufacturer_name TEXT NOT NULL,
  product_name TEXT,
  application_areas TEXT[],
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  website TEXT,
  address TEXT,
  notes TEXT,
  source TEXT DEFAULT 'ai_search', -- 'internal', 'ai_search', 'perplexity'
  confidence_score DECIMAL(3,2),
  source_urls TEXT[], -- Quellenangaben
  company_id UUID REFERENCES public.companies(id), -- Verknüpfung zu internen Unternehmen
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id)
);

-- Tabelle für Datenblatt-Analysen
CREATE TABLE public.datasheet_analyses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  analysis_id TEXT NOT NULL UNIQUE,
  document_id UUID REFERENCES public.documents(id),
  original_filename TEXT,
  extracted_properties JSONB, -- Extrahierte Materialeigenschaften
  material_type TEXT, -- Erkannter Materialtyp
  material_grade TEXT,
  manufacturer TEXT,
  analysis_summary TEXT,
  suggested_applications TEXT[],
  suggested_recipes UUID[], -- Referenzen zu passenden Rezepturen
  status TEXT DEFAULT 'pending', -- 'pending', 'analyzed', 'error'
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  analyzed_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES public.profiles(id)
);

-- Enable RLS
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_recipe_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manufacturer_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.datasheet_analyses ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Alle authentifizierten Benutzer können lesen
CREATE POLICY "Authenticated users can view recipes" ON public.recipes FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert recipes" ON public.recipes FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update recipes" ON public.recipes FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view applications" ON public.applications FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert applications" ON public.applications FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update applications" ON public.applications FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view order matches" ON public.order_recipe_matches FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert order matches" ON public.order_recipe_matches FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update order matches" ON public.order_recipe_matches FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete order matches" ON public.order_recipe_matches FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view manufacturer matches" ON public.manufacturer_matches FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert manufacturer matches" ON public.manufacturer_matches FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view datasheet analyses" ON public.datasheet_analyses FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert datasheet analyses" ON public.datasheet_analyses FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update datasheet analyses" ON public.datasheet_analyses FOR UPDATE USING (auth.role() = 'authenticated');

-- Trigger für updated_at
CREATE TRIGGER update_recipes_updated_at BEFORE UPDATE ON public.recipes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_applications_updated_at BEFORE UPDATE ON public.applications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Unique ID Generator erweitern
CREATE OR REPLACE FUNCTION public.generate_unique_id(prefix text)
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  year_part TEXT;
  seq_num INTEGER;
  new_id TEXT;
BEGIN
  year_part := TO_CHAR(NOW(), 'YYYY');
  
  SELECT COALESCE(MAX(
    CAST(
      SUBSTRING(id_value FROM LENGTH(prefix) + 7) AS INTEGER
    )
  ), 0) + 1 INTO seq_num
  FROM (
    SELECT container_id AS id_value FROM public.containers WHERE container_id LIKE prefix || '-' || year_part || '-%'
    UNION ALL
    SELECT input_id AS id_value FROM public.material_inputs WHERE input_id LIKE prefix || '-' || year_part || '-%'
    UNION ALL
    SELECT processing_id AS id_value FROM public.processing_steps WHERE processing_id LIKE prefix || '-' || year_part || '-%'
    UNION ALL
    SELECT sample_id AS id_value FROM public.samples WHERE sample_id LIKE prefix || '-' || year_part || '-%'
    UNION ALL
    SELECT output_id AS id_value FROM public.output_materials WHERE output_id LIKE prefix || '-' || year_part || '-%'
    UNION ALL
    SELECT note_id AS id_value FROM public.delivery_notes WHERE note_id LIKE prefix || '-' || year_part || '-%'
    UNION ALL
    SELECT recipe_id AS id_value FROM public.recipes WHERE recipe_id LIKE prefix || '-' || year_part || '-%'
    UNION ALL
    SELECT application_id AS id_value FROM public.applications WHERE application_id LIKE prefix || '-' || year_part || '-%'
    UNION ALL
    SELECT analysis_id AS id_value FROM public.datasheet_analyses WHERE analysis_id LIKE prefix || '-' || year_part || '-%'
  ) combined;
  
  new_id := prefix || '-' || year_part || '-' || LPAD(seq_num::TEXT, 4, '0');
  RETURN new_id;
END;
$function$;