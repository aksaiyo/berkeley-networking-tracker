CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL DEFAULT auth.user_id(),
  name text NOT NULL CHECK (length(trim(name)) > 0),
  company text,
  role text,
  where_met text,
  notes text,
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS contacts_user_id_idx ON public.contacts(user_id);
CREATE INDEX IF NOT EXISTS contacts_user_priority_idx ON public.contacts(user_id, priority);
CREATE INDEX IF NOT EXISTS contacts_user_created_idx ON public.contacts(user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS contacts_set_updated_at ON public.contacts;
CREATE TRIGGER contacts_set_updated_at
BEFORE UPDATE ON public.contacts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS contacts_select_own ON public.contacts;
CREATE POLICY contacts_select_own ON public.contacts
  FOR SELECT TO authenticated
  USING ((SELECT auth.user_id()) = user_id);

DROP POLICY IF EXISTS contacts_insert_own ON public.contacts;
CREATE POLICY contacts_insert_own ON public.contacts
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.user_id()) = user_id);

DROP POLICY IF EXISTS contacts_update_own ON public.contacts;
CREATE POLICY contacts_update_own ON public.contacts
  FOR UPDATE TO authenticated
  USING ((SELECT auth.user_id()) = user_id)
  WITH CHECK ((SELECT auth.user_id()) = user_id);

DROP POLICY IF EXISTS contacts_delete_own ON public.contacts;
CREATE POLICY contacts_delete_own ON public.contacts
  FOR DELETE TO authenticated
  USING ((SELECT auth.user_id()) = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contacts TO authenticated;
