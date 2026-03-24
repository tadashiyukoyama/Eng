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
import { toast } from "sonner";
import { Plus, Loader2, FileText, Zap, Printer, Trash2, Edit2, Check } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  approved: "bg-green-500/20 text-green-400 border-green-500/30",
  rejected: "bg-red-500/20 text-red-400 border-red-500/30",
  expired: "bg-orange-500/20 text-orange-400 border-orange-500/30",
};
const STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho", pending: "Pendente", approved: "Aprovado", rejected: "Rejeitado", expired: "Expirado",
};

type Item = { description: string; quantity: string; unitPrice: string; totalPrice: string };
type BudgetForm = {
  id?: number; companyId: number; clientName: string; clientPhone: string;
  clientEmail: string; title: string; description: string; totalAmount: string; notes: string;
  items: Item[];
};

const EMPTY_FORM: BudgetForm = {
  companyId: 1, clientName: "", clientPhone: "", clientEmail: "",
  title: "", description: "", totalAmount: "0.00", notes: "", items: [],
};

const EMPTY_ITEM: Item = { description: "", quantity: "1", unitPrice: "0.00", totalPrice: "0.00" };

export default function Budgets() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<BudgetForm>(EMPTY_FORM);
  const [aiPrompt, setAiPrompt] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [printBudget, setPrintBudget] = useState<any>(null);

  const utils = trpc.useUtils();
  const { data: companies } = trpc.companies.list.useQuery();
  const { data: budgets, isLoading } = trpc.budgets.list.useQuery({
    status: statusFilter !== "all" ? statusFilter : undefined,
  });

  const create = trpc.budgets.create.useMutation({
    onSuccess: () => { toast.success("Orçamento criado!"); utils.budgets.list.invalidate(); setOpen(false); setForm(EMPTY_FORM); },
    onError: () => toast.error("Erro ao criar orçamento"),
  });

  const update = trpc.budgets.update.useMutation({
    onSuccess: () => { toast.success("Atualizado!"); utils.budgets.list.invalidate(); },
  });

  const del = trpc.budgets.delete.useMutation({
    onSuccess: () => { toast.success("Removido"); utils.budgets.list.invalidate(); },
  });

  const genAI = trpc.budgets.generateWithAI.useMutation({
    onSuccess: (data: any) => {
      const comp = companies?.find((c: any) => c.id === form.companyId);
      setForm((f) => ({
        ...f,
        title: data.title ?? f.title,
        description: data.description ?? f.description,
        notes: data.notes ?? f.notes,
        totalAmount: data.totalAmount ?? f.totalAmount,
        items: (data.items ?? []).map((i: any) => ({
          description: i.description ?? "",
          quantity: i.quantity ?? "1",
          unitPrice: i.unitPrice ?? "0.00",
          totalPrice: i.totalPrice ?? "0.00",
        })),
      }));
      toast.success("Orçamento gerado pela IA!");
    },
    onError: () => toast.error("Erro na IA"),
  });

  const recalcTotal = (items: Item[]) => {
    const total = items.reduce((s, i) => s + parseFloat(i.totalPrice || "0"), 0);
    return total.toFixed(2);
  };

  const updateItem = (idx: number, field: keyof Item, value: string) => {
    const items = [...form.items];
    items[idx] = { ...items[idx], [field]: value };
    if (field === "quantity" || field === "unitPrice") {
      const qty = parseFloat(items[idx].quantity || "1");
      const price = parseFloat(items[idx].unitPrice || "0");
      items[idx].totalPrice = (qty * price).toFixed(2);
    }
    setForm({ ...form, items, totalAmount: recalcTotal(items) });
  };

  const handleSave = () => {
    if (!form.clientName.trim() || !form.title.trim()) return toast.error("Preencha cliente e título");
    create.mutate({ ...form, totalAmount: form.totalAmount });
  };

  const handlePrint = (budget: any) => {
    setPrintBudget(budget);
    setTimeout(() => window.print(), 300);
  };

  const fmt = (v: number | string) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(parseFloat(String(v)));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold gradient-text">Orçamentos</h1>
          <p className="text-muted-foreground text-sm mt-1">Geração e gestão de propostas</p>
        </div>
        <Button onClick={() => { setForm(EMPTY_FORM); setOpen(true); }} className="gap-2">
          <Plus className="h-4 w-4" /> Novo Orçamento
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap">
        {["all", ...Object.keys(STATUS_LABELS)].map((s) => (
          <Badge
            key={s}
            variant="outline"
            className={`cursor-pointer px-3 py-1 ${statusFilter === s ? "border-primary text-primary" : ""} ${s !== "all" ? STATUS_COLORS[s] : ""}`}
            onClick={() => setStatusFilter(s)}
          >
            {s === "all" ? "Todos" : STATUS_LABELS[s]}
          </Badge>
        ))}
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <div className="grid gap-3">
          {budgets?.length === 0 && (
            <Card className="glass-card">
              <CardContent className="p-12 text-center">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">Nenhum orçamento encontrado</p>
              </CardContent>
            </Card>
          )}
          {budgets?.map((b: any) => (
            <Card key={b.id} className="glass-card hover:border-primary/20 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold truncate">{b.title}</h3>
                      <Badge className={`${STATUS_COLORS[b.status]} border text-xs`}>{STATUS_LABELS[b.status]}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{b.clientName}</p>
                    <p className="text-lg font-bold text-primary mt-1">{fmt(b.totalAmount)}</p>
                    <p className="text-xs text-muted-foreground">{new Date(b.createdAt).toLocaleDateString("pt-BR")}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8" title="Imprimir PDF"
                      onClick={() => handlePrint(b)}>
                      <Printer className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-green-400"
                      title="Marcar como aprovado"
                      onClick={() => update.mutate({ id: b.id, status: "approved" })}>
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => del.mutate(b.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog criar orçamento */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-card border-border max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Orçamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Gerador IA */}
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-3">
                <p className="text-xs text-primary font-medium mb-2 flex items-center gap-1">
                  <Zap className="h-3 w-3" /> Gerar com IA
                </p>
                <div className="flex gap-2">
                  <Input
                    placeholder="Ex: Instalação elétrica residencial para João Silva..."
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    className="bg-background border-border text-sm"
                  />
                  <Button size="sm" disabled={genAI.isPending || !aiPrompt.trim()}
                    onClick={() => genAI.mutate({
                      clientName: form.clientName || "Cliente",
                      service: aiPrompt,
                      companyName: companies?.find((c: any) => c.id === form.companyId)?.name,
                    })}>
                    {genAI.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Gerar"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-2 gap-3">
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
              <div>
                <Label>Cliente *</Label>
                <Input value={form.clientName} onChange={(e) => setForm({ ...form, clientName: e.target.value })}
                  placeholder="Nome do cliente" className="mt-1 bg-background border-border" />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input value={form.clientPhone} onChange={(e) => setForm({ ...form, clientPhone: e.target.value })}
                  placeholder="(11) 99999-0000" className="mt-1 bg-background border-border" />
              </div>
              <div>
                <Label>E-mail</Label>
                <Input value={form.clientEmail} onChange={(e) => setForm({ ...form, clientEmail: e.target.value })}
                  placeholder="email@exemplo.com" className="mt-1 bg-background border-border" />
              </div>
              <div className="col-span-2">
                <Label>Título *</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Título do orçamento" className="mt-1 bg-background border-border" />
              </div>
              <div className="col-span-2">
                <Label>Descrição</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2} className="mt-1 bg-background border-border resize-none" />
              </div>
            </div>

            {/* Itens */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Itens do Orçamento</Label>
                <Button variant="outline" size="sm" onClick={() => setForm({ ...form, items: [...form.items, { ...EMPTY_ITEM }] })}>
                  + Item
                </Button>
              </div>
              {form.items.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-3">Nenhum item. Adicione ou use a IA.</p>
              )}
              {form.items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 mb-2 items-center">
                  <div className="col-span-5">
                    <Input value={item.description} onChange={(e) => updateItem(idx, "description", e.target.value)}
                      placeholder="Descrição" className="bg-background border-border text-sm" />
                  </div>
                  <div className="col-span-2">
                    <Input value={item.quantity} onChange={(e) => updateItem(idx, "quantity", e.target.value)}
                      placeholder="Qtd" type="number" className="bg-background border-border text-sm" />
                  </div>
                  <div className="col-span-2">
                    <Input value={item.unitPrice} onChange={(e) => updateItem(idx, "unitPrice", e.target.value)}
                      placeholder="Unit." type="number" className="bg-background border-border text-sm" />
                  </div>
                  <div className="col-span-2">
                    <Input value={item.totalPrice} readOnly placeholder="Total"
                      className="bg-muted border-border text-sm" />
                  </div>
                  <div className="col-span-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"
                      onClick={() => { const items = form.items.filter((_, i) => i !== idx); setForm({ ...form, items, totalAmount: recalcTotal(items) }); }}>
                      ×
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border">
              <div>
                <Label>Observações</Label>
                <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2} className="mt-1 bg-background border-border resize-none w-80" />
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold text-primary">{fmt(form.totalAmount)}</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={create.isPending}>
              {create.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Criar Orçamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
