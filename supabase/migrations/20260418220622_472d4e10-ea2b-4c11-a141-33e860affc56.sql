ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS zoho_estimate_id text;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS zoho_sales_order_id text;
ALTER TABLE public.devices ADD COLUMN IF NOT EXISTS from_quote_item_id text;
ALTER TABLE public.devices ADD COLUMN IF NOT EXISTS pushed_to_sop_at timestamptz;