
CREATE TABLE public.order_processing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  zoho_sales_order_id TEXT,
  subject TEXT,
  order_number TEXT,
  order_date DATE,
  contract_type TEXT,
  finance_type TEXT,
  term_months INT,
  factor DECIMAL(8,4),
  rate DECIMAL(10,2),
  maintenance_share DECIMAL(10,2),
  leasing_share DECIMAL(10,2),
  goods_value DECIMAL(10,2),
  contract_start DATE,
  contract_end DATE,
  leasing_contract_nr TEXT,
  sx_contract_nr TEXT,
  offer_order_nr TEXT,
  request_nr TEXT,
  takeover_date DATE,
  serial_number TEXT,
  device_id TEXT,
  signing_authority TEXT,
  site_conditions TEXT,
  old_device_pickup TEXT,
  purchase_order TEXT,
  billing_street TEXT,
  billing_zip TEXT,
  billing_city TEXT,
  free_start_phase TEXT,
  counter_interval TEXT,
  bank_interval TEXT,
  status TEXT DEFAULT 'offen',
  steps JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.order_processing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can read order_processing" ON public.order_processing FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can insert order_processing" ON public.order_processing FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can update order_processing" ON public.order_processing FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon can delete order_processing" ON public.order_processing FOR DELETE TO anon USING (true);
CREATE POLICY "Auth can read order_processing" ON public.order_processing FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth can insert order_processing" ON public.order_processing FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth can update order_processing" ON public.order_processing FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth can delete order_processing" ON public.order_processing FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_order_processing_updated_at BEFORE UPDATE ON public.order_processing FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
