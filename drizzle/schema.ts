import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  decimal,
  boolean,
  json,
} from "drizzle-orm/mysql-core";

// ─── USERS ───────────────────────────────────────────────────────────────────
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── COMPANIES ───────────────────────────────────────────────────────────────
export const companies = mysqlTable("companies", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  slug: varchar("slug", { length: 60 }).notNull().unique(),
  cnpj: varchar("cnpj", { length: 20 }),
  address: text("address"),
  phone: varchar("phone", { length: 30 }),
  email: varchar("email", { length: 320 }),
  website: varchar("website", { length: 255 }),
  pix: varchar("pix", { length: 120 }),
  logoUrl: text("logoUrl"),
  primaryColor: varchar("primaryColor", { length: 10 }).default("#059669"),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Company = typeof companies.$inferSelect;

// ─── CLIENTS ─────────────────────────────────────────────────────────────────
export const clients = mysqlTable("clients", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  phone: varchar("phone", { length: 30 }),
  email: varchar("email", { length: 320 }),
  address: text("address"),
  city: varchar("city", { length: 100 }),
  status: mysqlEnum("status", ["lead", "prospect", "active", "inactive", "lost"]).default("lead").notNull(),
  notes: text("notes"),
  source: varchar("source", { length: 100 }),
  tags: json("tags").$type<string[]>().default([]),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Client = typeof clients.$inferSelect;

// ─── TRANSACTIONS ─────────────────────────────────────────────────────────────
export const transactions = mysqlTable("transactions", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  type: mysqlEnum("type", ["income", "expense", "receivable", "payable"]).notNull(),
  category: varchar("category", { length: 100 }),
  description: varchar("description", { length: 500 }).notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  dueDate: timestamp("dueDate"),
  paidAt: timestamp("paidAt"),
  paid: boolean("paid").default(false).notNull(),
  clientId: int("clientId"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Transaction = typeof transactions.$inferSelect;

// ─── BUDGETS ─────────────────────────────────────────────────────────────────
export const budgets = mysqlTable("budgets", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  clientId: int("clientId"),
  clientName: varchar("clientName", { length: 200 }).notNull(),
  clientPhone: varchar("clientPhone", { length: 30 }),
  clientEmail: varchar("clientEmail", { length: 320 }),
  title: varchar("title", { length: 300 }).notNull(),
  description: text("description"),
  status: mysqlEnum("status", ["draft", "pending", "approved", "rejected", "expired"]).default("pending").notNull(),
  totalAmount: decimal("totalAmount", { precision: 12, scale: 2 }).notNull(),
  validUntil: timestamp("validUntil"),
  notes: text("notes"),
  pdfUrl: text("pdfUrl"),
  sentAt: timestamp("sentAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Budget = typeof budgets.$inferSelect;

export const budgetItems = mysqlTable("budget_items", {
  id: int("id").autoincrement().primaryKey(),
  budgetId: int("budgetId").notNull(),
  description: varchar("description", { length: 500 }).notNull(),
  quantity: decimal("quantity", { precision: 8, scale: 2 }).default("1"),
  unitPrice: decimal("unitPrice", { precision: 12, scale: 2 }).notNull(),
  totalPrice: decimal("totalPrice", { precision: 12, scale: 2 }).notNull(),
  order: int("order").default(0),
});

export type BudgetItem = typeof budgetItems.$inferSelect;

// ─── AGENDA EVENTS ────────────────────────────────────────────────────────────
export const agendaEvents = mysqlTable("agenda_events", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  clientId: int("clientId"),
  clientName: varchar("clientName", { length: 200 }),
  title: varchar("title", { length: 300 }).notNull(),
  description: text("description"),
  address: text("address"),
  notes: text("notes"),
  startAt: timestamp("startAt").notNull(),
  endAt: timestamp("endAt"),
  allDay: boolean("allDay").default(false),
  status: mysqlEnum("status", ["scheduled", "confirmed", "done", "cancelled"]).default("scheduled").notNull(),
  reminderSent: boolean("reminderSent").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AgendaEvent = typeof agendaEvents.$inferSelect;

// ─── DOC TEMPLATES ────────────────────────────────────────────────────────────
export const docTemplates = mysqlTable("doc_templates", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId"),
  name: varchar("name", { length: 200 }).notNull(),
  type: mysqlEnum("type", ["proposal", "contract", "whatsapp", "email", "other"]).default("other").notNull(),
  content: text("content").notNull(),
  variables: json("variables").$type<string[]>().default([]),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DocTemplate = typeof docTemplates.$inferSelect;

// ─── AI PROFILES ─────────────────────────────────────────────────────────────
export const aiProfiles = mysqlTable("ai_profiles", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId"),
  name: varchar("name", { length: 200 }).notNull(),
  type: mysqlEnum("type", ["prospecting_alfa", "prospecting_custom", "attendant", "full", "jarvis"]).default("full").notNull(),
  systemPrompt: text("systemPrompt").notNull(),
  model: varchar("model", { length: 100 }).default("gemini-2.5-flash"),
  temperature: decimal("temperature", { precision: 3, scale: 2 }).default("0.7"),
  active: boolean("active").default(true).notNull(),
  isDefault: boolean("isDefault").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AiProfile = typeof aiProfiles.$inferSelect;

// ─── SUPPORT LOGS ─────────────────────────────────────────────────────────────
export const supportLogs = mysqlTable("support_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  role: mysqlEnum("role", ["user", "assistant"]).notNull(),
  content: text("content").notNull(),
  metadata: json("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SupportLog = typeof supportLogs.$inferSelect;
