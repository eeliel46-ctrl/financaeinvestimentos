-- Fix stock_alerts constraint to match application logic
ALTER TABLE public.stock_alerts DROP CONSTRAINT IF EXISTS stock_alerts_alert_type_check;

ALTER TABLE public.stock_alerts 
  ADD CONSTRAINT stock_alerts_alert_type_check 
  CHECK (alert_type IN ('buy', 'sell'));
