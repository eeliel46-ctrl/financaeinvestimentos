-- Create table for stock price alerts
CREATE TABLE public.stock_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  ticker VARCHAR(10) NOT NULL,
  target_price DECIMAL(10,2) NOT NULL,
  alert_type VARCHAR(10) NOT NULL DEFAULT 'buy' CHECK (alert_type IN ('buy', 'sell')),
  notify_email BOOLEAN NOT NULL DEFAULT true,
  notify_system BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  triggered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.stock_alerts ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own alerts" 
ON public.stock_alerts 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own alerts" 
ON public.stock_alerts 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own alerts" 
ON public.stock_alerts 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own alerts" 
ON public.stock_alerts 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_stock_alerts_updated_at
BEFORE UPDATE ON public.stock_alerts
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();