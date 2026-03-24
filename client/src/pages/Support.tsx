import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Send, Loader2, MessageSquare, Trash2, Bot, User } from "lucide-react";
import { Streamdown } from "streamdown";

type Message = { role: "user" | "assistant"; content: string };

const QUICK_QUESTIONS = [
  "Como criar um orçamento?",
  "Como adicionar um cliente?",
  "Como usar o Jarvis?",
  "Como configurar a IA?",
  "Como registrar uma transação?",
];

export default function Support() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const chat = trpc.support.chat.useMutation({
    onSuccess: (data) => {
      setMessages((m) => [...m, { role: "assistant", content: data.response }]);
    },
    onError: () => toast.error("Erro ao enviar mensagem"),
  });

  const clearHistory = trpc.support.clearHistory.useMutation({
    onSuccess: () => { setMessages([]); toast.success("Histórico limpo"); },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = (msg?: string) => {
    const text = msg ?? input;
    if (!text.trim()) return;
    const userMsg: Message = { role: "user", content: text };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    chat.mutate({
      message: text,
      history: messages.slice(-10),
    });
  };

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold gradient-text">Suporte IA</h1>
          <p className="text-muted-foreground text-sm mt-1">Assistente técnico do Klaus OS</p>
        </div>
        {messages.length > 0 && (
          <Button variant="outline" size="sm" className="gap-2"
            onClick={() => clearHistory.mutate()}>
            <Trash2 className="h-3.5 w-3.5" /> Limpar
          </Button>
        )}
      </div>

      {/* Chat */}
      <Card className="glass-card flex-1 flex flex-col min-h-[500px]">
        <CardContent className="flex flex-col h-full p-0">
          {/* Mensagens */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full py-12 gap-4">
                <div className="p-4 rounded-full bg-primary/10">
                  <Bot className="h-8 w-8 text-primary" />
                </div>
                <div className="text-center">
                  <h3 className="font-medium">Assistente de Suporte Klaus OS</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Tire dúvidas sobre como usar o sistema
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 justify-center max-w-md">
                  {QUICK_QUESTIONS.map((q) => (
                    <Button
                      key={q}
                      variant="outline"
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => send(q)}
                    >
                      {q}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
                <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${
                  m.role === "user" ? "bg-primary/20" : "bg-muted"
                }`}>
                  {m.role === "user"
                    ? <User className="h-3.5 w-3.5 text-primary" />
                    : <Bot className="h-3.5 w-3.5 text-muted-foreground" />
                  }
                </div>
                <div className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm ${
                  m.role === "user"
                    ? "bg-primary/20 text-foreground"
                    : "bg-muted text-foreground"
                }`}>
                  {m.role === "assistant"
                    ? <Streamdown>{m.content}</Streamdown>
                    : <p>{m.content}</p>
                  }
                </div>
              </div>
            ))}

            {chat.isPending && (
              <div className="flex gap-3">
                <div className="shrink-0 w-7 h-7 rounded-full bg-muted flex items-center justify-center">
                  <Bot className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <div className="bg-muted rounded-xl px-4 py-3">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-border">
            {messages.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-3">
                {QUICK_QUESTIONS.slice(0, 3).map((q) => (
                  <Button key={q} variant="outline" size="sm" className="text-xs h-6"
                    onClick={() => send(q)}>
                    {q}
                  </Button>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Input
                placeholder="Pergunte sobre o sistema..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
                className="bg-background border-border"
              />
              <Button
                onClick={() => send()}
                disabled={chat.isPending || !input.trim()}
                size="icon"
              >
                {chat.isPending
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Send className="h-4 w-4" />
                }
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
