
CREATE TABLE public.centres (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  code text,
  location text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.centres TO anon, authenticated;
GRANT ALL ON public.centres TO service_role;
ALTER TABLE public.centres ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_all_centres" ON public.centres FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.yard_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid NOT NULL REFERENCES public.centres(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (centre_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.yard_positions TO anon, authenticated;
GRANT ALL ON public.yard_positions TO service_role;
ALTER TABLE public.yard_positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_all_yard_positions" ON public.yard_positions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.size_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL UNIQUE,
  teu numeric NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.size_options TO anon, authenticated;
GRANT ALL ON public.size_options TO service_role;
ALTER TABLE public.size_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_all_size_options" ON public.size_options FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.type_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL UNIQUE,
  subtypes text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.type_options TO anon, authenticated;
GRANT ALL ON public.type_options TO service_role;
ALTER TABLE public.type_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_all_type_options" ON public.type_options FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.rakes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rake_name text NOT NULL,
  rake_id text,
  rake_basing text,
  bpc_due_date date,
  ownership text NOT NULL DEFAULT 'Owned',
  wagons integer,
  current_user_type text NOT NULL DEFAULT 'Self',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rakes TO anon, authenticated;
GRANT ALL ON public.rakes TO service_role;
ALTER TABLE public.rakes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_all_rakes" ON public.rakes FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.containers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid NOT NULL REFERENCES public.centres(id) ON DELETE CASCADE,
  container_no text NOT NULL,
  mode text,
  rail_ownership text,
  rake_name text,
  size text,
  ctr_type text,
  dry_subtype text,
  ownership text,
  status text,
  weight numeric,
  condition text,
  in_date date,
  in_time text,
  cargo text,
  category text,
  account text,
  yard_position text,
  out_mode text,
  out_rail_ownership text,
  out_rake_name text,
  out_date date,
  out_time text,
  dispatched boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX containers_centre_idx ON public.containers(centre_id);
CREATE INDEX containers_no_idx ON public.containers(container_no);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.containers TO anon, authenticated;
GRANT ALL ON public.containers TO service_role;
ALTER TABLE public.containers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_all_containers" ON public.containers FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid REFERENCES public.centres(id) ON DELETE SET NULL,
  centre_name text,
  action text NOT NULL,
  details text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX activity_logs_centre_idx ON public.activity_logs(centre_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.activity_logs TO anon, authenticated;
GRANT ALL ON public.activity_logs TO service_role;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_all_activity_logs" ON public.activity_logs FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;
CREATE TRIGGER containers_updated_at BEFORE UPDATE ON public.containers
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.centres (name) VALUES
('RWC KOKG'),('PLPC'),('CWCN'),('SFA'),('NDT'),('DGSN'),
('GIMB'),('CW KGP'),('MVI CRT'),('NCLW'),('CW Mundra'),('PISK');

INSERT INTO public.size_options (label, teu) VALUES ('20ft',1),('40ft',2),('45ft',2);
INSERT INTO public.type_options (label, subtypes) VALUES
('Dry', ARRAY['GP','HC']),('Reefer','{}'),('Open Top','{}'),
('Side Access','{}'),('Flat Rack','{}'),('Tank','{}');
