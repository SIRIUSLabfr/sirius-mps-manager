-- Neue Picklist-Felder fuer die Abwicklungs-Vertragsdaten:
--   leasing_provider  → maps to Vertr_ge.Leasinggeber
--   payment_method    → maps to Vertr_ge.Zahlungsweise

ALTER TABLE public.order_processing
  ADD COLUMN IF NOT EXISTS leasing_provider text,
  ADD COLUMN IF NOT EXISTS payment_method text;
