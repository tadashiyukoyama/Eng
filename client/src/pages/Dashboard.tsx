import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  DollarSign, Users, FileText, Calendar, TrendingUp,
  TrendingDown, Send, Loader2, Zap, Activity
} from "lucide-react";
import { Streamdown } from "streamdown";

export default function Dashboard() {
  const [command, setCommand] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [history, setHistory] = useState<string[]>([]);

  const { data: metrics, isLoading } = trpc.dashboard.metrics.useQuery({});
  const aiCommand = trpc.dashboard.aiCommand.useMutation({
    onSuccess: (data) => {
      setAiResponse(data.response);
      setHistory((h) => [`> ${command}`, data.response, ...h].slice(0, 20));
      setCommand("");
    },
    onError: () => toast.error("Erro ao executar comando"),
  });

  const handleCommand = () => {
    if (!command.trim()) return;
    aiCommand.mutate({ command });
  };

  const fmt = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const f = metrics?.financial;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold gradient-text">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Visão executiva do negócio</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="pulse-dot" />
          <span className="text-xs text-muted-foreground">Sistema online</span>
        </div>
      </div>

      {/* Métricas financeiras */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Saldo</span>
              <Activity className="h-4 w-4 text-primary" />
            </div>
            <p className="text-xl font-bold text-primary">{fmt(f?.balance ?? 0)}</p>
            <p className="text-xs text-muted-foreground mt-1">Liquidez atual</p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Receitas</span>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </div>
            <p className="text-xl font-bold text-green-500">{fmt(f?.income ?? 0)}</p>
            <p className="text-xs text-muted-foreground mt-1">Entradas pagas</p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Despesas</span>
              <TrendingDown className="h-4 w-4 text-red-500" />
            </div>
            <p className="text-xl font-bold text-red-500">{fmt(f?.expense ?? 0)}</p>
            <p className="text-xs text-muted-foreground mt-1">Saídas pagas</p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground uppercase tracking-wide">A Receber</span>
              <DollarSign className="h-4 w-4 text-yellow-500" />
            </div>
            <p className="text-xl font-bold text-yellow-500">{fmt(f?.receivable ?? 0)}</p>
            <p className="text-xs text-muted-foreground mt-1">Pendente</p>
          </CardContent>
        </Card>
      </div>

      {/* Métricas operacionais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="glass-card">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-lg font-bold">{metrics?.totalClients ?? 0}</p>
              <p className="text-xs text-muted-foreground">Clientes</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-yellow-500/10">
              <Zap className="h-5 w-5 text-yellow-500" />
            </div>
            <div>
              <p className="text-lg font-bold">{metrics?.leads ?? 0}</p>
              <p className="text-xs text-muted-foreground">Leads</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-500/10">
              <FileText className="h-5 w-5 text-orange-500" />
            </div>
            <div>
              <p className="text-lg font-bold">{metrics?.pendingBudgets ?? 0}</p>
              <p className="text-xs text-muted-foreground">Orç. Pendentes</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Calendar className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-lg font-bold">{metrics?.upcomingEvents ?? 0}</p>
              <p className="text-xs text-muted-foreground">Eventos (7d)</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Terminal IA */}
      <Card className="glass-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            Terminal IA — Assistente Executivo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Histórico */}
          {history.length > 0 && (
            <div className="bg-background/50 rounded-lg p-3 max-h-48 overflow-y-auto space-y-2 mono text-xs">
              {history.map((line, i) => (
                <div key={i} className={line.startsWith(">") ? "text-primary" : "text-muted-foreground"}>
                  {line.startsWith(">") ? line : <Streamdown>{line}</Streamdown>}
                </div>
              ))}
            </div>
          )}
          {/* Resposta atual */}
          {aiResponse && !history.length && (
            <div className="bg-background/50 rounded-lg p-3 text-sm">
              <Streamdown>{aiResponse}</Streamdown>
            </div>
          )}
          {/* Input */}
          <div className="flex gap-2">
            <Input
              placeholder="Ex: Qual é meu saldo? Quais leads tenho? Resumo do mês..."
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCommand()}
              className="bg-background/50 border-border"
            />
            <Button
              onClick={handleCommand}
              disabled={aiCommand.isPending || !command.trim()}
              size="icon"
            >
              {aiCommand.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
          {/* Sugestões rápidas */}
          <div className="flex flex-wrap gap-2">
            {["Resumo financeiro", "Leads pendentes", "Orçamentos aprovados", "Próximos eventos"].map((s) => (
              <Badge
                key={s}
                variant="outline"
                className="cursor-pointer hover:bg-primary/10 text-xs"
                onClick={() => { setCommand(s); }}
              >
                {s}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
