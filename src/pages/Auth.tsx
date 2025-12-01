import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const Auth = () => {
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isLogin, setIsLogin] = useState(true);
    const navigate = useNavigate();

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            if (isLogin) {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (error) throw error;
                navigate("/");
            } else {
                console.log("🔵 Tentando cadastrar:", email);
                const { data, error } = await supabase.auth.signUp({
                    email,
                    password,
                });
                console.log("🔵 Resposta do cadastro:", { data, error });

                if (error) throw error;

                if (data.user) {
                    console.log("✅ Usuário criado com sucesso:", data.user.id);
                    toast.success("Cadastro realizado com sucesso! Faça login para acessar.");
                    setIsLogin(true);
                } else {
                    console.warn("⚠️ Cadastro sem erro mas sem usuário retornado");
                    toast.warning("Cadastro pode ter sido realizado. Tente fazer login.");
                    setIsLogin(true);
                }
            }
        } catch (error: any) {
            console.error("❌ Auth error:", error);
            let errorMessage = "Erro na autenticação";
            if (error.message.includes("Invalid login credentials")) {
                errorMessage = "Email ou senha incorretos.";
            } else if (error.message.includes("Email not confirmed")) {
                errorMessage = "Este email precisa ser confirmado.";
            } else if (error.message.includes("User already registered")) {
                errorMessage = "Este email já está cadastrado.";
            }
            toast.error(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle>{isLogin ? "Login" : "Cadastro"}</CardTitle>
                    <CardDescription>
                        {isLogin
                            ? "Entre para acessar suas finanças"
                            : "Crie sua conta para começar"}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleAuth} className="space-y-4">
                        <div className="space-y-2">
                            <Input
                                type="email"
                                placeholder="Email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Input
                                type="password"
                                placeholder="Senha"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>
                        <Button className="w-full" type="submit" disabled={loading}>
                            {loading ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : null}
                            {isLogin ? "Entrar" : "Cadastrar"}
                        </Button>
                        <div className="text-center text-sm">
                            <button
                                type="button"
                                className="text-primary hover:underline"
                                onClick={() => setIsLogin(!isLogin)}
                            >
                                {isLogin
                                    ? "Não tem uma conta? Cadastre-se"
                                    : "Já tem uma conta? Entre"}
                            </button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
};

export default Auth;
