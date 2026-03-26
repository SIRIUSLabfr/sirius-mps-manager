-- 1. Extend locations with hierarchy
ALTER TABLE locations ADD COLUMN parent_id UUID REFERENCES locations(id) ON DELETE CASCADE;
ALTER TABLE locations ADD COLUMN location_type TEXT NOT NULL DEFAULT 'site';

-- 2. Floor plans table
CREATE TABLE floor_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL,
  width INT,
  height INT,
  sort_order INT DEFAULT 0,
  uploaded_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE floor_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can read floor_plans" ON floor_plans FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can insert floor_plans" ON floor_plans FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can update floor_plans" ON floor_plans FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon can delete floor_plans" ON floor_plans FOR DELETE TO anon USING (true);
CREATE POLICY "Auth can read floor_plans" ON floor_plans FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth can insert floor_plans" ON floor_plans FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth can update floor_plans" ON floor_plans FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth can delete floor_plans" ON floor_plans FOR DELETE TO authenticated USING (true);

-- 3. Device placements table
CREATE TABLE device_placements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  floor_plan_id UUID NOT NULL REFERENCES floor_plans(id) ON DELETE CASCADE,
  x_percent DECIMAL(5,2) NOT NULL,
  y_percent DECIMAL(5,2) NOT NULL,
  label TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(device_id, floor_plan_id)
);

ALTER TABLE device_placements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can read device_placements" ON device_placements FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can insert device_placements" ON device_placements FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can update device_placements" ON device_placements FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon can delete device_placements" ON device_placements FOR DELETE TO anon USING (true);
CREATE POLICY "Auth can read device_placements" ON device_placements FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth can insert device_placements" ON device_placements FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth can update device_placements" ON device_placements FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth can delete device_placements" ON device_placements FOR DELETE TO authenticated USING (true);

-- 4. Storage bucket for floor plans
INSERT INTO storage.buckets (id, name, public) VALUES ('floor-plans', 'floor-plans', true);

CREATE POLICY "Anyone can upload floor plans" ON storage.objects FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'floor-plans');
CREATE POLICY "Anyone can read floor plans" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'floor-plans');
CREATE POLICY "Anyone can delete floor plans" ON storage.objects FOR DELETE TO anon, authenticated USING (bucket_id = 'floor-plans');

-- 5. Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE floor_plans;
ALTER PUBLICATION supabase_realtime ADD TABLE device_placements;