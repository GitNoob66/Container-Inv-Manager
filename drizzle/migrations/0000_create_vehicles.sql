CREATE TABLE public.vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid NOT NULL REFERENCES public.centres(id) ON DELETE CASCADE,
  vehicle_no text NOT NULL,
  vehicle_type text,
  transporter text,
  driver_name text,
  driver_phone text,
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (centre_id, vehicle_no)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicles TO anon, authenticated;
GRANT ALL ON public.vehicles TO service_role;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Open access to vehicles" ON public.vehicles FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);