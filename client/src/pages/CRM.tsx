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
import { Plus, Search, Edit2, Trash2, Loader2, Users, Phone, Mail, MapPin } from "lucide-react";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  lead: { label: "Lead", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  prospect: { label: "Prospect", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  active: { label: "Ativo", color: "bg-green-500/20 text-green-400 border-green-500/30" },
  inactive: { label: "Inativo", color: "bg-gray-500/20 text-gray-400 border-gray-500/30" },
  lost: { label: "Perdido", color: "bg-red-500/20 text-red-400 border-red-500/30" },
};

type ClientForm = {
  id?: number; companyId: number; name: string; phone: string; email: string;
  address: string; city: string; status: string; notes: string; source: string;
};

const EMPTY_FORM: ClientForm = {
  companyId: 1, name: "", phone: "", email: "", address: "",
  city: "", status: "lead", notes: "", source: "",
};

export default function CRM() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ClientForm>(EMPTY_FORM);

  const utils = trpc.useUtils();
  const { data: companies } = trpc.companies.list.useQuery();
  const { data: clients, isLoading } = trpc.clients.list.useQuery({
    companyId: companyFilter !== "all" ? parseInt(companyFilter) : undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
    search: search || undefined,
  });

  const upsert = trpc.clients.upsert.useMutation({
    onSuccess: () => {
      toast.success(form.id ? "Cliente atualizado!" : "Cliente criado!");
      utils.clients.list.invalidate();
      setOpen(false);
      setForm(EMPTY_FORM);
    },
    onError: () => toast.error("Erro ao salvar cliente"),
  });

  const del = trpc.clients.delete.useMutation({
    onSuccess: () => { toast.success("Cliente removido"); utils.clients.list.invalidate(); },
    onError: () => toast.error("Erro ao remover"),
  });

  const openEdit = (c: any) => {
    setForm({
      id: c.id, companyId: c.companyId, name: c.name ?? "", phone: c.phone ?? "",
      email: c.email ?? "", address: c.address ?? "", city: c.city ?? "",
      status: c.status ?? "lead", notes: c.notes ?? "", source: c.source ?? "",
    });
    setOpen(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) return toast.error("Nome é obrigatório");
    upsert.mutate({
      ...form,
      status: form.status as any,
      phone: form.phone || undefined,
      email: form.email || undefined,
      address: form.address || undefined,
      city: form.city || undefined,
      notes: form.notes || undefined,
      source: form.source || undefined,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold gradient-text">CRM</h1>
          <p className="text-muted-foreground text-sm mt-1">Gestão de leads e clientes</p>
        </div>
        <Button onClick={() => { setForm(EMPTY_FORM); setOpen(true); }} className="gap-2">
          <Plus className="h-4 w-4" /> Novo Cliente
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou telefone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-card border-border"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40 bg-card border-border">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
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

      {/* Stats rápidos */}
      <div className="grid grid-cols-5 gap-3">
        {Object.entries(STATUS_LABELS).map(([k, v]) => {
          const count = clients?.filter((c: any) => c.status === k).length ?? 0;
          return (
            <Card key={k} className="glass-card cursor-pointer hover:border-primary/30 transition-colors"
              onClick={() => setStatusFilter(statusFilter === k ? "all" : k)}>
              <CardContent className="p-3 text-center">
                <p className="text-xl font-bold">{count}</p>
                <Badge className={`${v.color} border text-xs mt-1`}>{v.label}</Badge>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <div className="grid gap-3">
          {clients?.length === 0 && (
            <Card className="glass-card">
              <CardContent className="p-12 text-center">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">Nenhum cliente encontrado</p>
                <Button variant="outline" className="mt-4" onClick={() => { setForm(EMPTY_FORM); setOpen(true); }}>
                  Adicionar primeiro cliente
                </Button>
              </CardContent>
            </Card>
          )}
          {clients?.map((c: any) => {
            const s = STATUS_LABELS[c.status] ?? STATUS_LABELS.lead;
            const comp = companies?.find((co: any) => co.id === c.companyId);
            return (
              <Card key={c.id} className="glass-card hover:border-primary/20 transition-colors">
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
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)}>
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => del.mutate(c.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
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
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar Cliente" : "Novo Cliente"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Nome *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Nome completo" className="mt-1 bg-background border-border" />
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
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger className="mt-1 bg-background border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Telefone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="(11) 99999-0000" className="mt-1 bg-background border-border" />
              </div>
              <div>
                <Label>E-mail</Label>
                <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="email@exemplo.com" className="mt-1 bg-background border-border" />
              </div>
              <div>
                <Label>Cidade</Label>
                <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })}
                  placeholder="São Paulo" className="mt-1 bg-background border-border" />
              </div>
              <div>
                <Label>Origem</Label>
                <Input value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}
                  placeholder="Indicação, Instagram..." className="mt-1 bg-background border-border" />
              </div>
              <div className="col-span-2">
                <Label>Endereço</Label>
                <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="Rua, número, bairro" className="mt-1 bg-background border-border" />
              </div>
              <div className="col-span-2">
                <Label>Observações</Label>
                <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Notas sobre o cliente..." rows={3}
                  className="mt-1 bg-background border-border resize-none" />
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
