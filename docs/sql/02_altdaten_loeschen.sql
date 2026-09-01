-- =====================================================================
--  RekuFLOW — Altbestände löschen, Neustart ab dem Stichtag
--
--  Löscht alle operativen Datensätze, die VOR dem Stichtag angelegt
--  wurden. Die Stammdaten des GFK-Projektmoduls (Partner, Phasen,
--  Aufgaben, Fraktionen, Mailvorlagen) bleiben erhalten — sie werden mit
--  01_datenbank_aktualisieren.sql frisch eingespielt.
--
--  ANWENDUNG
--  Erst 01_datenbank_aktualisieren.sql ausführen, danach dieses Skript.
--  Supabase Dashboard -> SQL Editor -> New query -> einfügen -> Run.
--
--  !!! NICHT UMKEHRBAR — vorher ein Backup anlegen:
--      Supabase Dashboard -> Database -> Backups
-- =====================================================================

BEGIN;

-- Stichtag: alles davor wird gelöscht. Anpassen, falls ein anderer Tag gilt.
CREATE TEMP TABLE cutoff AS SELECT DATE '2026-08-31' AS d;

-- ---------------------------------------------------------------- Abhängige Sätze
DELETE FROM public.sample_results r
 USING public.samples s, cutoff c
 WHERE r.sample_id = s.id AND s.created_at < c.d;

DELETE FROM public.material_flow_history h USING cutoff c WHERE h.created_at < c.d;
DELETE FROM public.documents d USING cutoff c WHERE d.created_at < c.d;
DELETE FROM public.batch_allocations b USING cutoff c WHERE b.created_at < c.d;
DELETE FROM public.order_recipe_matches m USING cutoff c WHERE m.created_at < c.d;

-- ---------------------------------------------------------------- Materialfluss
DELETE FROM public.delivery_notes n USING cutoff c WHERE n.created_at < c.d;
DELETE FROM public.samples s USING cutoff c WHERE s.created_at < c.d;
DELETE FROM public.output_materials o USING cutoff c WHERE o.created_at < c.d;
DELETE FROM public.processing_steps p USING cutoff c WHERE p.created_at < c.d;
DELETE FROM public.material_inputs i USING cutoff c WHERE i.created_at < c.d;
DELETE FROM public.containers ct USING cutoff c WHERE ct.created_at < c.d;

-- ---------------------------------------------------------------- Aufträge & Portale
DELETE FROM public.orders o USING cutoff c WHERE o.created_at < c.d;
DELETE FROM public.material_announcements a USING cutoff c WHERE a.created_at < c.d;
DELETE FROM public.pickup_requests r USING cutoff c WHERE r.created_at < c.d;

-- ---------------------------------------------------------------- KI-Nebenprodukte & Protokolle
DELETE FROM public.datasheet_analyses a USING cutoff c WHERE a.created_at < c.d;
DELETE FROM public.manufacturer_matches m USING cutoff c WHERE m.created_at < c.d;
DELETE FROM public.notifications n USING cutoff c WHERE n.created_at < c.d;
DELETE FROM public.audit_logs l USING cutoff c WHERE l.created_at < c.d;

-- ---------------------------------------------------------------- Wartung
DELETE FROM public.maintenance_records m USING cutoff c WHERE m.created_at < c.d;

-- ---------------------------------------------------------------- Verwaiste Reste
-- Sätze, deren übergeordneter Datensatz gerade entfernt wurde.
DELETE FROM public.sample_results r
 WHERE NOT EXISTS (SELECT 1 FROM public.samples s WHERE s.id = r.sample_id);

COMMIT;

-- ---------------------------------------------------------------- Kontrolle
SELECT 'containers' AS tabelle, count(*) FROM public.containers
UNION ALL SELECT 'material_inputs', count(*) FROM public.material_inputs
UNION ALL SELECT 'processing_steps', count(*) FROM public.processing_steps
UNION ALL SELECT 'samples', count(*) FROM public.samples
UNION ALL SELECT 'output_materials', count(*) FROM public.output_materials
UNION ALL SELECT 'delivery_notes', count(*) FROM public.delivery_notes
UNION ALL SELECT 'documents', count(*) FROM public.documents
UNION ALL SELECT 'orders', count(*) FROM public.orders
UNION ALL SELECT 'maintenance_records', count(*) FROM public.maintenance_records
UNION ALL SELECT '— Projektpartner (bleibt)', count(*) FROM public.project_partners
UNION ALL SELECT '— Projektaufgaben (bleibt)', count(*) FROM public.project_tasks
ORDER BY 1;
