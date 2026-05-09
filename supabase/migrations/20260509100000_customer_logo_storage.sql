-- Customer-Logo-Feature: Spalte fuer URL + Storage-Bucket
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS customer_logo_url text;

-- Public Bucket fuer Kunden-Logos. Nur authenticated User schreiben/loeschen,
-- Lesen ist public (Logo wird im PDF-Anhang an Quotes verteilt, der Link
-- muss ohne Login auflösbar sein).
INSERT INTO storage.buckets (id, name, public)
VALUES ('customer-logos', 'customer-logos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Authenticated upload customer logos" ON storage.objects;
CREATE POLICY "Authenticated upload customer logos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'customer-logos');

DROP POLICY IF EXISTS "Authenticated update customer logos" ON storage.objects;
CREATE POLICY "Authenticated update customer logos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'customer-logos');

DROP POLICY IF EXISTS "Authenticated delete customer logos" ON storage.objects;
CREATE POLICY "Authenticated delete customer logos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'customer-logos');

DROP POLICY IF EXISTS "Public read customer logos" ON storage.objects;
CREATE POLICY "Public read customer logos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'customer-logos');
