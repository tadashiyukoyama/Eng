import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Loader2, Calendar, MapPin, User, Clock, Trash2, Check } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  scheduled: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  confirmed: "bg-green-500/20 text-green-400 border-green-500/30",
  done: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  cancelled: "bg-red-500/20 text-red-400 border-red-500/30",
};
const STATUS_LABELS: Record<string, string> = {
  scheduled: "Agendado", confirmed: "Confirmado", done: "Concluído", cancelled: "Cancelado",
};

type EventForm = {
  id?: number; companyId: number; clientName: string; title: string;
  description: string; address: string; notes: string;
  startAt: string; endAt: string; allDay: boolean; status: string;
};

const EMPTY: EventForm = {
  companyId: 1, clientName: "", title: "", description: "",
  address: "", notes: "", startAt: "", endAt: "", allDay: false, status: "scheduled",
};

export default function Agenda() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<EventForm>(EMPTY);
  const [statusFilter, setStatusFilter] = useState("all");

  const utils = trpc.useUtils();
  const { data: companies } = trpc.companies.list.useQuery();
  const { data: events, isLoading } = trpc.agenda.list.useQuery({});

  const upsert = trpc.agenda.upsert.useMutation({
    onSuccess: () => {
      toast.success(form.id ? "Evento atualizado!" : "Evento criado!");
      utils.agenda.list.invalidate();
      setOpen(false); setForm(EMPTY);
    },
    onError: () => toast.error("Erro ao salvar evento"),
  });

  const del = trpc.agenda.delete.useMutation({
    onSuccess: () => { toast.success("Evento removido"); utils.agenda.list.invalidate(); },
  });

  const updateStatus = trpc.agenda.updateStatus.useMutation({
    onSuccess: () => utils.agenda.list.invalidate(),
  });

  const handleSave = () => {
    if (!form.title.trim() || !form.startAt) return toast.error("Título e data são obrigatórios");
    upsert.mutate({
      ...form,
      id: form.id,
      startAt: new Date(form.startAt),
      endAt: form.endAt ? new Date(form.endAt) : undefined,
      status: form.status as any,
      clientName: form.clientName || undefined,
      description: form.description || undefined,
      address: form.address || undefined,
      notes: form.notes || undefined,
    });
  };

  const filtered = events?.filter((e: any) => statusFilter === "all" || e.status === statusFilter) ?? [];

  // Agrupar por data
  const grouped: Record<string, any[]> = {};
  for (const e of filtered) {
    const d = new Date(e.startAt).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
    if (!grouped[d]) grouped[d] = [];
    grouped[d].push(e);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold gradient-text">Agenda</h1>
          <p className="text-muted-foreground text-sm mt-1">Agendamentos e compromissos</p>
        </div>
        <Button onClick={() => { setForm(EMPTY); setOpen(true); }} className="gap-2">
          <Plus className="h-4 w-4" /> Novo Evento
        </Button>
      </div>

      {/* Filtro de status */}
      <div className="flex gap-2 flex-wrap">
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

      {/* Lista agrupada por data */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : Object.keys(grouped).length === 0 ? (
        <Card className="glass-card">
          <CardContent className="p-12 text-center">
            <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">Nenhum evento encontrado</p>
            <Button variant="outline" className="mt-4" onClick={() => { setForm(EMPTY); setOpen(true); }}>
              Criar primeiro evento
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([date, evts]) => (
            <div key={date}>
              <h3 className="text-sm font-medium text-muted-foreground capitalize mb-2 flex items-center gap-2">
                <Calendar className="h-4 w-4" /> {date}
              </h3>
              <div className="space-y-2">
                {evts.map((e: any) => {
                  const sc = STATUS_COLORS[e.status] ?? STATUS_COLORS.scheduled;
                  const comp = companies?.find((c: any) => c.id === e.companyId);
                  return (
                    <Card key={e.id} className="glass-card hover:border-primary/20 transition-colors">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-semibold">{e.title}</h4>
                              <Badge className={`${sc} border text-xs`}>{STATUS_LABELS[e.status]}</Badge>
                              {comp && <Badge variant="outline" className="text-xs">{comp.name}</Badge>}
                            </div>
                            <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {new Date(e.startAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                                {e.endAt && ` – ${new Date(e.endAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`}
                              </span>
                              {e.clientName && <span className="flex items-center gap-1"><User className="h-3 w-3" />{e.clientName}</span>}
                              {e.address && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{e.address}</span>}
                            </div>
                            {e.notes && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{e.notes}</p>}
                          </div>
                          <div className="flex gap-1 shrink-0">
                            {e.status !== "done" && (
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-green-400"
                                onClick={() => updateStatus.mutate({ id: e.id, status: "done" })}>
                                <Check className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => del.mutate(e.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader><DialogTitle>{form.id ? "Editar Evento" : "Novo Evento"}</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Título *</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Título do evento" className="mt-1 bg-background border-border" />
              </div>
              <div>
                <Label>Empresa</Label>
                <Select value={String(form.companyId)} onValueChange={(v) => setForm({ ...form, companyId: parseInt(v) })}>
                  <SelectTrigger className="mt-1 bg-background border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {companies?.map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger className="mt-1 bg-background border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Início *</Label>
                <Input type="datetime-local" value={form.startAt} onChange={(e) => setForm({ ...form, startAt: e.target.value })}
                  className="mt-1 bg-background border-border" />
              </div>
              <div>
                <Label>Fim</Label>
                <Input type="datetime-local" value={form.endAt} onChange={(e) => setForm({ ...form, endAt: e.target.value })}
                  className="mt-1 bg-background border-border" />
              </div>
              <div>
                <Label>Cliente</Label>
                <Input value={form.clientName} onChange={(e) => setForm({ ...form, clientName: e.target.value })}
                  placeholder="Nome do cliente" className="mt-1 bg-background border-border" />
              </div>
              <div>
                <Label>Endereço</Label>
                <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="Local do evento" className="mt-1 bg-background border-border" />
              </div>
              <div className="col-span-2">
                <Label>Notas</Label>
                <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={3} className="mt-1 bg-background border-border resize-none" />
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
