import { useState, useRef, useCallback, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Plus, Search, Edit2, Trash2, Loader2, Users, Phone, Mail, MapPin,
  LayoutGrid, List, GripVertical, DollarSign, FileText, Calendar,
  ArrowDownLeft, ArrowUpRight, Clock, CheckCircle2, AlertCircle, Eye,
  TrendingUp, TrendingDown, Banknote,
} from "lucide-react";

// ─── STATUS CONFIG ───────────────────────────────────────────────────────────
const STATUSES = [
  { key: "lead", label: "Lead", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", columnBg: "border-yellow-500/20" },
  { key: "prospect", label: "Prospect", color: "bg-blue-500/20 text-blue-400 border-blue-500/30", columnBg: "border-blue-500/20" },
  { key: "active", label: "Ativo", color: "bg-green-500/20 text-green-400 border-green-500/30", columnBg: "border-green-500/20" },
  { key: "inactive", label: "Inativo", color: "bg-gray-500/20 text-gray-400 border-gray-500/30", columnBg: "border-gray-500/20" },
  { key: "lost", label: "Perdido", color: "bg-red-500/20 text-red-400 border-red-500/30", columnBg: "border-red-500/20" },
] as const;

const STATUS_MAP = Object.fromEntries(STATUSES.map((s) => [s.key, s]));

type ClientForm = {
  id?: number; companyId: number; name: string; phone: string; email: string;
  address: string; city: string; status: string; notes: string; source: string;
};

const EMPTY_FORM: ClientForm = {
  companyId: 1, name: "", phone: "", email: "", address: "",
  city: "", status: "lead", notes: "", source: "",
};

type TransactionForm = {
  companyId: number; type: "income" | "expense" | "receivable" | "payable";
  description: string; amount: string; category: string; dueDate: string; notes: string;
};

const EMPTY_TX: TransactionForm = {
  companyId: 1, type: "expense", description: "", amount: "", category: "", dueDate: "", notes: "",
};

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
export default function CRM() {
  const [search, setSearch] = useState("");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState<ClientForm>(EMPTY_FORM);
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [txOpen, setTxOpen] = useState(false);
  const [txForm, setTxForm] = useState<TransactionForm>(EMPTY_TX);

  const utils = trpc.useUtils();
  const { data: companies } = trpc.companies.list.useQuery();
  const { data: clients, isLoading } = trpc.clients.list.useQuery({
    companyId: companyFilter !== "all" ? parseInt(companyFilter) : undefined,
    search: search || undefined,
  });

  const upsert = trpc.clients.upsert.useMutation({
    onSuccess: () => {
      toast.success(form.id ? "Cliente atualizado!" : "Cliente criado!");
      utils.clients.list.invalidate();
      if (selectedClientId) utils.clients.get.invalidate(selectedClientId);
      setEditOpen(false);
      setForm(EMPTY_FORM);
    },
    onError: () => toast.error("Erro ao salvar cliente"),
  });

  const del = trpc.clients.delete.useMutation({
    onSuccess: () => {
      toast.success("Cliente removido");
      utils.clients.list.invalidate();
      setSelectedClientId(null);
    },
    onError: () => toast.error("Erro ao remover"),
  });

  const updateStatus = trpc.clients.updateStatus.useMutation({
    onSuccess: () => {
      utils.clients.list.invalidate();
      if (selectedClientId) utils.clients.get.invalidate(selectedClientId);
    },
  });

  const upsertTx = trpc.transactions.upsert.useMutation({
    onSuccess: () => {
      toast.success("Transação registrada!");
      utils.clients.financialSummary.invalidate(selectedClientId!);
      utils.clients.transactions.invalidate(selectedClientId!);
      setTxOpen(false);
      setTxForm(EMPTY_TX);
    },
    onError: () => toast.error("Erro ao registrar transação"),
  });

  const markPaid = trpc.transactions.markPaid.useMutation({
    onSuccess: () => {
      toast.success("Marcado como pago!");
      if (selectedClientId) {
        utils.clients.financialSummary.invalidate(selectedClientId);
        utils.clients.transactions.invalidate(selectedClientId);
      }
    },
  });

  const openEdit = (c: any) => {
    setForm({
      id: c.id, companyId: c.companyId, name: c.name ?? "", phone: c.phone ?? "",
      email: c.email ?? "", address: c.address ?? "", city: c.city ?? "",
      status: c.status ?? "lead", notes: c.notes ?? "", source: c.source ?? "",
    });
    setEditOpen(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) return toast.error("Nome é obrigatório");
    upsert.mutate({ ...form, status: form.status as any, phone: form.phone || undefined, email: form.email || undefined, address: form.address || undefined, city: form.city || undefined, notes: form.notes || undefined, source: form.source || undefined });
  };

  const openNewTx = (type: "income" | "expense" | "receivable" | "payable") => {
    const client = clients?.find((c: any) => c.id === selectedClientId);
    setTxForm({ ...EMPTY_TX, type, companyId: client?.companyId ?? 1 });
    setTxOpen(true);
  };

  const handleSaveTx = () => {
    if (!txForm.description.trim() || !txForm.amount) return toast.error("Descrição e valor são obrigatórios");
    upsertTx.mutate({
      ...txForm,
      clientId: selectedClientId!,
      dueDate: txForm.dueDate ? new Date(txForm.dueDate) : undefined,
      notes: txForm.notes || undefined,
      category: txForm.category || undefined,
    });
  };

  // ─── DRAG AND DROP ─────────────────────────────────────────────────────────
  const dragItem = useRef<{ id: number; status: string } | null>(null);

  const handleDragStart = useCallback((id: number, status: string) => {
    dragItem.current = { id, status };
  }, []);

  const handleDrop = useCallback((newStatus: string) => {
    if (!dragItem.current || dragItem.current.status === newStatus) return;
    updateStatus.mutate({ id: dragItem.current.id, status: newStatus as any });
    dragItem.current = null;
  }, [updateStatus]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  // ─── GROUPED CLIENTS FOR KANBAN ────────────────────────────────────────────
  const grouped = useMemo(() => {
    const map: Record<string, any[]> = {};
    STATUSES.forEach((s) => (map[s.key] = []));
    clients?.forEach((c: any) => {
      if (map[c.status]) map[c.status].push(c);
      else map.lead.push(c);
    });
    return map;
  }, [clients]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold gradient-text">CRM</h1>
          <p className="text-muted-foreground text-sm mt-1">Gestão de leads e clientes</p>
        </div>
        <div className="flex gap-2">
          <div className="flex bg-card border border-border rounded-lg p-0.5">
            <Button variant={view === "kanban" ? "default" : "ghost"} size="sm" onClick={() => setView("kanban")} className="gap-1.5 h-8">
              <LayoutGrid className="h-3.5 w-3.5" /> Kanban
            </Button>
            <Button variant={view === "list" ? "default" : "ghost"} size="sm" onClick={() => setView("list")} className="gap-1.5 h-8">
              <List className="h-3.5 w-3.5" /> Lista
            </Button>
          </div>
          <Button onClick={() => { setForm(EMPTY_FORM); setEditOpen(true); }} className="gap-2">
            <Plus className="h-4 w-4" /> Novo Cliente
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome ou telefone..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-card border-border" />
        </div>
        <Select value={companyFilter} onValueChange={setCompanyFilter}>
          <SelectTrigger className="w-44 bg-card border-border"><SelectValue placeholder="Empresa" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {companies?.map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Stats rápidos */}
      <div className="grid grid-cols-5 gap-3">
        {STATUSES.map((s) => {
          const count = grouped[s.key]?.length ?? 0;
          return (
            <Card key={s.key} className="glass-card hover:border-primary/30 transition-colors">
              <CardContent className="p-3 text-center">
                <p className="text-xl font-bold">{count}</p>
                <Badge className={`${s.color} border text-xs mt-1`}>{s.label}</Badge>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Loading */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : view === "kanban" ? (
        /* ─── KANBAN VIEW ─────────────────────────────────────────────────── */
        <div className="grid grid-cols-5 gap-3 min-h-[500px]">
          {STATUSES.map((status) => (
            <div
              key={status.key}
              className={`rounded-xl border-2 border-dashed ${status.columnBg} bg-card/30 p-2 transition-colors`}
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(status.key)}
            >
              <div className="flex items-center justify-between mb-3 px-1">
                <Badge className={`${status.color} border text-xs`}>{status.label}</Badge>
                <span className="text-xs text-muted-foreground font-mono">{grouped[status.key]?.length ?? 0}</span>
              </div>
              <ScrollArea className="h-[calc(100vh-360px)]">
                <div className="space-y-2 pr-2">
                  {grouped[status.key]?.map((c: any) => {
                    const comp = companies?.find((co: any) => co.id === c.companyId);
                    return (
                      <div
                        key={c.id}
                        draggable
                        onDragStart={() => handleDragStart(c.id, c.status)}
                        className="glass-card rounded-lg p-3 cursor-grab active:cursor-grabbing hover:border-primary/30 transition-all group"
                      >
                        <div className="flex items-start gap-2">
                          <GripVertical className="h-4 w-4 text-muted-foreground/40 mt-0.5 shrink-0 group-hover:text-muted-foreground" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{c.name}</p>
                            {comp && <p className="text-[10px] text-muted-foreground mt-0.5">{comp.name}</p>}
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                              {c.phone && <span className="text-[10px] text-muted-foreground flex items-center gap-0.5"><Phone className="h-2.5 w-2.5" />{c.phone}</span>}
                              {c.city && <span className="text-[10px] text-muted-foreground flex items-center gap-0.5"><MapPin className="h-2.5 w-2.5" />{c.city}</span>}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-1 mt-2 justify-end">
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSelectedClientId(c.id)}>
                            <Eye className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEdit(c)}>
                            <Edit2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                  {(grouped[status.key]?.length ?? 0) === 0 && (
                    <div className="text-center py-8 text-muted-foreground/50 text-xs">Arraste clientes aqui</div>
                  )}
                </div>
              </ScrollArea>
            </div>
          ))}
        </div>
      ) : (
        /* ─── LIST VIEW ───────────────────────────────────────────────────── */
        <div className="grid gap-3">
          {clients?.length === 0 && (
            <Card className="glass-card">
              <CardContent className="p-12 text-center">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">Nenhum cliente encontrado</p>
                <Button variant="outline" className="mt-4" onClick={() => { setForm(EMPTY_FORM); setEditOpen(true); }}>Adicionar primeiro cliente</Button>
              </CardContent>
            </Card>
          )}
          {clients?.map((c: any) => {
            const s = STATUS_MAP[c.status] ?? STATUS_MAP.lead;
            const comp = companies?.find((co: any) => co.id === c.companyId);
            return (
              <Card key={c.id} className="glass-card hover:border-primary/20 transition-colors cursor-pointer" onClick={() => setSelectedClientId(c.id)}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold truncate">{c.name}</h3>
                        <Badge className={`${s.color} border text-xs`}>{s.label}</Badge>
                        {comp && <Badge variant="outline" className="text-xs">{comp.name}</Badge>}
                      </div>
                      <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                        {c.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{c.phone}</span>}
                        {c.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{c.email}</span>}
                        {c.city && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{c.city}</span>}
                      </div>
                      {c.notes && <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{c.notes}</p>}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); openEdit(c); }}><Edit2 className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); del.mutate(c.id); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ─── CLIENT DETAIL SHEET ──────────────────────────────────────────── */}
      <ClientDetailSheet
        clientId={selectedClientId}
        onClose={() => setSelectedClientId(null)}
        onEdit={(c: any) => openEdit(c)}
        onDelete={(id: number) => { del.mutate(id); }}
        onAddTx={openNewTx}
        onMarkPaid={(id: number) => markPaid.mutate({ id, paid: true })}
        companies={companies}
      />

      {/* ─── EDIT CLIENT DIALOG ───────────────────────────────────────────── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader><DialogTitle>{form.id ? "Editar Cliente" : "Novo Cliente"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Nome *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nome completo" className="mt-1 bg-background border-border" />
              </div>
              <div>
                <Label>Empresa</Label>
                <Select value={String(form.companyId)} onValueChange={(v) => setForm({ ...form, companyId: parseInt(v) })}>
                  <SelectTrigger className="mt-1 bg-background border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>{companies?.map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger className="mt-1 bg-background border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Telefone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(11) 99999-0000" className="mt-1 bg-background border-border" />
              </div>
              <div>
                <Label>E-mail</Label>
                <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@exemplo.com" className="mt-1 bg-background border-border" />
              </div>
              <div>
                <Label>Cidade</Label>
                <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="São Paulo" className="mt-1 bg-background border-border" />
              </div>
              <div>
                <Label>Origem</Label>
                <Input value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} placeholder="Indicação, Instagram..." className="mt-1 bg-background border-border" />
              </div>
              <div className="col-span-2">
                <Label>Endereço</Label>
                <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Rua, número, bairro" className="mt-1 bg-background border-border" />
              </div>
              <div className="col-span-2">
                <Label>Observações</Label>
                <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Notas sobre o cliente..." rows={3} className="mt-1 bg-background border-border resize-none" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={upsert.isPending}>
              {upsert.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── NEW TRANSACTION DIALOG ───────────────────────────────────────── */}
      <Dialog open={txOpen} onOpenChange={setTxOpen}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle>
              {txForm.type === "expense" && "Registrar Gasto"}
              {txForm.type === "income" && "Registrar Recebimento"}
              {txForm.type === "receivable" && "Registrar Valor a Receber"}
              {txForm.type === "payable" && "Agendar Pagamento"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div>
              <Label>Descrição *</Label>
              <Input value={txForm.description} onChange={(e) => setTxForm({ ...txForm, description: e.target.value })} placeholder="Ex: Serviço de pintura" className="mt-1 bg-background border-border" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Valor (R$) *</Label>
                <Input type="number" step="0.01" value={txForm.amount} onChange={(e) => setTxForm({ ...txForm, amount: e.target.value })} placeholder="0.00" className="mt-1 bg-background border-border" />
              </div>
              <div>
                <Label>Categoria</Label>
                <Input value={txForm.category} onChange={(e) => setTxForm({ ...txForm, category: e.target.value })} placeholder="Serviço, Material..." className="mt-1 bg-background border-border" />
              </div>
            </div>
            {(txForm.type === "receivable" || txForm.type === "payable") && (
              <div>
                <Label>Data de vencimento</Label>
                <Input type="date" value={txForm.dueDate} onChange={(e) => setTxForm({ ...txForm, dueDate: e.target.value })} className="mt-1 bg-background border-border" />
              </div>
            )}
            <div>
              <Label>Notas</Label>
              <Textarea value={txForm.notes} onChange={(e) => setTxForm({ ...txForm, notes: e.target.value })} placeholder="Observações..." rows={2} className="mt-1 bg-background border-border resize-none" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTxOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveTx} disabled={upsertTx.isPending}>
              {upsertTx.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── CLIENT DETAIL SHEET ─────────────────────────────────────────────────────
function ClientDetailSheet({ clientId, onClose, onEdit, onDelete, onAddTx, onMarkPaid, companies }: {
  clientId: number | null; onClose: () => void; onEdit: (c: any) => void;
  onDelete: (id: number) => void; onAddTx: (type: "income" | "expense" | "receivable" | "payable") => void;
  onMarkPaid: (id: number) => void; companies: any;
}) {
  if (!clientId) return null;

  const { data: client, isLoading: loadingClient } = trpc.clients.get.useQuery(clientId);
  const { data: financial } = trpc.clients.financialSummary.useQuery(clientId);
  const { data: txList } = trpc.clients.transactions.useQuery(clientId);
  const { data: budgetList } = trpc.clients.budgets.useQuery(clientId);
  const { data: eventList } = trpc.clients.events.useQuery(clientId);

  if (loadingClient) return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-card border-border max-w-2xl">
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      </DialogContent>
    </Dialog>
  );

  if (!client) return null;

  const s = STATUS_MAP[client.status] ?? STATUS_MAP.lead;
  const comp = companies?.find((co: any) => co.id === client.companyId);
  const fmt = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-card border-border max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-lg">
                {client.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <DialogTitle className="text-lg">{client.name}</DialogTitle>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge className={`${s.color} border text-xs`}>{s.label}</Badge>
                  {comp && <Badge variant="outline" className="text-xs">{comp.name}</Badge>}
                </div>
              </div>
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(client)}><Edit2 className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => onDelete(client.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </div>
        </DialogHeader>

        {/* Tabs */}
        <Tabs defaultValue="dados" className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid grid-cols-4 w-full bg-background">
            <TabsTrigger value="dados" className="gap-1.5 text-xs"><Users className="h-3.5 w-3.5" /> Dados</TabsTrigger>
            <TabsTrigger value="financeiro" className="gap-1.5 text-xs"><DollarSign className="h-3.5 w-3.5" /> Financeiro</TabsTrigger>
            <TabsTrigger value="orcamentos" className="gap-1.5 text-xs"><FileText className="h-3.5 w-3.5" /> Orçamentos</TabsTrigger>
            <TabsTrigger value="agenda" className="gap-1.5 text-xs"><Calendar className="h-3.5 w-3.5" /> Agenda</TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 mt-3">
            {/* ─── ABA DADOS ─────────────────────────────────────────────── */}
            <TabsContent value="dados" className="mt-0 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {client.phone && <InfoRow icon={<Phone className="h-4 w-4" />} label="Telefone" value={client.phone} />}
                {client.email && <InfoRow icon={<Mail className="h-4 w-4" />} label="E-mail" value={client.email} />}
                {client.city && <InfoRow icon={<MapPin className="h-4 w-4" />} label="Cidade" value={client.city} />}
                {client.source && <InfoRow icon={<TrendingUp className="h-4 w-4" />} label="Origem" value={client.source} />}
              </div>
              {client.address && (
                <div className="glass-card rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-1">Endereço</p>
                  <p className="text-sm">{client.address}</p>
                </div>
              )}
              {client.notes && (
                <div className="glass-card rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-1">Observações</p>
                  <p className="text-sm whitespace-pre-wrap">{client.notes}</p>
                </div>
              )}
              <div className="glass-card rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Cadastrado em</p>
                <p className="text-sm">{new Date(client.createdAt).toLocaleDateString("pt-BR")}</p>
              </div>
            </TabsContent>

            {/* ─── ABA FINANCEIRO ─────────────────────────────────────────── */}
            <TabsContent value="financeiro" className="mt-0 space-y-3">
              {/* Summary Cards */}
              <div className="grid grid-cols-3 gap-2">
                <Card className="glass-card">
                  <CardContent className="p-3 text-center">
                    <ArrowDownLeft className="h-4 w-4 text-green-400 mx-auto" />
                    <p className="text-xs text-muted-foreground mt-1">Recebido</p>
                    <p className="text-sm font-bold text-green-400">{fmt(financial?.totalIncome ?? 0)}</p>
                  </CardContent>
                </Card>
                <Card className="glass-card">
                  <CardContent className="p-3 text-center">
                    <ArrowUpRight className="h-4 w-4 text-red-400 mx-auto" />
                    <p className="text-xs text-muted-foreground mt-1">Gasto</p>
                    <p className="text-sm font-bold text-red-400">{fmt(financial?.totalExpense ?? 0)}</p>
                  </CardContent>
                </Card>
                <Card className="glass-card border-yellow-500/30">
                  <CardContent className="p-3 text-center">
                    <AlertCircle className="h-4 w-4 text-yellow-400 mx-auto" />
                    <p className="text-xs text-muted-foreground mt-1">Me deve</p>
                    <p className="text-sm font-bold text-yellow-400">{fmt(financial?.owes ?? 0)}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Quick Actions */}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" className="gap-1.5 text-xs border-green-500/30 text-green-400 hover:bg-green-500/10" onClick={() => onAddTx("income")}>
                  <ArrowDownLeft className="h-3 w-3" /> Recebimento
                </Button>
                <Button size="sm" variant="outline" className="gap-1.5 text-xs border-red-500/30 text-red-400 hover:bg-red-500/10" onClick={() => onAddTx("expense")}>
                  <ArrowUpRight className="h-3 w-3" /> Gasto
                </Button>
                <Button size="sm" variant="outline" className="gap-1.5 text-xs border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10" onClick={() => onAddTx("receivable")}>
                  <Clock className="h-3 w-3" /> A Receber
                </Button>
                <Button size="sm" variant="outline" className="gap-1.5 text-xs border-blue-500/30 text-blue-400 hover:bg-blue-500/10" onClick={() => onAddTx("payable")}>
                  <Banknote className="h-3 w-3" /> Agendar Pgto
                </Button>
              </div>

              <Separator />

              {/* Transaction List */}
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium">Histórico de transações</p>
                {(!txList || txList.length === 0) ? (
                  <p className="text-xs text-muted-foreground/50 text-center py-4">Nenhuma transação registrada</p>
                ) : txList.map((tx: any) => {
                  const isIncome = tx.type === "income";
                  const isExpense = tx.type === "expense";
                  const isReceivable = tx.type === "receivable";
                  return (
                    <div key={tx.id} className="glass-card rounded-lg p-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {isIncome && <ArrowDownLeft className="h-4 w-4 text-green-400" />}
                        {isExpense && <ArrowUpRight className="h-4 w-4 text-red-400" />}
                        {isReceivable && <Clock className="h-4 w-4 text-yellow-400" />}
                        {tx.type === "payable" && <Banknote className="h-4 w-4 text-blue-400" />}
                        <div>
                          <p className="text-sm font-medium">{tx.description}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {new Date(tx.createdAt).toLocaleDateString("pt-BR")}
                            {tx.category && ` · ${tx.category}`}
                            {tx.paid && " · Pago"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-bold ${isIncome ? "text-green-400" : isExpense ? "text-red-400" : "text-yellow-400"}`}>
                          {isIncome ? "+" : "-"}{fmt(parseFloat(String(tx.amount)))}
                        </span>
                        {(isReceivable || tx.type === "payable") && !tx.paid && (
                          <Button size="icon" variant="ghost" className="h-6 w-6 text-green-400" onClick={() => onMarkPaid(tx.id)}>
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </TabsContent>

            {/* ─── ABA ORÇAMENTOS ──────────────────────────────────────────── */}
            <TabsContent value="orcamentos" className="mt-0 space-y-2">
              {(!budgetList || budgetList.length === 0) ? (
                <p className="text-xs text-muted-foreground/50 text-center py-8">Nenhum orçamento vinculado</p>
              ) : budgetList.map((b: any) => {
                const statusColors: Record<string, string> = {
                  draft: "bg-gray-500/20 text-gray-400", pending: "bg-yellow-500/20 text-yellow-400",
                  approved: "bg-green-500/20 text-green-400", rejected: "bg-red-500/20 text-red-400",
                  expired: "bg-orange-500/20 text-orange-400",
                };
                return (
                  <div key={b.id} className="glass-card rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{b.title}</p>
                      <p className="text-[10px] text-muted-foreground">{new Date(b.createdAt).toLocaleDateString("pt-BR")}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={`${statusColors[b.status] ?? ""} border text-xs`}>{b.status}</Badge>
                      <span className="text-sm font-bold">{fmt(parseFloat(String(b.totalAmount)))}</span>
                    </div>
                  </div>
                );
              })}
            </TabsContent>

            {/* ─── ABA AGENDA ─────────────────────────────────────────────── */}
            <TabsContent value="agenda" className="mt-0 space-y-2">
              {(!eventList || eventList.length === 0) ? (
                <p className="text-xs text-muted-foreground/50 text-center py-8">Nenhum evento vinculado</p>
              ) : eventList.map((ev: any) => {
                const evColors: Record<string, string> = {
                  scheduled: "bg-blue-500/20 text-blue-400", confirmed: "bg-green-500/20 text-green-400",
                  done: "bg-gray-500/20 text-gray-400", cancelled: "bg-red-500/20 text-red-400",
                };
                return (
                  <div key={ev.id} className="glass-card rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">{ev.title}</p>
                      <Badge className={`${evColors[ev.status] ?? ""} border text-xs`}>{ev.status}</Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {new Date(ev.startAt).toLocaleDateString("pt-BR")} {new Date(ev.startAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      {ev.address && ` · ${ev.address}`}
                    </p>
                  </div>
                );
              })}
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// ─── HELPER COMPONENTS ───────────────────────────────────────────────────────
function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="glass-card rounded-lg p-3 flex items-center gap-2">
      <span className="text-muted-foreground">{icon}</span>
      <div>
        <p className="text-[10px] text-muted-foreground">{label}</p>
        <p className="text-sm">{value}</p>
      </div>
    </div>
  );
}
