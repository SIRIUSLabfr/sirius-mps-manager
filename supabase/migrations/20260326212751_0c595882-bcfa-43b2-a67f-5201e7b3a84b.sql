
-- Templates table
CREATE TABLE public.calculation_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.calculation_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can read calculation_templates" ON public.calculation_templates FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can insert calculation_templates" ON public.calculation_templates FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can update calculation_templates" ON public.calculation_templates FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon can delete calculation_templates" ON public.calculation_templates FOR DELETE TO anon USING (true);
CREATE POLICY "Auth can read calculation_templates" ON public.calculation_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth can insert calculation_templates" ON public.calculation_templates FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth can update calculation_templates" ON public.calculation_templates FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth can delete calculation_templates" ON public.calculation_templates FOR DELETE TO authenticated USING (true);

-- Add label and is_active to calculations for scenario support
ALTER TABLE public.calculations ADD COLUMN IF NOT EXISTS label TEXT DEFAULT NULL;
ALTER TABLE public.calculations ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
