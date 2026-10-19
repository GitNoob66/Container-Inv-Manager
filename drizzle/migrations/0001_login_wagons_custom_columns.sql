CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

ALTER TABLE public.containers
  ADD COLUMN IF NOT EXISTS truck_no text,
  ADD COLUMN IF NOT EXISTS seal_no text,
  ADD COLUMN IF NOT EXISTS inward_bill_no text,
  ADD COLUMN IF NOT EXISTS net_weight numeric,
  ADD COLUMN IF NOT EXISTS lessor text,
  ADD COLUMN IF NOT EXISTS wagon_no text,
  ADD COLUMN IF NOT EXISTS stack text,
  ADD COLUMN IF NOT EXISTS double_stack boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS out_truck_no text,
  ADD COLUMN IF NOT EXISTS out_wagon_no text,
  ADD COLUMN IF NOT EXISTS out_stack text,
  ADD COLUMN IF NOT EXISTS out_double_stack boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS iso_valid boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS custom_fields jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.rakes ADD COLUMN IF NOT EXISTS rake_type text;

CREATE TABLE public.custom_columns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid NOT NULL REFERENCES public.centres(id) ON DELETE CASCADE,
  key text NOT NULL,
  label text NOT NULL,
  kind text NOT NULL DEFAULT 'text',
  options text[] NOT NULL DEFAULT '{}'::text[],
  builtin boolean NOT NULL DEFAULT false,
  hidden boolean NOT NULL DEFAULT false,
  sort integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (centre_id, key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_columns TO anon, authenticated;
GRANT ALL ON public.custom_columns TO service_role;
ALTER TABLE public.custom_columns ENABLE ROW LEVEL SECURITY;
CREATE POLICY public_all_custom_columns ON public.custom_columns FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.access_passwords (
  subject text PRIMARY KEY,
  password_hash text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.access_passwords TO service_role;
ALTER TABLE public.access_passwords ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.verify_access(_subject text, _password text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE h text;
BEGIN
  SELECT password_hash INTO h FROM public.access_passwords WHERE subject = _subject;
  IF h IS NOT NULL THEN
    RETURN extensions.crypt(_password, h) = h;
  END IF;
  IF _subject = 'admin' THEN
    RETURN _password = 'admin123';
  END IF;
  RETURN EXISTS (SELECT 1 FROM public.centres WHERE id::text = _subject AND lower(name) = _password);
END $$;

CREATE OR REPLACE FUNCTION public.set_access_password(_admin_password text, _subject text, _new_password text)
RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, extensions AS $$
BEGIN
  IF NOT public.verify_access('admin', _admin_password) THEN
    RAISE EXCEPTION 'The admin password is incorrect.';
  END IF;
  IF _new_password IS NULL OR length(_new_password) < 4 THEN
    RAISE EXCEPTION 'The new password must have at least 4 characters.';
  END IF;
  INSERT INTO public.access_passwords(subject, password_hash, updated_at)
  VALUES (_subject, extensions.crypt(_new_password, extensions.gen_salt('bf')), now())
  ON CONFLICT (subject) DO UPDATE SET password_hash = EXCLUDED.password_hash, updated_at = now();
END $$;

GRANT EXECUTE ON FUNCTION public.verify_access(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_access_password(text, text, text) TO anon, authenticated;