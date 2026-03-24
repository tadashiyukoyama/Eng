import { eq, and, desc, gte, lte, sql, like, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser, users,
  companies, clients, transactions, budgets, budgetItems,
  agendaEvents, docTemplates, aiProfiles, supportLogs,
  type Company, type Client, type Transaction, type Budget,
  type BudgetItem, type AgendaEvent, type DocTemplate,
  type AiProfile, type SupportLog,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try { _db = drizzle(process.env.DATABASE_URL); }
    catch (e) { console.warn("[DB] Failed to connect:", e); _db = null; }
  }
  return _db;
}

// ─── USERS ────────────────────────────────────────────────────────────────────
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required");
  const db = await getDb();
  if (!db) return;
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  textFields.forEach((f) => {
    if (user[f] !== undefined) { values[f] = user[f] ?? null; updateSet[f] = user[f] ?? null; }
  });
  if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
  if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
  else if (user.openId === ENV.ownerOpenId) { values.role = "admin"; updateSet.role = "admin"; }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const r = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return r[0];
}

// ─── COMPANIES ────────────────────────────────────────────────────────────────
export async function getCompanies() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(companies).where(eq(companies.active, true)).orderBy(companies.name);
}

export async function upsertCompany(data: Partial<Company> & { name: string; slug: string }) {
  const db = await getDb();
  if (!db) return null;
  if (data.id) {
    await db.update(companies).set(data).where(eq(companies.id, data.id));
    return data.id;
  }
  const r = await db.insert(companies).values(data as any);
  return (r as any)[0]?.insertId ?? null;
}

// ─── CLIENTS ─────────────────────────────────────────────────────────────────
export async function getClients(companyId?: number, status?: string, search?: string) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (companyId) conditions.push(eq(clients.companyId, companyId));
  if (status) conditions.push(eq(clients.status, status as any));
  if (search) conditions.push(or(like(clients.name, `%${search}%`), like(clients.phone, `%${search}%`)));
  const q = db.select().from(clients);
  if (conditions.length) q.where(and(...conditions) as any);
  return (q as any).orderBy(desc(clients.createdAt));
}

export async function getClientById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const r = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
  return r[0] ?? null;
}

export async function upsertClient(data: Partial<Client> & { companyId: number; name: string }) {
  const db = await getDb();
  if (!db) return null;
  if (data.id) {
    await db.update(clients).set({ ...data, updatedAt: new Date() }).where(eq(clients.id, data.id));
    return data.id;
  }
  const r = await db.insert(clients).values(data as any);
  return (r as any)[0]?.insertId ?? null;
}

export async function deleteClient(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(clients).where(eq(clients.id, id));
}

// ─── TRANSACTIONS ─────────────────────────────────────────────────────────────
export async function getTransactions(companyId?: number, type?: string, startDate?: Date, endDate?: Date) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (companyId) conditions.push(eq(transactions.companyId, companyId));
  if (type) conditions.push(eq(transactions.type, type as any));
  if (startDate) conditions.push(gte(transactions.createdAt, startDate));
  if (endDate) conditions.push(lte(transactions.createdAt, endDate));
  const q = db.select().from(transactions);
  if (conditions.length) q.where(and(...conditions) as any);
  return (q as any).orderBy(desc(transactions.createdAt));
}

export async function upsertTransaction(data: Partial<Transaction> & { companyId: number; description: string; amount: string; type: string }) {
  const db = await getDb();
  if (!db) return null;
  if (data.id) {
    await db.update(transactions).set({ ...data, updatedAt: new Date() } as any).where(eq(transactions.id, data.id));
    return data.id;
  }
  const r = await db.insert(transactions).values(data as any);
  return (r as any)[0]?.insertId ?? null;
}

export async function deleteTransaction(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(transactions).where(eq(transactions.id, id));
}

export async function getFinancialSummary(companyId?: number) {
  const db = await getDb();
  if (!db) return { income: 0, expense: 0, balance: 0, receivable: 0, payable: 0 };
  const conditions: any[] = [];
  if (companyId) conditions.push(eq(transactions.companyId, companyId));
  const rows = await (conditions.length
    ? db.select().from(transactions).where(and(...conditions) as any)
    : db.select().from(transactions));
  let income = 0, expense = 0, receivable = 0, payable = 0;
  for (const t of rows) {
    const amt = parseFloat(String(t.amount));
    if (t.type === "income" && t.paid) income += amt;
    else if (t.type === "expense" && t.paid) expense += amt;
    else if (t.type === "receivable") receivable += amt;
    else if (t.type === "payable") payable += amt;
  }
  return { income, expense, balance: income - expense, receivable, payable };
}

// ─── BUDGETS ─────────────────────────────────────────────────────────────────
export async function getBudgets(companyId?: number, status?: string) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (companyId) conditions.push(eq(budgets.companyId, companyId));
  if (status) conditions.push(eq(budgets.status, status as any));
  const q = db.select().from(budgets);
  if (conditions.length) q.where(and(...conditions) as any);
  return (q as any).orderBy(desc(budgets.createdAt));
}

export async function getBudgetById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const [budget] = await db.select().from(budgets).where(eq(budgets.id, id)).limit(1);
  if (!budget) return null;
  const items = await db.select().from(budgetItems).where(eq(budgetItems.budgetId, id));
  return { ...budget, items };
}

export async function createBudget(data: Partial<Budget> & { companyId: number; clientName: string; title: string; totalAmount: string }) {
  const db = await getDb();
  if (!db) return null;
  const r = await db.insert(budgets).values(data as any);
  return (r as any)[0]?.insertId ?? null;
}

export async function updateBudget(id: number, data: Partial<Budget>) {
  const db = await getDb();
  if (!db) return;
  await db.update(budgets).set({ ...data, updatedAt: new Date() } as any).where(eq(budgets.id, id));
}

export async function upsertBudgetItems(budgetId: number, items: Partial<BudgetItem>[]) {
  const db = await getDb();
  if (!db) return;
  await db.delete(budgetItems).where(eq(budgetItems.budgetId, budgetId));
  if (items.length) {
    await db.insert(budgetItems).values(items.map((i, idx) => ({ ...i, budgetId, order: idx } as any)));
  }
}

export async function deleteBudget(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(budgetItems).where(eq(budgetItems.budgetId, id));
  await db.delete(budgets).where(eq(budgets.id, id));
}

// ─── AGENDA ──────────────────────────────────────────────────────────────────
export async function getAgendaEvents(companyId?: number, startDate?: Date, endDate?: Date) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (companyId) conditions.push(eq(agendaEvents.companyId, companyId));
  if (startDate) conditions.push(gte(agendaEvents.startAt, startDate));
  if (endDate) conditions.push(lte(agendaEvents.startAt, endDate));
  const q = db.select().from(agendaEvents);
  if (conditions.length) q.where(and(...conditions) as any);
  return (q as any).orderBy(agendaEvents.startAt);
}

export async function upsertAgendaEvent(data: Partial<AgendaEvent> & { companyId: number; title: string; startAt: Date }) {
  const db = await getDb();
  if (!db) return null;
  if (data.id) {
    await db.update(agendaEvents).set({ ...data, updatedAt: new Date() } as any).where(eq(agendaEvents.id, data.id));
    return data.id;
  }
  const r = await db.insert(agendaEvents).values(data as any);
  return (r as any)[0]?.insertId ?? null;
}

export async function deleteAgendaEvent(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(agendaEvents).where(eq(agendaEvents.id, id));
}

// ─── DOC TEMPLATES ────────────────────────────────────────────────────────────
export async function getDocTemplates(companyId?: number, type?: string) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [eq(docTemplates.active, true)];
  if (companyId) conditions.push(or(eq(docTemplates.companyId, companyId), sql`${docTemplates.companyId} IS NULL`) as any);
  if (type) conditions.push(eq(docTemplates.type, type as any));
  return db.select().from(docTemplates).where(and(...conditions) as any).orderBy(docTemplates.name);
}

export async function upsertDocTemplate(data: Partial<DocTemplate> & { name: string; content: string }) {
  const db = await getDb();
  if (!db) return null;
  if (data.id) {
    await db.update(docTemplates).set({ ...data, updatedAt: new Date() } as any).where(eq(docTemplates.id, data.id));
    return data.id;
  }
  const r = await db.insert(docTemplates).values(data as any);
  return (r as any)[0]?.insertId ?? null;
}

export async function deleteDocTemplate(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(docTemplates).set({ active: false } as any).where(eq(docTemplates.id, id));
}

// ─── AI PROFILES ─────────────────────────────────────────────────────────────
export async function getAiProfiles(companyId?: number) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [eq(aiProfiles.active, true)];
  if (companyId) conditions.push(or(eq(aiProfiles.companyId, companyId), sql`${aiProfiles.companyId} IS NULL`) as any);
  return db.select().from(aiProfiles).where(and(...conditions) as any).orderBy(aiProfiles.name);
}

export async function upsertAiProfile(data: Partial<AiProfile> & { name: string; systemPrompt: string }) {
  const db = await getDb();
  if (!db) return null;
  if (data.id) {
    await db.update(aiProfiles).set({ ...data, updatedAt: new Date() } as any).where(eq(aiProfiles.id, data.id));
    return data.id;
  }
  const r = await db.insert(aiProfiles).values(data as any);
  return (r as any)[0]?.insertId ?? null;
}

export async function deleteAiProfile(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(aiProfiles).set({ active: false } as any).where(eq(aiProfiles.id, id));
}

// ─── SUPPORT LOGS ─────────────────────────────────────────────────────────────
export async function getSupportLogs(userId?: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (userId) conditions.push(eq(supportLogs.userId, userId));
  const q = db.select().from(supportLogs);
  if (conditions.length) q.where(and(...conditions) as any);
  return (q as any).orderBy(desc(supportLogs.createdAt)).limit(limit);
}

export async function addSupportLog(data: { userId?: number; role: "user" | "assistant"; content: string; metadata?: Record<string, unknown> }) {
  const db = await getDb();
  if (!db) return null;
  const r = await db.insert(supportLogs).values(data as any);
  return (r as any)[0]?.insertId ?? null;
}

export async function clearSupportLogs(userId?: number) {
  const db = await getDb();
  if (!db) return;
  if (userId) await db.delete(supportLogs).where(eq(supportLogs.userId, userId));
  else await db.delete(supportLogs);
}

// ─── CLIENT FINANCIAL (CRM AVANÇADO) ─────────────────────────────────────────
export async function getTransactionsByClient(clientId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(transactions).where(eq(transactions.clientId, clientId)).orderBy(desc(transactions.createdAt));
}

export async function getClientFinancialSummary(clientId: number) {
  const db = await getDb();
  if (!db) return { totalIncome: 0, totalExpense: 0, totalReceivable: 0, totalPayable: 0, balance: 0, owes: 0 };
  const rows = await db.select().from(transactions).where(eq(transactions.clientId, clientId));
  let totalIncome = 0, totalExpense = 0, totalReceivable = 0, totalPayable = 0;
  for (const t of rows) {
    const amt = parseFloat(String(t.amount));
    if (t.type === "income") totalIncome += amt;
    else if (t.type === "expense") totalExpense += amt;
    else if (t.type === "receivable" && !t.paid) totalReceivable += amt;
    else if (t.type === "payable" && !t.paid) totalPayable += amt;
  }
  return {
    totalIncome,
    totalExpense,
    totalReceivable,
    totalPayable,
    balance: totalIncome - totalExpense,
    owes: totalReceivable, // quanto o cliente me deve (receivables não pagos)
  };
}

export async function getBudgetsByClient(clientId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(budgets).where(eq(budgets.clientId, clientId)).orderBy(desc(budgets.createdAt));
}

export async function getAgendaEventsByClient(clientId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(agendaEvents).where(eq(agendaEvents.clientId, clientId)).orderBy(desc(agendaEvents.startAt));
}

export async function updateClientStatus(id: number, status: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(clients).set({ status: status as any, updatedAt: new Date() }).where(eq(clients.id, id));
}
