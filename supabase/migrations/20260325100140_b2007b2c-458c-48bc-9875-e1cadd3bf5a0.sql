-- =============================================
-- SIRIUS MPS Manager – Full Schema
-- =============================================

-- 1. Organizations
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  zoho_org_id TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read organizations" ON public.organizations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert organizations" ON public.organizations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update organizations" ON public.organizations FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete organizations" ON public.organizations FOR DELETE TO authenticated USING (true);

-- 2. Users
CREATE TABLE public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  full_name TEXT,
  short_code TEXT,
  role TEXT NOT NULL CHECK (role IN ('admin', 'project_lead', 'technician', 'viewer')),
  organization_id UUID REFERENCES public.organizations(id),
  zoho_user_id TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read users" ON public.users FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert users" ON public.users FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update users" ON public.users FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete users" ON public.users FOR DELETE TO authenticated USING (true);

-- 3. Projects
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id),
  zoho_deal_id TEXT,
  customer_name TEXT NOT NULL,
  customer_number TEXT,
  project_number TEXT,
  project_name TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'planning', 'preparation', 'rollout_active', 'completed', 'cancelled')),
  rollout_start DATE,
  rollout_end DATE,
  project_lead UUID REFERENCES public.users(id),
  technicians UUID[],
  customer_contacts JSONB DEFAULT '[]'::jsonb,
  warehouse_address TEXT,
  logistics_notes TEXT,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read projects" ON public.projects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert projects" ON public.projects FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update projects" ON public.projects FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete projects" ON public.projects FOR DELETE TO authenticated USING (true);

-- 4. Locations
CREATE TABLE public.locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  short_name TEXT,
  address_street TEXT,
  address_zip TEXT,
  address_city TEXT,
  address_country TEXT DEFAULT 'DE',
  building TEXT,
  notes TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read locations" ON public.locations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert locations" ON public.locations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update locations" ON public.locations FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete locations" ON public.locations FOR DELETE TO authenticated USING (true);

-- 5. Devices
CREATE TABLE public.devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  location_id UUID REFERENCES public.locations(id),
  device_number INT,
  customer_device_number TEXT,
  ist_manufacturer TEXT,
  ist_model TEXT,
  ist_serial TEXT,
  ist_ip TEXT,
  ist_inventory_number TEXT,
  ist_floor TEXT,
  ist_room TEXT,
  ist_building TEXT,
  ist_pickup BOOLEAN DEFAULT false,
  ist_source TEXT,
  soll_manufacturer TEXT,
  soll_model TEXT,
  soll_serial TEXT,
  soll_device_id TEXT,
  soll_options TEXT,
  soll_floor TEXT,
  soll_room TEXT,
  soll_building TEXT,
  soll_accessories TEXT,
  zoho_product_id TEXT,
  optimization_type TEXT CHECK (optimization_type IN ('OneToOne', 'Umzug', 'Keep', 'Neuaufstellung', 'Nicht im Projekt', 'Abbau')),
  mapped_to_device_id UUID REFERENCES public.devices(id),
  delivery_date DATE,
  rollout_day INT,
  preparation_status TEXT NOT NULL DEFAULT 'pending' CHECK (preparation_status IN ('pending', 'in_progress', 'prepared', 'delivered', 'installed', 'checked')),
  prepared_by UUID REFERENCES public.users(id),
  preparation_notes TEXT,
  final_check TEXT,
  final_check_notes TEXT,
  notes TEXT,
  gegebenheiten TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read devices" ON public.devices FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert devices" ON public.devices FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update devices" ON public.devices FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete devices" ON public.devices FOR DELETE TO authenticated USING (true);

-- 6. SOP Orders
CREATE TABLE public.sop_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  device_id UUID REFERENCES public.devices(id),
  ow_number TEXT,
  creator TEXT,
  delivery_date DATE,
  delivery_time TIME,
  end_check_date DATE,
  end_check_time TIME,
  customer_address TEXT,
  delivery_address TEXT,
  contact_person TEXT,
  room TEXT,
  floor TEXT,
  manufacturer TEXT,
  model TEXT,
  serial_number TEXT,
  device_internal_id TEXT,
  consumables TEXT,
  options TEXT,
  licenses TEXT,
  network_settings TEXT,
  preparation_status TEXT NOT NULL DEFAULT 'pending',
  technician UUID REFERENCES public.users(id),
  work_started BOOLEAN DEFAULT false,
  delivery_status TEXT NOT NULL DEFAULT 'pending',
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.sop_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read sop_orders" ON public.sop_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert sop_orders" ON public.sop_orders FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update sop_orders" ON public.sop_orders FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete sop_orders" ON public.sop_orders FOR DELETE TO authenticated USING (true);

-- 7. IT Config
CREATE TABLE public.it_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE UNIQUE,
  it_contact_internal TEXT,
  it_contact_external TEXT,
  external_it_company TEXT,
  scan_methods TEXT[],
  scan_smb_server TEXT,
  scan_smb_user TEXT,
  scan_smb_shared BOOLEAN,
  scan_smtp_server TEXT,
  scan_smtp_port TEXT,
  scan_smtp_auth BOOLEAN,
  scan_smtp_sender TEXT,
  scan_ftp_server TEXT,
  scan_ftp_path TEXT,
  scan_ftp_user TEXT,
  software_fleet_server TEXT,
  software_fleet_proxy TEXT,
  software_scan_name TEXT,
  software_scan_server TEXT,
  software_print_name TEXT,
  software_print_server TEXT,
  software_followme_system TEXT,
  software_followme_server TEXT,
  card_reader_type TEXT,
  training_type TEXT[],
  it_notes TEXT,
  software_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.it_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read it_config" ON public.it_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert it_config" ON public.it_config FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update it_config" ON public.it_config FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete it_config" ON public.it_config FOR DELETE TO authenticated USING (true);

-- 8. Checklists
CREATE TABLE public.checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  checklist_type TEXT NOT NULL CHECK (checklist_type IN ('it_walkthrough', 'pre_rollout', 'post_rollout')),
  items JSONB DEFAULT '[]'::jsonb,
  walkthrough_date DATE,
  participants TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.checklists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read checklists" ON public.checklists FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert checklists" ON public.checklists FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update checklists" ON public.checklists FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete checklists" ON public.checklists FOR DELETE TO authenticated USING (true);

-- 9. Rollout Logistics
CREATE TABLE public.rollout_logistics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  rollout_day INT NOT NULL,
  date DATE,
  departure_time TIME,
  collection_point TEXT,
  daily_contact TEXT,
  vehicles JSONB DEFAULT '[]'::jsonb,
  transport_notes TEXT,
  safety_instructions TEXT,
  hygiene_requirements TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.rollout_logistics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read rollout_logistics" ON public.rollout_logistics FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert rollout_logistics" ON public.rollout_logistics FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update rollout_logistics" ON public.rollout_logistics FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete rollout_logistics" ON public.rollout_logistics FOR DELETE TO authenticated USING (true);

-- 10. File Imports
CREATE TABLE public.file_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  file_name TEXT,
  file_type TEXT CHECK (file_type IN ('excel', 'csv', 'pdf')),
  file_url TEXT,
  import_status TEXT DEFAULT 'pending',
  parsed_data JSONB,
  column_mapping JSONB,
  row_count INT,
  imported_device_count INT,
  error_log TEXT,
  imported_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.file_imports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read file_imports" ON public.file_imports FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert file_imports" ON public.file_imports FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update file_imports" ON public.file_imports FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete file_imports" ON public.file_imports FOR DELETE TO authenticated USING (true);

-- 11. Calculations
CREATE TABLE public.calculations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  finance_type TEXT DEFAULT 'leasing',
  term_months INT DEFAULT 60,
  leasing_factor DECIMAL(8,6),
  margin_total DECIMAL(10,2),
  old_rate DECIMAL(10,2),
  old_net_value DECIMAL(10,2),
  old_remaining_months INT,
  total_hardware_ek DECIMAL(10,2),
  total_monthly_rate DECIMAL(10,2),
  service_rate DECIMAL(10,2),
  config_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.calculations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read calculations" ON public.calculations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert calculations" ON public.calculations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update calculations" ON public.calculations FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete calculations" ON public.calculations FOR DELETE TO authenticated USING (true);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Apply updated_at triggers
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_devices_updated_at BEFORE UPDATE ON public.devices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_sop_orders_updated_at BEFORE UPDATE ON public.sop_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_it_config_updated_at BEFORE UPDATE ON public.it_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_checklists_updated_at BEFORE UPDATE ON public.checklists FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_calculations_updated_at BEFORE UPDATE ON public.calculations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable Realtime for specified tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.devices;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sop_orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.checklists;