-- Nachkalkulation: Gesamtertrag + Aufteilung Hardware/Service.
-- gross_margin       wird beim Resync aus calculations.margin_total uebernommen
--                    und ist in der Abwicklung selbst schreibgeschuetzt.
-- margin_hardware    + margin_service muessen zusammen gross_margin ergeben
--                    (UI-Constraint, kein DB-Check, damit Zwischenstaende beim
--                    Speichern nicht abgelehnt werden).

ALTER TABLE public.order_processing
  ADD COLUMN IF NOT EXISTS gross_margin numeric,
  ADD COLUMN IF NOT EXISTS margin_hardware numeric,
  ADD COLUMN IF NOT EXISTS margin_service numeric;
