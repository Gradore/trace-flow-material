-- =====================================================================
--  RekuFLOW — Altbestände löschen, Neustart ab dem Stichtag
--
--  Löscht ALLE Datensätze, die VOR dem Stichtag angelegt wurden —
--  Bewegungsdaten, Anlagen, Rezepturen, Firmen und Kontakte.
--
--  ERHALTEN BLEIBEN
--   * Benutzerkonten, Rollen und Berechtigungen (profiles, user_roles,
--     user_permissions) — niemand verliert seinen Zugang.
--   * Die Stammdaten des GFK-Projektmoduls (Partner, Phasen, Aufgaben,
--     Fraktionen, Mailvorlagen) — die kommen aus 01_datenbank_aktualisieren.sql.
--
--  FOLGE DES FIRMEN-LÖSCHENS
--  Kunden-, Lieferanten- und Logistikkonten verlieren ihre Firmenzuordnung
--  (sie hängt an contacts.user_id) und sehen in ihren Portalen nichts mehr,
--  bis Sie sie unter Verwaltung -> Benutzer neu zuordnen.
--  Die Verknüpfung project_partners.company_id wird dabei nur geleert,
--  die Projektpartner selbst bleiben vollständig erhalten.
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

-- ---------------------------------------------------------------- Stammdaten
-- Reihenfolge nach Fremdschlüsseln: erst die Sätze, die ohne ON DELETE-Regel
-- auf companies/contacts zeigen, dann die Stammtabellen selbst.
DELETE FROM public.pending_registrations r USING cutoff c WHERE r.created_at < c.d;
DELETE FROM public.company_contracts k USING cutoff c WHERE k.created_at < c.d;
DELETE FROM public.company_documents d USING cutoff c WHERE d.created_at < c.d;

-- Anlagen: maintenance_records hängt mit ON DELETE CASCADE daran.
DELETE FROM public.equipment e USING cutoff c WHERE e.created_at < c.d;

-- Rezepturen und Anwendungen: order_recipe_matches wird dabei auf NULL gesetzt.
DELETE FROM public.recipes r USING cutoff c WHERE r.created_at < c.d;
DELETE FROM public.applications a USING cutoff c WHERE a.created_at < c.d;

-- Firmen und Kontakte zuletzt. contacts, company_contracts und
-- company_documents hängen mit ON DELETE CASCADE an companies;
-- project_partners.company_id wird nur geleert.
DELETE FROM public.contacts k USING cutoff c WHERE k.created_at < c.d;
DELETE FROM public.companies f USING cutoff c WHERE f.created_at < c.d;

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
UNION ALL SELECT 'equipment', count(*) FROM public.equipment
UNION ALL SELECT 'recipes', count(*) FROM public.recipes
UNION ALL SELECT 'companies', count(*) FROM public.companies
UNION ALL SELECT 'contacts', count(*) FROM public.contacts
UNION ALL SELECT '— Benutzer (bleibt)', count(*) FROM public.profiles
UNION ALL SELECT '— Rollen (bleibt)', count(*) FROM public.user_roles
UNION ALL SELECT '— Projektpartner (bleibt)', count(*) FROM public.project_partners
UNION ALL SELECT '— Projektaufgaben (bleibt)', count(*) FROM public.project_tasks
ORDER BY 1;
