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
import { Plus, Loader2, Settings, Trash2, Edit2, Zap, Brain } from "lucide-react";

const TYPE_LABELS: Record<string, { label: string; desc: string }> = {
  prospecting_alfa: { label: "Prospecção Alfa", desc: "Focado em prospecção de clientes Alfa" },
  prospecting_custom: { label: "Prospecção Custom", desc: "Prospecção personalizada" },
  attendant: { label: "Atendente", desc: "Atendimento ao cliente" },
  full: { label: "Full", desc: "Assistente completo" },
  jarvis: { label: "Jarvis", desc: "Assistente pessoal Jarvis" },
};

const DEFAULT_PROMPTS: Record<string, string> = {
  prospecting_alfa: "Você é um especialista em prospecção de clientes para serviços de engenharia elétrica. Seja direto, profissional e focado em converter leads em clientes. Apresente os diferenciais da empresa de forma clara.",
  prospecting_custom: "Você é um assistente de prospecção personalizado. Adapte sua abordagem ao perfil do cliente e ao serviço oferecido.",
  attendant: "Você é um atendente virtual profissional. Responda de forma cordial, objetiva e sempre tente resolver o problema do cliente ou encaminhá-lo para o setor correto.",
  full: "Você é o assistente executivo completo do Klaus OS. Ajude com todas as tarefas: financeiro, CRM, agendamentos, orçamentos e comunicação.",
  jarvis: "Você é o Jarvis, assistente pessoal executivo. Seja proativo, inteligente e sempre antecipe as necessidades do usuário. Responda de forma natural e conversacional.",
};

type ProfileForm = {
  id?: number; companyId?: number; name: string; type: string;
  systemPrompt: string; model: string; temperature: string; isDefault: boolean;
};

const EMPTY: ProfileForm = {
  name: "", type: "full", systemPrompt: DEFAULT_PROMPTS.full,
  model: "gpt-4o", temperature: "0.7", isDefault: false,
};

export default function AIConfig() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ProfileForm>(EMPTY);

  const utils = trpc.useUtils();
  const { data: companies } = trpc.companies.list.useQuery();
  const { data: profiles, isLoading } = trpc.aiConfig.list.useQuery({});

  const upsert = trpc.aiConfig.upsert.useMutation({
    onSuccess: () => {
      toast.success("Perfil salvo!"); utils.aiConfig.list.invalidate();
      setOpen(false); setForm(EMPTY);
    },
    onError: () => toast.error("Erro ao salvar perfil"),
  });

  const del = trpc.aiConfig.delete.useMutation({
    onSuccess: () => { toast.success("Removido"); utils.aiConfig.list.invalidate(); },
  });

  const openEdit = (p: any) => {
    setForm({
      id: p.id, companyId: p.companyId, name: p.name, type: p.type ?? "full",
      systemPrompt: p.systemPrompt, model: p.model ?? "gpt-4o",
      temperature: String(p.temperature ?? "0.7"), isDefault: p.isDefault ?? false,
    });
    setOpen(true);
  };

  const handleSave = () => {
    if (!form.name.trim() || !form.systemPrompt.trim()) return toast.error("Nome e prompt são obrigatórios");
    upsert.mutate({ ...form, type: form.type as any, companyId: form.companyId || undefined });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold gradient-text">Config IA</h1>
          <p className="text-muted-foreground text-sm mt-1">Perfis e configurações de inteligência artificial</p>
        </div>
        <Button onClick={() => { setForm(EMPTY); setOpen(true); }} className="gap-2">
          <Plus className="h-4 w-4" /> Novo Perfil
        </Button>
      </div>

      {/* Templates pré-definidos */}
      <Card className="glass-card border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" /> Criar a partir de template
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {Object.entries(TYPE_LABELS).map(([k, v]) => (
              <Button
                key={k}
                variant="outline"
                className="h-auto flex-col gap-1 p-3 text-left items-start hover:border-primary/50"
                onClick={() => {
                  setForm({ ...EMPTY, type: k, name: v.label, systemPrompt: DEFAULT_PROMPTS[k] ?? "" });
                  setOpen(true);
                }}
              >
                <span className="text-xs font-medium">{v.label}</span>
                <span className="text-xs text-muted-foreground font-normal">{v.desc}</span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Lista de perfis */}
      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : profiles?.length === 0 ? (
        <Card className="glass-card">
          <CardContent className="p-12 text-center">
            <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">Nenhum perfil de IA configurado</p>
            <p className="text-xs text-muted-foreground mt-1">Use os templates acima para começar</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {profiles?.map((p: any) => {
            const tl = TYPE_LABELS[p.type] ?? { label: p.type, desc: "" };
            return (
              <Card key={p.id} className="glass-card hover:border-primary/20 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold truncate">{p.name}</h3>
                        <Badge variant="outline" className="text-xs">{tl.label}</Badge>
                        {p.isDefault && <Badge className="bg-primary/20 text-primary border-primary/30 text-xs">Padrão</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-3">{p.systemPrompt}</p>
                      <div className="flex gap-2 mt-2 text-xs text-muted-foreground">
                        <span>Modelo: {p.model ?? "padrão"}</span>
                        <span>Temp: {p.temperature ?? "0.7"}</span>
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(p)}>
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => del.mutate(p.id)}>
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
        <DialogContent className="bg-card border-border max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{form.id ? "Editar Perfil" : "Novo Perfil IA"}</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nome *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Nome do perfil" className="mt-1 bg-background border-border" />
              </div>
              <div>
                <Label>Tipo</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v, systemPrompt: DEFAULT_PROMPTS[v] ?? form.systemPrompt })}>
                  <SelectTrigger className="mt-1 bg-background border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Empresa (opcional)</Label>
                <Select value={form.companyId ? String(form.companyId) : "none"}
                  onValueChange={(v) => setForm({ ...form, companyId: v !== "none" ? parseInt(v) : undefined })}>
                  <SelectTrigger className="mt-1 bg-background border-border"><SelectValue placeholder="Global" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Global (todas)</SelectItem>
                    {companies?.map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Temperatura (0-1)</Label>
                <Input type="number" min="0" max="1" step="0.1" value={form.temperature}
                  onChange={(e) => setForm({ ...form, temperature: e.target.value })}
                  className="mt-1 bg-background border-border" />
              </div>
              <div className="col-span-2">
                <Label>System Prompt *</Label>
                <Textarea value={form.systemPrompt} onChange={(e) => setForm({ ...form, systemPrompt: e.target.value })}
                  rows={8} placeholder="Instruções do sistema para a IA..."
                  className="mt-1 bg-background border-border resize-none text-sm" />
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
