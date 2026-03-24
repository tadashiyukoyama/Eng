import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import {
  getCompanies, upsertCompany,
  getClients, getClientById, upsertClient, deleteClient,
  getTransactions, upsertTransaction, deleteTransaction, getFinancialSummary,
  getBudgets, getBudgetById, createBudget, updateBudget, upsertBudgetItems, deleteBudget,
  getAgendaEvents, upsertAgendaEvent, deleteAgendaEvent,
  getDocTemplates, upsertDocTemplate, deleteDocTemplate,
  getAiProfiles, upsertAiProfile, deleteAiProfile,
  getSupportLogs, addSupportLog, clearSupportLogs,
  getTransactionsByClient, getClientFinancialSummary, getBudgetsByClient, getAgendaEventsByClient, updateClientStatus,
} from "./db";

// ─── COMPANIES ────────────────────────────────────────────────────────────────
const companiesRouter = router({
  list: protectedProcedure.query(() => getCompanies()),
  upsert: protectedProcedure
    .input(z.object({
      id: z.number().optional(),
      name: z.string().min(1),
      slug: z.string().min(1),
      cnpj: z.string().optional(),
      address: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().optional(),
      website: z.string().optional(),
      pix: z.string().optional(),
      primaryColor: z.string().optional(),
    }))
    .mutation(({ input }) => upsertCompany(input as any)),
});

// ─── CLIENTS (CRM) ────────────────────────────────────────────────────────────
const clientsRouter = router({
  list: protectedProcedure
    .input(z.object({
      companyId: z.number().optional(),
      status: z.string().optional(),
      search: z.string().optional(),
    }).optional())
    .query(({ input }) => getClients(input?.companyId, input?.status, input?.search)),
  get: protectedProcedure.input(z.number()).query(({ input }) => getClientById(input)),
  upsert: protectedProcedure
    .input(z.object({
      id: z.number().optional(),
      companyId: z.number(),
      name: z.string().min(1),
      phone: z.string().optional(),
      email: z.string().optional(),
      address: z.string().optional(),
      city: z.string().optional(),
      status: z.enum(["lead", "prospect", "active", "inactive", "lost"]).optional(),
      notes: z.string().optional(),
      source: z.string().optional(),
      tags: z.array(z.string()).optional(),
    }))
    .mutation(({ input }) => upsertClient(input as any)),
  delete: protectedProcedure.input(z.number()).mutation(({ input }) => deleteClient(input)),
  updateStatus: protectedProcedure
    .input(z.object({ id: z.number(), status: z.enum(["lead", "prospect", "active", "inactive", "lost"]) }))
    .mutation(({ input }) => updateClientStatus(input.id, input.status)),
  financialSummary: protectedProcedure
    .input(z.number())
    .query(({ input }) => getClientFinancialSummary(input)),
  transactions: protectedProcedure
    .input(z.number())
    .query(({ input }) => getTransactionsByClient(input)),
  budgets: protectedProcedure
    .input(z.number())
    .query(({ input }) => getBudgetsByClient(input)),
  events: protectedProcedure
    .input(z.number())
    .query(({ input }) => getAgendaEventsByClient(input)),
});

// ─── TRANSACTIONS (FINANCEIRO) ────────────────────────────────────────────────
const transactionsRouter = router({
  list: protectedProcedure
    .input(z.object({
      companyId: z.number().optional(),
      type: z.string().optional(),
      startDate: z.date().optional(),
      endDate: z.date().optional(),
    }).optional())
    .query(({ input }) => getTransactions(input?.companyId, input?.type, input?.startDate, input?.endDate)),
  summary: protectedProcedure
    .input(z.object({ companyId: z.number().optional() }).optional())
    .query(({ input }) => getFinancialSummary(input?.companyId)),
  upsert: protectedProcedure
    .input(z.object({
      id: z.number().optional(),
      companyId: z.number(),
      type: z.enum(["income", "expense", "receivable", "payable"]),
      category: z.string().optional(),
      description: z.string().min(1),
      amount: z.string(),
      dueDate: z.date().optional(),
      paidAt: z.date().optional(),
      paid: z.boolean().optional(),
      clientId: z.number().optional(),
      notes: z.string().optional(),
    }))
    .mutation(({ input }) => upsertTransaction(input as any)),
  delete: protectedProcedure.input(z.number()).mutation(({ input }) => deleteTransaction(input)),
  markPaid: protectedProcedure
    .input(z.object({ id: z.number(), paid: z.boolean() }))
    .mutation(({ input }) => upsertTransaction({ id: input.id, paid: input.paid, paidAt: input.paid ? new Date() : undefined } as any)),
});

// ─── BUDGETS (ORÇAMENTOS) ─────────────────────────────────────────────────────
const budgetsRouter = router({
  list: protectedProcedure
    .input(z.object({ companyId: z.number().optional(), status: z.string().optional() }).optional())
    .query(({ input }) => getBudgets(input?.companyId, input?.status)),
  get: protectedProcedure.input(z.number()).query(({ input }) => getBudgetById(input)),
  create: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      clientId: z.number().optional(),
      clientName: z.string().min(1),
      clientPhone: z.string().optional(),
      clientEmail: z.string().optional(),
      title: z.string().min(1),
      description: z.string().optional(),
      totalAmount: z.string(),
      validUntil: z.date().optional(),
      notes: z.string().optional(),
      items: z.array(z.object({
        description: z.string(),
        quantity: z.string().optional(),
        unitPrice: z.string(),
        totalPrice: z.string(),
      })).optional(),
    }))
    .mutation(async ({ input }) => {
      const { items, ...budgetData } = input;
      const id = await createBudget(budgetData as any);
      if (id && items?.length) await upsertBudgetItems(id, items as any);
      return id;
    }),
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(["draft", "pending", "approved", "rejected", "expired"]).optional(),
      title: z.string().optional(),
      description: z.string().optional(),
      totalAmount: z.string().optional(),
      notes: z.string().optional(),
      pdfUrl: z.string().optional(),
      items: z.array(z.object({
        description: z.string(),
        quantity: z.string().optional(),
        unitPrice: z.string(),
        totalPrice: z.string(),
      })).optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, items, ...data } = input;
      await updateBudget(id, data as any);
      if (items) await upsertBudgetItems(id, items as any);
    }),
  delete: protectedProcedure.input(z.number()).mutation(({ input }) => deleteBudget(input)),
  generateWithAI: protectedProcedure
    .input(z.object({
      clientName: z.string(),
      service: z.string(),
      details: z.string().optional(),
      companyName: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `Você é um especialista em criar orçamentos profissionais. Responda APENAS com JSON válido no formato especificado, sem markdown.`,
          },
          {
            role: "user",
            content: `Crie um orçamento profissional para:
Cliente: ${input.clientName}
Serviço: ${input.service}
${input.details ? `Detalhes: ${input.details}` : ""}
${input.companyName ? `Empresa: ${input.companyName}` : ""}

Responda com JSON: { "title": "...", "description": "...", "items": [{ "description": "...", "quantity": "1", "unitPrice": "0.00", "totalPrice": "0.00" }], "totalAmount": "0.00", "notes": "..." }`,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "budget_data",
            strict: true,
            schema: {
              type: "object",
              properties: {
                title: { type: "string" },
                description: { type: "string" },
                items: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      description: { type: "string" },
                      quantity: { type: "string" },
                      unitPrice: { type: "string" },
                      totalPrice: { type: "string" },
                    },
                    required: ["description", "quantity", "unitPrice", "totalPrice"],
                    additionalProperties: false,
                  },
                },
                totalAmount: { type: "string" },
                notes: { type: "string" },
              },
              required: ["title", "description", "items", "totalAmount", "notes"],
              additionalProperties: false,
            },
          },
        },
      });
      const rawContent = response.choices[0]?.message?.content;
      const content = typeof rawContent === "string" ? rawContent : "{}";
      return JSON.parse(content);
    }),
});

// ─── AGENDA ──────────────────────────────────────────────────────────────────
const agendaRouter = router({
  list: protectedProcedure
    .input(z.object({
      companyId: z.number().optional(),
      startDate: z.date().optional(),
      endDate: z.date().optional(),
    }).optional())
    .query(({ input }) => getAgendaEvents(input?.companyId, input?.startDate, input?.endDate)),
  upsert: protectedProcedure
    .input(z.object({
      id: z.number().optional(),
      companyId: z.number(),
      clientId: z.number().optional(),
      clientName: z.string().optional(),
      title: z.string().min(1),
      description: z.string().optional(),
      address: z.string().optional(),
      notes: z.string().optional(),
      startAt: z.date(),
      endAt: z.date().optional(),
      allDay: z.boolean().optional(),
      status: z.enum(["scheduled", "confirmed", "done", "cancelled"]).optional(),
    }))
    .mutation(({ input }) => upsertAgendaEvent(input as any)),
  delete: protectedProcedure.input(z.number()).mutation(({ input }) => deleteAgendaEvent(input)),
  updateStatus: protectedProcedure
    .input(z.object({ id: z.number(), status: z.enum(["scheduled", "confirmed", "done", "cancelled"]) }))
    .mutation(({ input }) => upsertAgendaEvent({ id: input.id, status: input.status } as any)),
});

// ─── DOC STUDIO ──────────────────────────────────────────────────────────────
const docStudioRouter = router({
  list: protectedProcedure
    .input(z.object({ companyId: z.number().optional(), type: z.string().optional() }).optional())
    .query(({ input }) => getDocTemplates(input?.companyId, input?.type)),
  upsert: protectedProcedure
    .input(z.object({
      id: z.number().optional(),
      companyId: z.number().optional(),
      name: z.string().min(1),
      type: z.enum(["proposal", "contract", "whatsapp", "email", "other"]).optional(),
      content: z.string().min(1),
      variables: z.array(z.string()).optional(),
    }))
    .mutation(({ input }) => upsertDocTemplate(input as any)),
  delete: protectedProcedure.input(z.number()).mutation(({ input }) => deleteDocTemplate(input)),
  render: protectedProcedure
    .input(z.object({
      templateId: z.number(),
      variables: z.record(z.string(), z.string()),
    }))
    .mutation(async ({ input }) => {
      const templates = await getDocTemplates();
      const template = templates.find((t: any) => t.id === input.templateId);
      if (!template) throw new Error("Template não encontrado");
      let rendered = String(template.content ?? "");
      for (const [key, val] of Object.entries(input.variables)) {
        rendered = rendered.split(`{{${key}}}`).join(val);
      }
      return { rendered, template };
    }),
  generateWithAI: protectedProcedure
    .input(z.object({
      type: z.string(),
      clientName: z.string().optional(),
      service: z.string().optional(),
      context: z.string().optional(),
      companyName: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const response = await invokeLLM({
        messages: [
          { role: "system", content: "Você é especialista em comunicação empresarial profissional em português brasileiro." },
          {
            role: "user",
            content: `Gere um documento do tipo "${input.type}" profissional.
${input.clientName ? `Cliente: ${input.clientName}` : ""}
${input.service ? `Serviço/Produto: ${input.service}` : ""}
${input.companyName ? `Empresa: ${input.companyName}` : ""}
${input.context ? `Contexto adicional: ${input.context}` : ""}

Use {{variavel}} para campos dinâmicos. Seja profissional e objetivo.`,
          },
        ],
      });
      return response.choices[0]?.message?.content ?? "";
    }),
});

// ─── AI CONFIG ────────────────────────────────────────────────────────────────
const aiConfigRouter = router({
  list: protectedProcedure
    .input(z.object({ companyId: z.number().optional() }).optional())
    .query(({ input }) => getAiProfiles(input?.companyId)),
  upsert: protectedProcedure
    .input(z.object({
      id: z.number().optional(),
      companyId: z.number().optional(),
      name: z.string().min(1),
      type: z.enum(["prospecting_alfa", "prospecting_custom", "attendant", "full", "jarvis"]).optional(),
      systemPrompt: z.string().min(1),
      model: z.string().optional(),
      temperature: z.string().optional(),
      isDefault: z.boolean().optional(),
    }))
    .mutation(({ input }) => upsertAiProfile(input as any)),
  delete: protectedProcedure.input(z.number()).mutation(({ input }) => deleteAiProfile(input)),
});

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
const dashboardRouter = router({
  metrics: protectedProcedure
    .input(z.object({ companyId: z.number().optional() }).optional())
    .query(async ({ input }) => {
      const [summary, budgetList, clientList, eventList] = await Promise.all([
        getFinancialSummary(input?.companyId),
        getBudgets(input?.companyId),
        getClients(input?.companyId),
        getAgendaEvents(input?.companyId, new Date(), new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
      ]);
      const pendingBudgets = budgetList.filter((b: any) => b.status === "pending");
      const pendingBudgetsTotal = pendingBudgets.reduce((s: number, b: any) => s + parseFloat(String(b.totalAmount)), 0);
      return {
        financial: summary,
        totalClients: clientList.length,
        activeClients: clientList.filter((c: any) => c.status === "active").length,
        leads: clientList.filter((c: any) => c.status === "lead").length,
        pendingBudgets: pendingBudgets.length,
        pendingBudgetsTotal,
        upcomingEvents: eventList.length,
        totalBudgets: budgetList.length,
        approvedBudgets: budgetList.filter((b: any) => b.status === "approved").length,
      };
    }),
  aiCommand: protectedProcedure
    .input(z.object({
      command: z.string().min(1),
      companyId: z.number().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const [summary, budgetList, clientList] = await Promise.all([
        getFinancialSummary(input.companyId),
        getBudgets(input.companyId),
        getClients(input.companyId),
      ]);
      const context = `
Dados do sistema Klaus OS:
- Saldo: R$ ${summary.balance.toFixed(2)} | Receitas: R$ ${summary.income.toFixed(2)} | Despesas: R$ ${summary.expense.toFixed(2)}
- A receber: R$ ${summary.receivable.toFixed(2)} | A pagar: R$ ${summary.payable.toFixed(2)}
- Total de clientes: ${clientList.length} | Leads: ${clientList.filter((c: any) => c.status === "lead").length}
- Orçamentos pendentes: ${budgetList.filter((b: any) => b.status === "pending").length} | Aprovados: ${budgetList.filter((b: any) => b.status === "approved").length}
`;
      const response = await invokeLLM({
        messages: [
          { role: "system", content: `Você é o assistente executivo do Klaus OS. Responda de forma direta, objetiva e profissional em português. ${context}` as string },
          { role: "user", content: input.command as string },
        ],
      });
      const aiContent = response.choices[0]?.message?.content;
      return { response: (typeof aiContent === "string" ? aiContent : null) ?? "Sem resposta." };
    }),
});

// ─── SUPPORT IA ───────────────────────────────────────────────────────────────
const supportRouter = router({
  history: protectedProcedure
    .input(z.object({ limit: z.number().optional() }).optional())
    .query(({ ctx, input }) => getSupportLogs(ctx.user?.id, input?.limit ?? 50)),
  chat: protectedProcedure
    .input(z.object({
      message: z.string().min(1),
      history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() })).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await addSupportLog({ userId: ctx.user?.id, role: "user", content: input.message });
      const messages: any[] = [
        {
          role: "system",
          content: `Você é o assistente de suporte técnico do Klaus OS. Ajude o usuário a entender e usar o sistema. Seja preciso, técnico quando necessário, e sempre responda em português.`,
        },
        ...(input.history ?? []).slice(-10),
        { role: "user", content: input.message },
      ];
      const response = await invokeLLM({ messages });
      const rawMsg = response.choices[0]?.message?.content;
      const assistantMsg = (typeof rawMsg === "string" ? rawMsg : null) ?? "Sem resposta.";
      await addSupportLog({ userId: ctx.user?.id, role: "assistant", content: assistantMsg });
      return { response: assistantMsg };
    }),
  clearHistory: protectedProcedure.mutation(({ ctx }) => clearSupportLogs(ctx.user?.id)),
});

// ─── APP ROUTER ───────────────────────────────────────────────────────────────
export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  companies: companiesRouter,
  clients: clientsRouter,
  transactions: transactionsRouter,
  budgets: budgetsRouter,
  agenda: agendaRouter,
  docStudio: docStudioRouter,
  aiConfig: aiConfigRouter,
  dashboard: dashboardRouter,
  support: supportRouter,
});

export type AppRouter = typeof appRouter;
