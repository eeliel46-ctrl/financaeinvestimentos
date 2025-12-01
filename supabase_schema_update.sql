-- 1. Adicionar a coluna user_id na tabela expenses
ALTER TABLE expenses 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- 2. Habilitar Row Level Security (RLS) para segurança
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- 3. Criar política para permitir que usuários vejam apenas seus próprios dados
CREATE POLICY "Usuários podem ver apenas suas próprias despesas"
ON expenses
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 4. (Opcional) Atualizar registros existentes para o usuário atual (se você estiver logado e quiser assumir os dados antigos)
-- Substitua 'SEU_ID_DE_USUARIO' pelo seu ID real se necessário, ou rode isso manualmente depois.
-- UPDATE expenses SET user_id = auth.uid() WHERE user_id IS NULL;
