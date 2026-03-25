
-- Allow anon (unauthenticated) read access to all tables for embedded Zoho usage
CREATE POLICY "Anon can read projects" ON public.projects FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can insert projects" ON public.projects FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can update projects" ON public.projects FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon can delete projects" ON public.projects FOR DELETE TO anon USING (true);

CREATE POLICY "Anon can read devices" ON public.devices FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can insert devices" ON public.devices FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can update devices" ON public.devices FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon can delete devices" ON public.devices FOR DELETE TO anon USING (true);

CREATE POLICY "Anon can read locations" ON public.locations FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can insert locations" ON public.locations FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can update locations" ON public.locations FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon can delete locations" ON public.locations FOR DELETE TO anon USING (true);

CREATE POLICY "Anon can read sop_orders" ON public.sop_orders FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can insert sop_orders" ON public.sop_orders FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can update sop_orders" ON public.sop_orders FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon can delete sop_orders" ON public.sop_orders FOR DELETE TO anon USING (true);

CREATE POLICY "Anon can read checklists" ON public.checklists FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can insert checklists" ON public.checklists FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can update checklists" ON public.checklists FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon can delete checklists" ON public.checklists FOR DELETE TO anon USING (true);

CREATE POLICY "Anon can read it_config" ON public.it_config FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can insert it_config" ON public.it_config FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can update it_config" ON public.it_config FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon can delete it_config" ON public.it_config FOR DELETE TO anon USING (true);

CREATE POLICY "Anon can read rollout_logistics" ON public.rollout_logistics FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can insert rollout_logistics" ON public.rollout_logistics FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can update rollout_logistics" ON public.rollout_logistics FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon can delete rollout_logistics" ON public.rollout_logistics FOR DELETE TO anon USING (true);

CREATE POLICY "Anon can read calculations" ON public.calculations FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can insert calculations" ON public.calculations FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can update calculations" ON public.calculations FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon can delete calculations" ON public.calculations FOR DELETE TO anon USING (true);

CREATE POLICY "Anon can read users" ON public.users FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can insert users" ON public.users FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can update users" ON public.users FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon can delete users" ON public.users FOR DELETE TO anon USING (true);

CREATE POLICY "Anon can read file_imports" ON public.file_imports FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can insert file_imports" ON public.file_imports FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can update file_imports" ON public.file_imports FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon can delete file_imports" ON public.file_imports FOR DELETE TO anon USING (true);

CREATE POLICY "Anon can read organizations" ON public.organizations FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can insert organizations" ON public.organizations FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can update organizations" ON public.organizations FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon can delete organizations" ON public.organizations FOR DELETE TO anon USING (true);
