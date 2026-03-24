import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Loader2, TrendingUp, TrendingDown, DollarSign, Clock, Check } from "lucide-react";

const TYPE_LABELS: Record<string, { label: string; color: string; icon: any }> = {
  income: { label: "Entrada", color: "text-green-400", icon: TrendingUp },
  expense: { label: "Saída", color: "text-red-400", icon: TrendingDown },
  receivable: { label: "A Receber", color: "text-yellow-400", icon: Clock },
  payable: { label: "A Pagar", color: "text-orange-400", icon: Clock },
};

const CATEGORIES = ["Serviços", "Material", "Mão de obra", "Aluguel", "Impostos", "Marketing", "Outros"];

type TxForm = {
  id?: number; companyId: number; type: string; category: string;
  description: string; amount: string; paid: boolean; notes: string;
};

const EMPTY: TxForm = {
  companyId: 1, type: "income", category: "", description: "", amount: "", paid: false, notes: "",
};

export default function Finance() {
  const [typeFilter, setTypeFilter] = useState("all");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<TxForm>(EMPTY);

  const utils = trpc.useUtils();
  const { data: companies } = trpc.companies.list.useQuery();
  const { data: summary } = trpc.transactions.summary.useQuery({
    companyId: companyFilter !== "all" ? parseInt(companyFilter) : undefined,
  });
  const { data: txs, isLoading } = trpc.transactions.list.useQuery({
    companyId: companyFilter !== "all" ? parseInt(companyFilter) : undefined,
    type: typeFilter !== "all" ? typeFilter : undefined,
  });

  const upsert = trpc.transactions.upsert.useMutation({
    onSuccess: () => {
      toast.success("Transação salva!");
      utils.transactions.list.invalidate();
      utils.transactions.summary.invalidate();
      setOpen(false); setForm(EMPTY);
    },
    onError: () => toast.error("Erro ao salvar"),
  });

  const del = trpc.transactions.delete.useMutation({
    onSuccess: () => {
      toast.success("Removido"); utils.transactions.list.invalidate(); utils.transactions.summary.invalidate();
    },
  });

  const markPaid = trpc.transactions.markPaid.useMutation({
    onSuccess: () => { utils.transactions.list.invalidate(); utils.transactions.summary.invalidate(); },
  });

  const fmt = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const handleSave = () => {
    if (!form.description.trim() || !form.amount) return toast.error("Preencha descrição e valor");
    upsert.mutate({ ...form, type: form.type as any, amount: form.amount });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold gradient-text">Financeiro</h1>
          <p className="text-muted-foreground text-sm mt-1">Controle de entradas e saídas</p>
        </div>
        <Button onClick={() => { setForm(EMPTY); setOpen(true); }} className="gap-2">
          <Plus className="h-4 w-4" /> Nova Transação
        </Button>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Saldo", value: summary?.balance ?? 0, color: "text-primary", icon: DollarSign },
          { label: "Receitas", value: summary?.income ?? 0, color: "text-green-400", icon: TrendingUp },
          { label: "Despesas", value: summary?.expense ?? 0, color: "text-red-400", icon: TrendingDown },
          { label: "A Receber", value: summary?.receivable ?? 0, color: "text-yellow-400", icon: Clock },
        ].map((s) => (
          <Card key={s.label} className="glass-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">{s.label}</span>
                <s.icon className={`h-4 w-4 ${s.color}`} />
              </div>
              <p className={`text-lg font-bold ${s.color}`}>{fmt(s.value)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40 bg-card border-border">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {Object.entries(TYPE_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={companyFilter} onValueChange={setCompanyFilter}>
          <SelectTrigger className="w-44 bg-card border-border">
            <SelectValue placeholder="Empresa" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {companies?.map((c: any) => (
              <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <div className="space-y-2">
          {txs?.length === 0 && (
            <Card className="glass-card">
              <CardContent className="p-12 text-center text-muted-foreground">
                Nenhuma transação encontrada
              </CardContent>
            </Card>
          )}
          {txs?.map((t: any) => {
            const tl = TYPE_LABELS[t.type] ?? TYPE_LABELS.income;
            const Icon = tl.icon;
            return (
              <Card key={t.id} className="glass-card hover:border-primary/20 transition-colors">
                <CardContent className="p-3">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg bg-card ${tl.color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm truncate">{t.description}</p>
                        {t.category && <Badge variant="outline" className="text-xs">{t.category}</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {new Date(t.createdAt).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <p className={`font-bold text-sm ${tl.color}`}>
                        {fmt(parseFloat(String(t.amount)))}
                      </p>
                      {(t.type === "receivable" || t.type === "payable") && (
                        <Button
                          variant="ghost" size="icon" className="h-7 w-7"
                          onClick={() => markPaid.mutate({ id: t.id, paid: !t.paid })}
                        >
                          <Check className={`h-3.5 w-3.5 ${t.paid ? "text-green-400" : "text-muted-foreground"}`} />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => del.mutate(t.id)}>
                        ×
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader><DialogTitle>Nova Transação</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger className="mt-1 bg-background border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TYPE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Empresa</Label>
                <Select value={String(form.companyId)} onValueChange={(v) => setForm({ ...form, companyId: parseInt(v) })}>
                  <SelectTrigger className="mt-1 bg-background border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {companies?.map((c: any) => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label>Descrição *</Label>
                <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Descrição da transação" className="mt-1 bg-background border-border" />
              </div>
              <div>
                <Label>Valor (R$) *</Label>
                <Input type="number" step="0.01" value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  placeholder="0,00" className="mt-1 bg-background border-border" />
              </div>
              <div>
                <Label>Categoria</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger className="mt-1 bg-background border-border">
                    <SelectValue placeholder="Selecionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 flex items-center gap-3">
                <Switch checked={form.paid} onCheckedChange={(v) => setForm({ ...form, paid: v })} />
                <Label>Já pago/recebido</Label>
              </div>
              <div className="col-span-2">
                <Label>Observações</Label>
                <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2} className="mt-1 bg-background border-border resize-none" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={upsert.isPending}>
              {upsert.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
