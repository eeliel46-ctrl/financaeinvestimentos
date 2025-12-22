
import { useState, useEffect } from "react";
import { PluggyConnect } from "react-pluggy-connect";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, Wallet, AlertCircle, RefreshCw } from "lucide-react";
import { pluggyService } from "@/services/pluggy";
import { toast } from "sonner";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface BankAccount {
    id: string;
    name: string;
    balance: number;
    currencyCode: string;
    type: string;
    number: string;
}

interface Transaction {
    id: string;
    description: string;
    amount: number;
    date: string;
    category?: string;
    status: string;
}

// Temporary storage for itemIds (in a real app, save to database)
const getStoredItemIds = () => {
    const stored = localStorage.getItem('pluggy_item_ids');
    return stored ? JSON.parse(stored) : [];
};

const addStoredItemId = (itemId: string) => {
    const current = getStoredItemIds();
    if (!current.includes(itemId)) {
        localStorage.setItem('pluggy_item_ids', JSON.stringify([...current, itemId]));
    }
};

export const BankAccountsInterface = () => {
    const [connectToken, setConnectToken] = useState<string | null>(null);
    const [isConnectOpen, setIsConnectOpen] = useState(false);
    const [accounts, setAccounts] = useState<BankAccount[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loadingTransactions, setLoadingTransactions] = useState(false);

    useEffect(() => {
        fetchAccounts();
    }, []);

    const fetchAccounts = async () => {
        const itemIds = getStoredItemIds();
        if (itemIds.length === 0) return;

        setLoading(true);
        try {
            let allAccounts: BankAccount[] = [];
            for (const itemId of itemIds) {
                const response = await pluggyService.fetchAccounts(itemId);
                if (response.results) {
                    allAccounts = [...allAccounts, ...response.results];
                }
            }
            setAccounts(allAccounts);
        } catch (error: any) {
            console.error("Error fetching accounts:", error);
            toast.error("Erro ao carregar contas bancárias");
        } finally {
            setLoading(false);
        }
    };

    const handleStartConnect = async () => {
        try {
            setLoading(true);
            const tokenResponse = await pluggyService.createConnectToken();
            if (tokenResponse && tokenResponse.accessToken) {
                setConnectToken(tokenResponse.accessToken);
                setIsConnectOpen(true);
            } else {
                throw new Error("No access token received");
            }
        } catch (error: any) {
            console.error("Error creating connect token:", error);
            toast.error(`Erro ao conectar: ${error.message || "Verifique as configurações."}`);
        } finally {
            setLoading(false);
        }
    };

    const handleConnectSuccess = (itemData: { item: { id: string } }) => {
        setIsConnectOpen(false);
        addStoredItemId(itemData.item.id);
        toast.success("Conta conectada com sucesso!");
        fetchAccounts();
    };

    const handleConnectError = (error: any) => {
        console.error("Pluggy Connect Error:", error);
        toast.error("Erro na conexão com o banco.");
    };

    const handleViewTransactions = async (accountId: string) => {
        if (selectedAccount === accountId) {
            setSelectedAccount(null); // Toggle off
            return;
        }

        setSelectedAccount(accountId);
        setLoadingTransactions(true);
        setTransactions([]);

        try {
            const response = await pluggyService.fetchTransactions(accountId);
            setTransactions(response.results || []);
        } catch (error) {
            console.error("Error fetching transactions:", error);
            toast.error("Erro ao carregar transações.");
        } finally {
            setLoadingTransactions(false);
        }
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Contas Bancárias</h1>
                    <p className="text-muted-foreground">Conecte seus bancos e visualize seus extratos</p>
                </div>
                <Button onClick={handleStartConnect} disabled={loading || isConnectOpen}>
                    <Plus className="mr-2 h-4 w-4" />
                    Nova Conexão
                </Button>
            </div>

            {isConnectOpen && connectToken && (
                <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-background border rounded-lg shadow-lg w-full max-w-2xl h-[600px] relative overflow-hidden flex flex-col">
                        <div className="p-4 border-b flex justify-between items-center">
                            <h3 className="font-semibold">Conectar conta via Pluggy</h3>
                            <Button variant="ghost" size="sm" onClick={() => setIsConnectOpen(false)}>Fechar</Button>
                        </div>
                        <div className="flex-1 className='pluggy-container'">
                            <PluggyConnect
                                connectToken={connectToken}
                                includeSandbox={true}
                                onSuccess={handleConnectSuccess}
                                onError={handleConnectError}
                            />
                        </div>
                    </div>
                </div>
            )}

            {loading && !isConnectOpen && (
                <div className="text-center py-8 text-muted-foreground">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                    Carregando contas...
                </div>
            )}

            {!loading && accounts.length === 0 && !isConnectOpen && (
                <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-10 space-y-4">
                        <div className="bg-muted p-4 rounded-full">
                            <Wallet className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <div className="text-center">
                            <h3 className="text-lg font-semibold">Nenhuma conta conectada</h3>
                            <p className="text-sm text-muted-foreground max-w-sm">
                                Conecte suas contas bancárias para visualizar saldos e extratos automaticamente.
                            </p>
                        </div>
                        <Button onClick={handleStartConnect}>
                            Conectar Agora
                        </Button>
                    </CardContent>
                </Card>
            )}

            <div className="grid gap-6">
                {accounts.map((account) => (
                    <Card key={account.id} className="overflow-hidden">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 bg-muted/30">
                            <div>
                                <CardTitle className="text-lg font-bold">{account.name}</CardTitle>
                                <CardDescription>
                                    {account.type} • **** {account.number}
                                </CardDescription>
                            </div>
                            <div className="text-right">
                                <div className="text-2xl font-bold">
                                    {account.currencyCode} {account.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </div>
                                <div className="text-xs text-muted-foreground">Saldo Atual</div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="p-4 bg-background border-t">
                                <Button
                                    variant="ghost"
                                    className="w-full justify-between group"
                                    onClick={() => handleViewTransactions(account.id)}
                                >
                                    <span className="flex items-center">
                                        {selectedAccount === account.id ? (
                                            loadingTransactions ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Ocultar Extrato"
                                        ) : "Ver Extrato"}
                                    </span>
                                    <RefreshCw className={`h-4 w-4 text-muted-foreground transition-transform ${selectedAccount === account.id && loadingTransactions ? "animate-spin" : ""}`} />
                                </Button>
                            </div>

                            {selectedAccount === account.id && (
                                <div className="border-t animate-in slide-in-from-top-2 duration-200">
                                    {loadingTransactions ? (
                                        <div className="p-8 text-center text-muted-foreground">
                                            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                                            Carregando transações...
                                        </div>
                                    ) : transactions.length > 0 ? (
                                        <div className="max-h-[400px] overflow-auto">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Data</TableHead>
                                                        <TableHead>Descrição</TableHead>
                                                        <TableHead>Categoria</TableHead>
                                                        <TableHead className="text-right">Valor</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {transactions.map((t) => (
                                                        <TableRow key={t.id}>
                                                            <TableCell className="text-xs text-muted-foreground">
                                                                {new Date(t.date).toLocaleDateString('pt-BR')}
                                                            </TableCell>
                                                            <TableCell className="font-medium">{t.description}</TableCell>
                                                            <TableCell>
                                                                {t.category ? (
                                                                    <Badge variant="secondary" className="text-[10px]">{t.category}</Badge>
                                                                ) : '-'}
                                                            </TableCell>
                                                            <TableCell className={`text-right font-bold ${t.amount < 0 ? 'text-red-500' : 'text-green-500'}`}>
                                                                {t.amount.toLocaleString('pt-BR', { style: 'currency', currency: account.currencyCode })}
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    ) : (
                                        <div className="p-8 text-center text-muted-foreground">
                                            <AlertCircle className="h-6 w-6 mx-auto mb-2 text-muted-foreground/50" />
                                            Nenhuma transação recente encontrada.
                                        </div>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
};
