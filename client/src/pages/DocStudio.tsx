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
import { Plus, Loader2, Cpu, Zap, Copy, Trash2, FileText } from "lucide-react";
import { Streamdown } from "streamdown";

const TYPE_LABELS: Record<string, string> = {
  proposal: "Proposta", contract: "Contrato", whatsapp: "WhatsApp", email: "E-mail", other: "Outro",
};

type TemplateForm = {
  id?: number; companyId?: number; name: string; type: string; content: string; variables: string;
};

const EMPTY: TemplateForm = { name: "", type: "proposal", content: "", variables: "" };

export default function DocStudio() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<TemplateForm>(EMPTY);
  const [renderOpen, setRenderOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [varValues, setVarValues] = useState<Record<string, string>>({});
  const [rendered, setRendered] = useState("");
  const [aiType, setAiType] = useState("proposal");
  const [aiContext, setAiContext] = useState("");
  const [aiResult, setAiResult] = useState("");

  const utils = trpc.useUtils();
  const { data: companies } = trpc.companies.list.useQuery();
  const { data: templates, isLoading } = trpc.docStudio.list.useQuery({});

  const upsert = trpc.docStudio.upsert.useMutation({
    onSuccess: () => {
      toast.success("Template salvo!"); utils.docStudio.list.invalidate();
      setOpen(false); setForm(EMPTY);
    },
    onError: () => toast.error("Erro ao salvar template"),
  });

  const del = trpc.docStudio.delete.useMutation({
    onSuccess: () => { toast.success("Removido"); utils.docStudio.list.invalidate(); },
  });

  const render = trpc.docStudio.render.useMutation({
    onSuccess: (data) => { setRendered(data.rendered); },
    onError: () => toast.error("Erro ao renderizar"),
  });

  const genAI = trpc.docStudio.generateWithAI.useMutation({
    onSuccess: (data) => { setAiResult(typeof data === "string" ? data : ""); toast.success("Documento gerado!"); },
    onError: () => toast.error("Erro na IA"),
  });

  const openRender = (t: any) => {
    setSelectedTemplate(t);
    const vars = (t.variables ?? []) as string[];
    const initVars: Record<string, string> = {};
    vars.forEach((v: string) => { initVars[v] = ""; });
    setVarValues(initVars);
    setRendered("");
    setRenderOpen(true);
  };

  const handleRender = () => {
    if (!selectedTemplate) return;
    render.mutate({ templateId: selectedTemplate.id, variables: varValues });
  };

  const handleSave = () => {
    if (!form.name.trim() || !form.content.trim()) return toast.error("Nome e conteúdo são obrigatórios");
    const vars = form.variables.split(",").map((v) => v.trim()).filter(Boolean);
    upsert.mutate({ ...form, type: form.type as any, variables: vars, companyId: form.companyId || undefined });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold gradient-text">Doc Studio</h1>
          <p className="text-muted-foreground text-sm mt-1">Templates e geração de documentos</p>
        </div>
        <Button onClick={() => { setForm(EMPTY); setOpen(true); }} className="gap-2">
          <Plus className="h-4 w-4" /> Novo Template
        </Button>
      </div>

      {/* Gerador IA rápido */}
      <Card className="glass-card border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" /> Gerador Rápido com IA
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-3 flex-wrap">
            <Select value={aiType} onValueChange={setAiType}>
              <SelectTrigger className="w-40 bg-background border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TYPE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Contexto: cliente, serviço, empresa..."
              value={aiContext}
              onChange={(e) => setAiContext(e.target.value)}
              className="flex-1 bg-background border-border"
            />
            <Button disabled={genAI.isPending || !aiContext.trim()}
              onClick={() => genAI.mutate({ type: aiType, context: aiContext })}>
              {genAI.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Gerar"}
            </Button>
          </div>
          {aiResult && (
            <div className="bg-background/50 rounded-lg p-4 relative">
              <Button variant="ghost" size="icon" className="absolute top-2 right-2 h-7 w-7"
                onClick={() => { navigator.clipboard.writeText(aiResult); toast.success("Copiado!"); }}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
              <div className="text-sm prose prose-invert max-w-none">
                <Streamdown>{aiResult}</Streamdown>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Templates salvos */}
      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-3">Templates Salvos</h2>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : templates?.length === 0 ? (
          <Card className="glass-card">
            <CardContent className="p-8 text-center text-muted-foreground">
              <FileText className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p>Nenhum template salvo</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {templates?.map((t: any) => (
              <Card key={t.id} className="glass-card hover:border-primary/20 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium truncate">{t.name}</h3>
                        <Badge variant="outline" className="text-xs shrink-0">{TYPE_LABELS[t.type] ?? t.type}</Badge>
                      </div>
                      {t.variables?.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Variáveis: {(t.variables as string[]).join(", ")}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{t.content}</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => openRender(t)}>
                        Usar
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => del.mutate(t.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Dialog criar template */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-card border-border max-w-2xl">
          <DialogHeader><DialogTitle>Novo Template</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nome *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Nome do template" className="mt-1 bg-background border-border" />
              </div>
              <div>
                <Label>Tipo</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger className="mt-1 bg-background border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label>Variáveis (separadas por vírgula)</Label>
                <Input value={form.variables} onChange={(e) => setForm({ ...form, variables: e.target.value })}
                  placeholder="nome_cliente, servico, valor, data" className="mt-1 bg-background border-border" />
                <p className="text-xs text-muted-foreground mt-1">Use {`{{nome_variavel}}`} no conteúdo</p>
              </div>
              <div className="col-span-2">
                <Label>Conteúdo *</Label>
                <Textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })}
                  rows={8} placeholder="Conteúdo do template. Use {{variavel}} para campos dinâmicos."
                  className="mt-1 bg-background border-border resize-none font-mono text-sm" />
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

      {/* Dialog renderizar template */}
      <Dialog open={renderOpen} onOpenChange={setRenderOpen}>
        <DialogContent className="bg-card border-border max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Usar Template: {selectedTemplate?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {Object.keys(varValues).length > 0 && (
              <div className="grid grid-cols-2 gap-3">
                {Object.keys(varValues).map((v) => (
                  <div key={v}>
                    <Label className="capitalize">{v.replace(/_/g, " ")}</Label>
                    <Input value={varValues[v]} onChange={(e) => setVarValues({ ...varValues, [v]: e.target.value })}
                      placeholder={v} className="mt-1 bg-background border-border" />
                  </div>
                ))}
              </div>
            )}
            <Button onClick={handleRender} disabled={render.isPending} className="w-full">
              {render.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Renderizar Documento
            </Button>
            {rendered && (
              <div className="bg-background/50 rounded-lg p-4 relative">
                <Button variant="ghost" size="icon" className="absolute top-2 right-2 h-7 w-7"
                  onClick={() => { navigator.clipboard.writeText(rendered); toast.success("Copiado!"); }}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
                <pre className="text-sm whitespace-pre-wrap font-sans">{rendered}</pre>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenderOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
