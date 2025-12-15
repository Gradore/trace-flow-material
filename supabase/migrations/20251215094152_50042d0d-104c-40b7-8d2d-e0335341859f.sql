-- Erweitere app_role enum um neue Rollen (separate Migration)
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'supplier';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'logistics';