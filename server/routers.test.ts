import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeCtx(overrides?: Partial<TrpcContext>): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-user",
      email: "test@example.com",
      name: "Test User",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as unknown as TrpcContext["res"],
    ...overrides,
  };
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

describe("auth.me", () => {
  it("returns the current user when authenticated", async () => {
    const ctx = makeCtx();
    const caller = appRouter.createCaller(ctx);
    const user = await caller.auth.me();
    expect(user).toBeDefined();
    expect(user?.openId).toBe("test-user");
  });

  it("returns null when not authenticated", async () => {
    const ctx = makeCtx({ user: null });
    const caller = appRouter.createCaller(ctx);
    const user = await caller.auth.me();
    expect(user).toBeNull();
  });
});

describe("auth.logout", () => {
  it("returns success and clears cookie", async () => {
    const cleared: string[] = [];
    const ctx = makeCtx({
      res: {
        clearCookie: (name: string) => cleared.push(name),
      } as unknown as TrpcContext["res"],
    });
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result).toEqual({ success: true });
    expect(cleared.length).toBeGreaterThan(0);
  });
});

// ─── Companies (requires DB — skip if no DB) ─────────────────────────────────

describe("companies.list", () => {
  it("throws UNAUTHORIZED when not authenticated", async () => {
    const ctx = makeCtx({ user: null });
    const caller = appRouter.createCaller(ctx);
    await expect(caller.companies.list()).rejects.toThrow();
  });
});

// ─── Transactions ─────────────────────────────────────────────────────────────

describe("transactions.list", () => {
  it("throws UNAUTHORIZED when not authenticated", async () => {
    const ctx = makeCtx({ user: null });
    const caller = appRouter.createCaller(ctx);
    await expect(caller.transactions.list({})).rejects.toThrow();
  });
});

// ─── Budgets ──────────────────────────────────────────────────────────────────

describe("budgets.list", () => {
  it("throws UNAUTHORIZED when not authenticated", async () => {
    const ctx = makeCtx({ user: null });
    const caller = appRouter.createCaller(ctx);
    await expect(caller.budgets.list({})).rejects.toThrow();
  });
});

// ─── Agenda ───────────────────────────────────────────────────────────────────

describe("agenda.list", () => {
  it("throws UNAUTHORIZED when not authenticated", async () => {
    const ctx = makeCtx({ user: null });
    const caller = appRouter.createCaller(ctx);
    await expect(caller.agenda.list({})).rejects.toThrow();
  });
});

// ─── CRM Avançado ─────────────────────────────────────────────────────────────

describe("clients.updateStatus", () => {
  it("throws UNAUTHORIZED when not authenticated", async () => {
    const ctx = makeCtx({ user: null });
    const caller = appRouter.createCaller(ctx);
    await expect(caller.clients.updateStatus({ id: 1, status: "active" })).rejects.toThrow();
  });

  it("validates status enum", async () => {
    const ctx = makeCtx();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.clients.updateStatus({ id: 1, status: "invalid" as any })).rejects.toThrow();
  });
});

describe("clients.financialSummary", () => {
  it("throws UNAUTHORIZED when not authenticated", async () => {
    const ctx = makeCtx({ user: null });
    const caller = appRouter.createCaller(ctx);
    await expect(caller.clients.financialSummary(1)).rejects.toThrow();
  });
});

describe("clients.transactions", () => {
  it("throws UNAUTHORIZED when not authenticated", async () => {
    const ctx = makeCtx({ user: null });
    const caller = appRouter.createCaller(ctx);
    await expect(caller.clients.transactions(1)).rejects.toThrow();
  });
});

describe("clients.budgets", () => {
  it("throws UNAUTHORIZED when not authenticated", async () => {
    const ctx = makeCtx({ user: null });
    const caller = appRouter.createCaller(ctx);
    await expect(caller.clients.budgets(1)).rejects.toThrow();
  });
});

describe("clients.events", () => {
  it("throws UNAUTHORIZED when not authenticated", async () => {
    const ctx = makeCtx({ user: null });
    const caller = appRouter.createCaller(ctx);
    await expect(caller.clients.events(1)).rejects.toThrow();
  });
});

// ─── Support ──────────────────────────────────────────────────────────────────

describe("support.chat", () => {
  it("throws UNAUTHORIZED when not authenticated", async () => {
    const ctx = makeCtx({ user: null });
    const caller = appRouter.createCaller(ctx);
    await expect(caller.support.chat({ message: "hello", history: [] })).rejects.toThrow();
  });
});
