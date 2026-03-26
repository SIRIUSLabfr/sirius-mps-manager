
CREATE TABLE public.concepts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT DEFAULT 'MPS Konzept',
  config_json JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.concepts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can read concepts" ON public.concepts FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can insert concepts" ON public.concepts FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can update concepts" ON public.concepts FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon can delete concepts" ON public.concepts FOR DELETE TO anon USING (true);
CREATE POLICY "Auth can read concepts" ON public.concepts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth can insert concepts" ON public.concepts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth can update concepts" ON public.concepts FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth can delete concepts" ON public.concepts FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_concepts_updated_at BEFORE UPDATE ON public.concepts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
