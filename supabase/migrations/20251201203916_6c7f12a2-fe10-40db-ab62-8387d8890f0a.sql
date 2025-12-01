-- Criar tabela de investimentos
CREATE TABLE public.investments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  ticker TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  purchase_price NUMERIC NOT NULL,
  purchase_date TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar Row Level Security
ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;

-- Criar políticas para acesso dos usuários aos seus próprios investimentos
CREATE POLICY "Usuários podem visualizar seus próprios investimentos" 
ON public.investments 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem criar seus próprios investimentos" 
ON public.investments 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar seus próprios investimentos" 
ON public.investments 
FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem deletar seus próprios investimentos" 
ON public.investments 
FOR DELETE 
USING (auth.uid() = user_id);

-- Criar função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Criar trigger para atualizar updated_at
CREATE TRIGGER set_updated_at
BEFORE UPDATE ON public.investments
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Criar índice para melhorar performance das consultas por user_id
CREATE INDEX idx_investments_user_id ON public.investments(user_id);