import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Download } from "lucide-react";

const Auth = () => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLogin, setIsLogin] = useState(true);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Se já estiver logado, redireciona para home
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/");
      }
    });

    // PWA install prompt
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, [navigate]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      toast.success("Aplicativo instalando...");
    }
  };

  const handleLogin = async () => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) throw error;

      if (data.session) {
        toast.success("Login realizado com sucesso!");
        navigate("/");
      }
    } catch (error: any) {
      console.error("Erro no login:", error);

      // Detectar erro de email não confirmado
      if (error.message?.includes("Email not confirmed") || error.message?.includes("Invalid login credentials")) {
        toast.error(
          "Email não confirmado. Verifique sua caixa de entrada e clique no link de confirmação.",
          { duration: 6000 }
        );
      } else {
        toast.error(error.message || "Erro ao fazer login. Verifique suas credenciais.");
      }
    }
  };

  const handleSignUp = async () => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (error) throw error;

      if (data.user) {
        // Mensagem mais clara sobre verificação de email
        toast.success(
          "Cadastro realizado! Verifique seu email para confirmar sua conta antes de fazer login.",
          { duration: 8000 }
        );
        toast.info(
          "📧 Não esqueça de verificar a pasta de spam caso não encontre o email.",
          { duration: 8000 }
        );
        setIsLogin(true);
        setPassword("");
      }
    } catch (error: any) {
      console.error("Erro no cadastro:", error);

      // Mensagens de erro mais específicas
      if (error.message?.includes("invalid")) {
        toast.error("Email inválido. Use um endereço de email real (ex: seuemail@gmail.com).");
      } else {
        toast.error(error.message || "Erro ao criar conta.");
      }
    }
  };



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      toast.error("Preencha email e senha");
      return;
    }

    if (password.length < 6) {
      toast.error("A senha deve ter no mínimo 6 caracteres");
      return;
    }

    setLoading(true);

    try {
      if (isLogin) {
        await handleLogin();
      } else {
        await handleSignUp();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">
            {isLogin ? "Bem-vindo" : "Criar Conta"}
          </CardTitle>
          <CardDescription>
            {isLogin
              ? "Entre com suas credenciais"
              : "Preencha os dados para criar sua conta"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <Input
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Senha</label>
              <Input
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                disabled={loading}
              />
            </div>
            <Button
              className="w-full"
              type="submit"
              disabled={loading}
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processando...
                </>
              ) : (
                <>{isLogin ? "Entrar" : "Criar Conta"}</>
              )}
            </Button>

            {deferredPrompt && (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleInstallClick}
                size="lg"
              >
                <Download className="mr-2 h-4 w-4" />
                Baixar Aplicativo
              </Button>
            )}

            <div className="text-center text-sm pt-2">
              <button
                type="button"
                className="text-primary hover:underline font-medium"
                onClick={() => {
                  setIsLogin(!isLogin);
                  setPassword("");
                }}
                disabled={loading}
              >
                {isLogin
                  ? "Não tem conta? Cadastre-se"
                  : "Já tem conta? Faça login"}
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
