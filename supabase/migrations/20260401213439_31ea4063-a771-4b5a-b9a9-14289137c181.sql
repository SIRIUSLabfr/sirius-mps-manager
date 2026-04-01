
-- Documents table
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INT,
  version INT DEFAULT 1,
  zoho_attachment_id TEXT,
  notes TEXT,
  uploaded_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can read documents" ON public.documents FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can insert documents" ON public.documents FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can update documents" ON public.documents FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon can delete documents" ON public.documents FOR DELETE TO anon USING (true);
CREATE POLICY "Auth can read documents" ON public.documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth can insert documents" ON public.documents FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth can update documents" ON public.documents FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth can delete documents" ON public.documents FOR DELETE TO authenticated USING (true);

-- Notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  read BOOLEAN DEFAULT false,
  link TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can read notifications" ON public.notifications FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can insert notifications" ON public.notifications FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can update notifications" ON public.notifications FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon can delete notifications" ON public.notifications FOR DELETE TO anon USING (true);
CREATE POLICY "Auth can read notifications" ON public.notifications FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth can insert notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth can update notifications" ON public.notifications FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth can delete notifications" ON public.notifications FOR DELETE TO authenticated USING (true);

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Extend projects table
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS order_confirmed_at TIMESTAMPTZ;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS order_confirmed_by TEXT;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS signed_document_id UUID;

-- Storage bucket for project documents
INSERT INTO storage.buckets (id, name, public) VALUES ('project-documents', 'project-documents', true);

-- Storage RLS
CREATE POLICY "Anyone can upload project docs" ON storage.objects FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'project-documents');
CREATE POLICY "Anyone can read project docs" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'project-documents');
CREATE POLICY "Anyone can delete project docs" ON storage.objects FOR DELETE TO anon, authenticated USING (bucket_id = 'project-documents');
