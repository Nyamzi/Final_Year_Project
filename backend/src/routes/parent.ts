import { Router } from "express";
import { prisma } from "../db";
import { authMiddleware, AuthenticatedRequest, requireRole } from "../middleware/auth";
import { z } from "zod";
import { BudgetPeriod, Role, TransactionStatus, TransactionType } from "@prisma/client";
import { hashPassword } from "../lib/auth";

const router = Router();

const createChildSchema = z.object({
  fullName: z.string().min(3).max(120),
  email: z.string().email(),
  password: z.string().min(8),
  nickname: z.string().min(2),
  age: z.number().int().min(5).max(17),
});

const choreSchema = z.object({
  childId: z.string().min(1),
  title: z.string().min(2).max(120),
  description: z.string().max(250).optional(),
  rewardAmount: z.number().positive().optional(),
  dueDate: z.string().optional(),
});

const allowanceSchema = z.object({
  childId: z.string().min(1),
  title: z.string().min(2).max(120),
  amount: z.number().positive(),
  availableOn: z.string().min(1),
  notes: z.string().max(250).optional(),
});
const updateAllowanceSchema = allowanceSchema;

const spendingLimitSchema = z.object({
  childId: z.string().min(1),
  monthlyLimit: z.number().positive(),
  periodType: z.enum(["weekly", "monthly", "quarterly"]),
});

const profileSchema = z.object({
  fullName: z.string().min(3).max(120),
  nin: z.string().regex(/^[A-Za-z0-9]{8,20}$/),
  phoneNumber: z.string().regex(/^\+?[0-9]{10,15}$/),
  email: z.string().email(),
});

const parentPreferencesSchema = z.object({
  withdrawalApprovalRequired: z.boolean(),
  accountFreezeEnabled: z.boolean(),
  merchantRestrictions: z.string().max(300).optional(),
  quietHours: z.string().max(80).optional(),
  notifyDeposits: z.boolean(),
  notifyWithdrawals: z.boolean(),
  notifySuspiciousLogins: z.boolean(),
  notifyGoals: z.boolean(),
});

const supportTicketSchema = z.object({
  issueType: z.string().min(3).max(120),
  message: z.string().min(8).max(1000),
});

const parentDepositSchema = z.object({
  amount: z.number().positive(),
});

function parseOptionalDate(value?: string): Date | null | undefined {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed;
}

async function processDueAllowancesForParent(parentId: string) {
  const now = new Date();
  const dueAllowances = await prisma.allowanceSchedule.findMany({
    where: {
      parentId,
      isActive: true,
      availableOn: { lte: now },
    },
    include: {
      child: {
        include: {
          wallet: true,
        },
      },
    },
    orderBy: { availableOn: "asc" },
  });

  if (dueAllowances.length === 0) return;

  await prisma.$transaction(async (tx) => {
    for (const allowance of dueAllowances) {
      if (!allowance.child.wallet) continue;

      const deactivated = await tx.allowanceSchedule.updateMany({
        where: {
          id: allowance.id,
          isActive: true,
        },
        data: {
          isActive: false,
        },
      });

      if (deactivated.count === 0) continue;

      await tx.wallet.update({
        where: { id: allowance.child.wallet.id },
        data: {
          balance: allowance.child.wallet.balance + allowance.amount,
          totalEarned: allowance.child.wallet.totalEarned + allowance.amount,
        },
      });

      await tx.transaction.create({
        data: {
          walletId: allowance.child.wallet.id,
          childId: allowance.childId,
          amount: allowance.amount,
          type: TransactionType.earn,
          status: TransactionStatus.approved,
          description: `Scheduled allowance: ${allowance.title}`,
          approvedById: parentId,
          reviewedAt: now,
        },
      });
    }
  });
}

// ─── Children ─────────────────────────────────────────────────────────────────

router.get("/children", authMiddleware, requireRole("parent"), async (req: AuthenticatedRequest, res) => {
  try {
    await processDueAllowancesForParent(req.user!.userId);

    const children = await prisma.childProfile.findMany({
      where: { parentId: req.user!.userId },
      include: {
        childUser: true,
        wallet: true,
        budgets: { where: { isActive: true }, take: 1, orderBy: { createdAt: "desc" } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({
      children: children.map((child) => ({
        id: child.id,
        nickname: child.nickname,
        age: child.age,
        email: child.childUser.email,
        wallet: child.wallet
          ? {
              balance: Number(child.wallet.balance),
              totalEarned: Number(child.wallet.totalEarned),
              totalSpent: Number(child.wallet.totalSpent),
            }
          : null,
        activeSpendingLimit: child.budgets[0] ? Number(child.budgets[0].monthlyLimit) : null,
        activeSpendingLimitPeriod: child.budgets[0]?.periodType ?? null,
      })),
    });
  } catch (error) {
    console.error("Get children error:", error);
    res.status(500).json({ error: "Failed to fetch children" });
  }
});

router.post("/children", authMiddleware, requireRole("parent"), async (req: AuthenticatedRequest, res) => {
  try {
    const parsed = createChildSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid child payload" });
    }

    const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (existing) {
      return res.status(409).json({ error: "Email already exists" });
    }

    const passwordHash = await hashPassword(parsed.data.password);

    const result = await prisma.$transaction(async (tx) => {
      const childUser = await tx.user.create({
        data: {
          fullName: parsed.data.fullName,
          email: parsed.data.email,
          passwordHash,
          role: Role.child,
        },
      });

      const profile = await tx.childProfile.create({
        data: {
          nickname: parsed.data.nickname,
          age: parsed.data.age,
          parentId: req.user!.userId,
          childUserId: childUser.id,
        },
      });

      await tx.wallet.create({ data: { childId: profile.id } });

      return profile;
    });

    res.status(201).json({ message: "Child account created", childId: result.id });
  } catch (error) {
    console.error("Create child error:", error);
    res.status(500).json({ error: "Failed to create child" });
  }
});

// ─── Pending Transactions ─────────────────────────────────────────────────────

router.get("/transactions/pending", authMiddleware, requireRole("parent"), async (req: AuthenticatedRequest, res) => {
  try {
    const pending = await prisma.transaction.findMany({
      where: {
        status: TransactionStatus.pending,
        child: { parentId: req.user!.userId },
      },
      include: { child: true },
      orderBy: { createdAt: "desc" },
    });

    res.json({
      pending: pending.map((item) => ({
        id: item.id,
        childId: item.childId,
        childName: item.child.nickname,
        amount: Number(item.amount),
        type: item.type,
        status: item.status,
        description: item.description,
        createdAt: item.createdAt,
      })),
    });
  } catch (error) {
    console.error("Get pending transactions error:", error);
    res.status(500).json({ error: "Failed to fetch pending transactions" });
  }
});

router.post("/transactions/:id/decision", authMiddleware, requireRole("parent"), async (req: AuthenticatedRequest, res) => {
  try {
    const parsed = z.object({ decision: z.enum(["approved", "rejected"]) }).safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid decision payload" });
    }

    const transaction = await prisma.transaction.findFirst({
      where: {
        id: req.params.id,
        status: TransactionStatus.pending,
        child: { parentId: req.user!.userId },
      },
      include: { wallet: true },
    });
    if (!transaction) {
      return res.status(404).json({ error: "Pending transaction not found" });
    }

    const decision = parsed.data.decision as TransactionStatus;

    const updated = await prisma.$transaction(async (tx) => {
      const updatedTx = await tx.transaction.update({
        where: { id: transaction.id },
        data: {
          status: decision,
          approvedById: req.user!.userId,
          reviewedAt: new Date(),
        },
      });

      if (decision === TransactionStatus.approved) {
        const amount = transaction.amount;
        if (transaction.type === TransactionType.earn) {
          await tx.wallet.update({
            where: { id: transaction.walletId },
            data: {
              balance: transaction.wallet.balance + amount,
              totalEarned: transaction.wallet.totalEarned + amount,
            },
          });
        } else {
          await tx.wallet.update({
            where: { id: transaction.walletId },
            data: {
              balance: transaction.wallet.balance - amount,
              totalSpent: transaction.wallet.totalSpent + amount,
            },
          });
        }
      }

      return updatedTx;
    });

    res.json({ message: `Transaction ${updated.status}` });
  } catch (error) {
    console.error("Transaction decision error:", error);
    res.status(500).json({ error: "Failed to process transaction decision" });
  }
});

// ─── Spending Limits ──────────────────────────────────────────────────────────

router.post("/spending-limit", authMiddleware, requireRole("parent"), async (req: AuthenticatedRequest, res) => {
  try {
    const parsed = spendingLimitSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid spending limit payload" });
    }

    const child = await prisma.childProfile.findFirst({
      where: { id: parsed.data.childId, parentId: req.user!.userId },
    });
    if (!child) {
      return res.status(404).json({ error: "Child not found" });
    }

    await prisma.$transaction(async (tx) => {
      await tx.budget.updateMany({
        where: { childId: child.id, isActive: true },
        data: { isActive: false, periodEnd: new Date() },
      });
      await tx.budget.create({
        data: {
          childId: child.id,
          monthlyLimit: parsed.data.monthlyLimit,
          periodType: parsed.data.periodType as BudgetPeriod,
          isActive: true,
        },
      });
    });

    res.json({ message: "Spending limit updated" });
  } catch (error) {
    console.error("Spending limit error:", error);
    res.status(500).json({ error: "Failed to update spending limit" });
  }
});

// ─── Chores ───────────────────────────────────────────────────────────────────

router.get("/chores", authMiddleware, requireRole("parent"), async (req: AuthenticatedRequest, res) => {
  try {
    const chores = await prisma.choreAssignment.findMany({
      where: { parentId: req.user!.userId },
      include: { child: true },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    });

    res.json({
      chores: chores.map((chore) => ({
        id: chore.id,
        title: chore.title,
        description: chore.description,
        rewardAmount: Number(chore.rewardAmount),
        dueDate: chore.dueDate?.toISOString() ?? null,
        status: chore.status,
        completedAt: chore.completedAt?.toISOString() ?? null,
        childId: chore.childId,
        childName: chore.child.nickname,
      })),
    });
  } catch (error) {
    console.error("Get chores error:", error);
    res.status(500).json({ error: "Failed to fetch chores" });
  }
});

router.post("/chores", authMiddleware, requireRole("parent"), async (req: AuthenticatedRequest, res) => {
  try {
    const parsed = choreSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid chore payload" });
    }

    const child = await prisma.childProfile.findFirst({
      where: { id: parsed.data.childId, parentId: req.user!.userId },
      select: { id: true, nickname: true },
    });
    if (!child) {
      return res.status(404).json({ error: "Child not found" });
    }

    const dueDate = parseOptionalDate(parsed.data.dueDate);
    if (parsed.data.dueDate && dueDate === undefined) {
      return res.status(400).json({ error: "Invalid due date" });
    }

    const chore = await prisma.choreAssignment.create({
      data: {
        childId: child.id,
        parentId: req.user!.userId,
        title: parsed.data.title,
        description: parsed.data.description?.trim() || undefined,
        rewardAmount: parsed.data.rewardAmount ?? 2000,
        dueDate: dueDate ?? undefined,
      },
    });

    res.status(201).json({
      message: "Chore assigned successfully",
      chore: {
        id: chore.id,
        title: chore.title,
        description: chore.description,
        rewardAmount: Number(chore.rewardAmount),
        dueDate: chore.dueDate?.toISOString() ?? null,
        status: chore.status,
        childName: child.nickname,
      },
    });
  } catch (error) {
    console.error("Create chore error:", error);
    res.status(500).json({ error: "Failed to assign chore" });
  }
});

// ─── Allowances ───────────────────────────────────────────────────────────────

router.get("/allowances", authMiddleware, requireRole("parent"), async (req: AuthenticatedRequest, res) => {
  try {
    await processDueAllowancesForParent(req.user!.userId);

    const allowances = await prisma.allowanceSchedule.findMany({
      where: { parentId: req.user!.userId },
      include: { child: true },
      orderBy: [{ availableOn: "asc" }, { createdAt: "desc" }],
    });

    res.json({
      allowances: allowances.map((a) => ({
        id: a.id,
        title: a.title,
        amount: Number(a.amount),
        availableOn: a.availableOn.toISOString(),
        notes: a.notes,
        isActive: a.isActive,
        childId: a.childId,
        childName: a.child.nickname,
      })),
    });
  } catch (error) {
    console.error("Get allowances error:", error);
    res.status(500).json({ error: "Failed to fetch allowances" });
  }
});

router.post("/allowances", authMiddleware, requireRole("parent"), async (req: AuthenticatedRequest, res) => {
  try {
    const parsed = allowanceSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid allowance payload" });
    }

    const child = await prisma.childProfile.findFirst({
      where: { id: parsed.data.childId, parentId: req.user!.userId },
      select: { id: true, nickname: true },
    });
    if (!child) {
      return res.status(404).json({ error: "Child not found" });
    }

    const availableOn = new Date(parsed.data.availableOn);
    if (Number.isNaN(availableOn.getTime())) {
      return res.status(400).json({ error: "Invalid allowance date" });
    }

    const parent = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { id: true, accountBalance: true },
    });
    if (!parent) {
      return res.status(404).json({ error: "Parent account not found" });
    }

    if (Number(parent.accountBalance) < parsed.data.amount) {
      return res.status(400).json({ error: "Insufficient parent account balance for this allowance" });
    }

    const { allowance, updatedParent } = await prisma.$transaction(async (tx) => {
      const createdAllowance = await tx.allowanceSchedule.create({
        data: {
          childId: child.id,
          parentId: req.user!.userId,
          title: parsed.data.title,
          amount: parsed.data.amount,
          availableOn,
          notes: parsed.data.notes?.trim() || undefined,
        },
      });

      const parentUpdate = await tx.user.update({
        where: { id: parent.id },
        data: {
          accountBalance: parent.accountBalance - parsed.data.amount,
        },
        select: { accountBalance: true },
      });

      return {
        allowance: createdAllowance,
        updatedParent: parentUpdate,
      };
    });

    res.status(201).json({
      message: "Allowance scheduled successfully",
      allowance: {
        id: allowance.id,
        title: allowance.title,
        amount: Number(allowance.amount),
        availableOn: allowance.availableOn.toISOString(),
        childName: child.nickname,
      },
      parentBalance: Number(updatedParent.accountBalance),
    });
  } catch (error) {
    console.error("Create allowance error:", error);
    res.status(500).json({ error: "Failed to schedule allowance" });
  }
});

router.delete("/allowances/:id", authMiddleware, requireRole("parent"), async (req: AuthenticatedRequest, res) => {
  try {
    const allowance = await prisma.allowanceSchedule.findFirst({
      where: {
        id: req.params.id,
        parentId: req.user!.userId,
      },
      select: {
        id: true,
        amount: true,
        isActive: true,
      },
    });

    if (!allowance) {
      return res.status(404).json({ error: "Allowance not found" });
    }

    if (!allowance.isActive) {
      return res.status(400).json({ error: "Allowance already paid and cannot be reversed" });
    }

    const updatedParent = await prisma.$transaction(async (tx) => {
      const deleted = await tx.allowanceSchedule.deleteMany({
        where: {
          id: allowance.id,
          parentId: req.user!.userId,
          isActive: true,
        },
      });

      if (deleted.count === 0) {
        throw new Error("Allowance was already processed. Please refresh and try again.");
      }

      return tx.user.update({
        where: { id: req.user!.userId },
        data: {
          accountBalance: {
            increment: allowance.amount,
          },
        },
        select: { accountBalance: true },
      });
    });

    res.json({
      message: "Allowance deleted and refunded to parent account",
      parentBalance: Number(updatedParent.accountBalance),
    });
  } catch (error) {
    console.error("Delete allowance error:", error);
    const message = error instanceof Error ? error.message : "Failed to delete allowance";
    res.status(500).json({ error: message });
  }
});

router.patch("/allowances/:id", authMiddleware, requireRole("parent"), async (req: AuthenticatedRequest, res) => {
  try {
    const parsed = updateAllowanceSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid allowance update payload" });
    }

    const existingAllowance = await prisma.allowanceSchedule.findFirst({
      where: {
        id: req.params.id,
        parentId: req.user!.userId,
      },
      select: {
        id: true,
        amount: true,
        isActive: true,
      },
    });
    if (!existingAllowance) {
      return res.status(404).json({ error: "Allowance not found" });
    }
    if (!existingAllowance.isActive) {
      return res.status(400).json({ error: "Paid allowance cannot be edited" });
    }

    const child = await prisma.childProfile.findFirst({
      where: { id: parsed.data.childId, parentId: req.user!.userId },
      select: { id: true, nickname: true },
    });
    if (!child) {
      return res.status(404).json({ error: "Child not found" });
    }

    const availableOn = new Date(parsed.data.availableOn);
    if (Number.isNaN(availableOn.getTime())) {
      return res.status(400).json({ error: "Invalid allowance date" });
    }

    const amountDifference = parsed.data.amount - Number(existingAllowance.amount);

    const parent = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { id: true, accountBalance: true },
    });
    if (!parent) {
      return res.status(404).json({ error: "Parent account not found" });
    }

    if (amountDifference > 0 && Number(parent.accountBalance) < amountDifference) {
      return res.status(400).json({ error: "Insufficient parent account balance for this update" });
    }

    const { updatedAllowance, updatedParent } = await prisma.$transaction(async (tx) => {
      const allowance = await tx.allowanceSchedule.update({
        where: { id: existingAllowance.id },
        data: {
          childId: child.id,
          title: parsed.data.title,
          amount: parsed.data.amount,
          availableOn,
          notes: parsed.data.notes?.trim() || undefined,
        },
      });

      const parentUpdate = await tx.user.update({
        where: { id: parent.id },
        data: {
          accountBalance: parent.accountBalance - amountDifference,
        },
        select: { accountBalance: true },
      });

      return {
        updatedAllowance: allowance,
        updatedParent: parentUpdate,
      };
    });

    res.json({
      message: "Allowance updated successfully",
      allowance: {
        id: updatedAllowance.id,
        title: updatedAllowance.title,
        amount: Number(updatedAllowance.amount),
        availableOn: updatedAllowance.availableOn.toISOString(),
        notes: updatedAllowance.notes,
        isActive: updatedAllowance.isActive,
        childId: updatedAllowance.childId,
        childName: child.nickname,
      },
      parentBalance: Number(updatedParent.accountBalance),
    });
  } catch (error) {
    console.error("Update allowance error:", error);
    res.status(500).json({ error: "Failed to update allowance" });
  }
});

// ─── All Transactions ─────────────────────────────────────────────────────────

router.get("/transactions", authMiddleware, requireRole("parent"), async (req: AuthenticatedRequest, res) => {
  try {
    await processDueAllowancesForParent(req.user!.userId);

    const childId = typeof req.query.childId === "string" ? req.query.childId : undefined;

    const transactions = await prisma.transaction.findMany({
      where: {
        child: { parentId: req.user!.userId },
        ...(childId ? { childId } : {}),
      },
      include: { child: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    res.json({
      transactions: transactions.map((item) => ({
        id: item.id,
        childId: item.childId,
        childName: item.child.nickname,
        amount: Number(item.amount),
        type: item.type,
        status: item.status,
        description: item.description,
        createdAt: item.createdAt,
      })),
    });
  } catch (error) {
    console.error("Get all transactions error:", error);
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
});

// ─── Fund Child Wallet ────────────────────────────────────────────────────────

const fundSchema = z.object({
  childId: z.string().min(1),
  amount: z.number().positive(),
  description: z.string().max(250).optional(),
});

router.post("/fund", authMiddleware, requireRole("parent"), async (req: AuthenticatedRequest, res) => {
  try {
    const parsed = fundSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid fund payload" });
    }

    const child = await prisma.childProfile.findFirst({
      where: { id: parsed.data.childId, parentId: req.user!.userId },
      include: { wallet: true },
    });
    if (!child || !child.wallet) {
      return res.status(404).json({ error: "Child or wallet not found" });
    }

    const parent = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { id: true, accountBalance: true },
    });
    if (!parent) {
      return res.status(404).json({ error: "Parent account not found" });
    }

    if (Number(parent.accountBalance) < parsed.data.amount) {
      return res.status(400).json({ error: "Insufficient parent account balance" });
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: parent.id },
        data: {
          accountBalance: parent.accountBalance - parsed.data.amount,
        },
      });

      await tx.transaction.create({
        data: {
          walletId: child.wallet!.id,
          childId: child.id,
          amount: parsed.data.amount,
          type: TransactionType.earn,
          status: TransactionStatus.approved,
          description: parsed.data.description ?? "Parent deposit",
          approvedById: req.user!.userId,
          reviewedAt: new Date(),
        },
      });

      await tx.wallet.update({
        where: { id: child.wallet!.id },
        data: {
          balance: child.wallet!.balance + parsed.data.amount,
          totalEarned: child.wallet!.totalEarned + parsed.data.amount,
        },
      });
    });

    const parentAfter = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { accountBalance: true },
    });

    res.status(201).json({
      message: "Funds added successfully",
      parentBalance: Number(parentAfter?.accountBalance ?? 0),
    });
  } catch (error) {
    console.error("Fund child error:", error);
    res.status(500).json({ error: "Failed to fund child account" });
  }
});

// ─── Parent Account Balance & Deposits ───────────────────────────────────────

router.get("/account-balance", authMiddleware, requireRole("parent"), async (req: AuthenticatedRequest, res) => {
  try {
    const parent = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { accountBalance: true, totalDeposited: true },
    });
    if (!parent) {
      return res.status(404).json({ error: "Parent account not found" });
    }

    res.json({
      balance: Number(parent.accountBalance),
      totalDeposited: Number(parent.totalDeposited),
    });
  } catch (error) {
    console.error("Get parent account balance error:", error);
    res.status(500).json({ error: "Failed to fetch parent account balance" });
  }
});

router.post("/deposit", authMiddleware, requireRole("parent"), async (req: AuthenticatedRequest, res) => {
  try {
    const parsed = parentDepositSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid deposit payload" });
    }

    const updated = await prisma.user.update({
      where: { id: req.user!.userId },
      data: {
        accountBalance: { increment: parsed.data.amount },
        totalDeposited: { increment: parsed.data.amount },
      },
      select: { accountBalance: true, totalDeposited: true },
    });

    res.status(201).json({
      message: "Deposit successful",
      balance: Number(updated.accountBalance),
      totalDeposited: Number(updated.totalDeposited),
    });
  } catch (error) {
    console.error("Parent deposit error:", error);
    res.status(500).json({ error: "Failed to deposit money" });
  }
});

// ─── Savings Goals ────────────────────────────────────────────────────────────

const savingsGoalSchema = z.object({
  title: z.string().min(2).max(120),
  targetAmount: z.number().positive(),
  targetDate: z.string().optional(),
});

router.get("/children/:childId/savings-goals", authMiddleware, requireRole("parent"), async (req: AuthenticatedRequest, res) => {
  try {
    const child = await prisma.childProfile.findFirst({
      where: { id: req.params.childId, parentId: req.user!.userId },
    });
    if (!child) {
      return res.status(404).json({ error: "Child not found" });
    }

    const goals = await prisma.savingsGoal.findMany({
      where: { childId: child.id },
      orderBy: { createdAt: "desc" },
    });

    res.json({
      goals: goals.map((g) => ({
        id: g.id,
        title: g.title,
        targetAmount: Number(g.targetAmount),
        currentAmount: Number(g.currentAmount),
        status: g.status,
        targetDate: g.targetDate?.toISOString() ?? null,
      })),
    });
  } catch (error) {
    console.error("Get savings goals error:", error);
    res.status(500).json({ error: "Failed to fetch savings goals" });
  }
});

router.post("/children/:childId/savings-goals", authMiddleware, requireRole("parent"), async (req: AuthenticatedRequest, res) => {
  try {
    const child = await prisma.childProfile.findFirst({
      where: { id: req.params.childId, parentId: req.user!.userId },
    });
    if (!child) {
      return res.status(404).json({ error: "Child not found" });
    }

    const parsed = savingsGoalSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid savings goal payload" });
    }

    const targetDate = parsed.data.targetDate ? new Date(parsed.data.targetDate) : null;
    if (parsed.data.targetDate && targetDate && Number.isNaN(targetDate.getTime())) {
      return res.status(400).json({ error: "Invalid target date" });
    }

    const goal = await prisma.savingsGoal.create({
      data: {
        childId: child.id,
        title: parsed.data.title,
        targetAmount: parsed.data.targetAmount,
        targetDate: targetDate ?? undefined,
      },
    });

    res.status(201).json({
      message: "Savings goal created",
      goal: {
        id: goal.id,
        title: goal.title,
        targetAmount: Number(goal.targetAmount),
        currentAmount: Number(goal.currentAmount),
        status: goal.status,
        targetDate: goal.targetDate?.toISOString() ?? null,
      },
    });
  } catch (error) {
    console.error("Create savings goal error:", error);
    res.status(500).json({ error: "Failed to create savings goal" });
  }
});

// ─── Account ──────────────────────────────────────────────────────────────────

router.get("/learning/lessons", authMiddleware, requireRole("parent"), async (_req: AuthenticatedRequest, res) => {
  try {
    const lessons = await prisma.lesson.findMany({
      where: { isPublished: true },
      orderBy: { createdAt: "desc" },
    });

    res.json({ lessons });
  } catch (error) {
    console.error("Get parent learning lessons error:", error);
    res.status(500).json({ error: "Failed to fetch learning lessons" });
  }
});

router.patch("/account", authMiddleware, requireRole("parent"), async (req: AuthenticatedRequest, res) => {
  try {
    const parsed = profileSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid account profile" });
    }

    const normalizedNin = parsed.data.nin.toUpperCase();
    const [emailUser, ninUser, phoneUser] = await Promise.all([
      prisma.user.findUnique({ where: { email: parsed.data.email }, select: { id: true } }),
      prisma.user.findUnique({ where: { nin: normalizedNin }, select: { id: true } }),
      prisma.user.findUnique({ where: { phoneNumber: parsed.data.phoneNumber }, select: { id: true } }),
    ]);

    if (emailUser && emailUser.id !== req.user!.userId) {
      return res.status(409).json({ error: "Email already registered" });
    }
    if (ninUser && ninUser.id !== req.user!.userId) {
      return res.status(409).json({ error: "NIN already registered" });
    }
    if (phoneUser && phoneUser.id !== req.user!.userId) {
      return res.status(409).json({ error: "Phone number already registered" });
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.user!.userId },
      data: {
        fullName: parsed.data.fullName,
        nin: normalizedNin,
        phoneNumber: parsed.data.phoneNumber,
        email: parsed.data.email,
      },
      select: { fullName: true, nin: true, phoneNumber: true, email: true },
    });

    res.json({ message: "Account details updated", profile: updatedUser });
  } catch (error) {
    console.error("Update account error:", error);
    res.status(500).json({ error: "Failed to update profile" });
  }
});

// ─── Parent Preferences ───────────────────────────────────────────────────────

router.get("/preferences", authMiddleware, requireRole("parent"), async (req: AuthenticatedRequest, res) => {
  try {
    const settings = await prisma.parentSettings.findUnique({
      where: { parentId: req.user!.userId },
    });

    res.json({
      preferences: {
        withdrawalApprovalRequired: settings?.withdrawalApprovalRequired ?? true,
        accountFreezeEnabled: settings?.accountFreezeEnabled ?? false,
        merchantRestrictions: settings?.merchantRestrictions ?? "",
        quietHours: settings?.quietHours ?? "21:00 - 06:00",
        notifyDeposits: settings?.notifyDeposits ?? true,
        notifyWithdrawals: settings?.notifyWithdrawals ?? true,
        notifySuspiciousLogins: settings?.notifySuspiciousLogins ?? true,
        notifyGoals: settings?.notifyGoals ?? true,
      },
    });
  } catch (error) {
    console.error("Get parent preferences error:", error);
    res.status(500).json({ error: "Failed to fetch parent preferences" });
  }
});

router.patch("/preferences", authMiddleware, requireRole("parent"), async (req: AuthenticatedRequest, res) => {
  try {
    const parsed = parentPreferencesSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid parent preferences payload" });
    }

    const data = parsed.data;
    const settings = await prisma.parentSettings.upsert({
      where: { parentId: req.user!.userId },
      update: {
        withdrawalApprovalRequired: data.withdrawalApprovalRequired,
        accountFreezeEnabled: data.accountFreezeEnabled,
        merchantRestrictions: data.merchantRestrictions?.trim() || null,
        quietHours: data.quietHours?.trim() || null,
        notifyDeposits: data.notifyDeposits,
        notifyWithdrawals: data.notifyWithdrawals,
        notifySuspiciousLogins: data.notifySuspiciousLogins,
        notifyGoals: data.notifyGoals,
      },
      create: {
        parentId: req.user!.userId,
        withdrawalApprovalRequired: data.withdrawalApprovalRequired,
        accountFreezeEnabled: data.accountFreezeEnabled,
        merchantRestrictions: data.merchantRestrictions?.trim() || null,
        quietHours: data.quietHours?.trim() || null,
        notifyDeposits: data.notifyDeposits,
        notifyWithdrawals: data.notifyWithdrawals,
        notifySuspiciousLogins: data.notifySuspiciousLogins,
        notifyGoals: data.notifyGoals,
      },
    });

    res.json({
      message: "Parent preferences saved",
      preferences: {
        withdrawalApprovalRequired: settings.withdrawalApprovalRequired,
        accountFreezeEnabled: settings.accountFreezeEnabled,
        merchantRestrictions: settings.merchantRestrictions ?? "",
        quietHours: settings.quietHours ?? "21:00 - 06:00",
        notifyDeposits: settings.notifyDeposits,
        notifyWithdrawals: settings.notifyWithdrawals,
        notifySuspiciousLogins: settings.notifySuspiciousLogins,
        notifyGoals: settings.notifyGoals,
      },
    });
  } catch (error) {
    console.error("Update parent preferences error:", error);
    res.status(500).json({ error: "Failed to save parent preferences" });
  }
});

// ─── Parent Notifications ─────────────────────────────────────────────────────

router.get("/notifications", authMiddleware, requireRole("parent"), async (req: AuthenticatedRequest, res) => {
  try {
    await processDueAllowancesForParent(req.user!.userId);

    const [pendingTx, recentTx, recentAllowances, recentChores] = await Promise.all([
      prisma.transaction.findMany({
        where: { status: TransactionStatus.pending, child: { parentId: req.user!.userId } },
        include: { child: true },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      prisma.transaction.findMany({
        where: { child: { parentId: req.user!.userId } },
        include: { child: true },
        orderBy: { createdAt: "desc" },
        take: 8,
      }),
      prisma.allowanceSchedule.findMany({
        where: { parentId: req.user!.userId },
        include: { child: true },
        orderBy: { updatedAt: "desc" },
        take: 5,
      }),
      prisma.choreAssignment.findMany({
        where: { parentId: req.user!.userId, status: "completed" },
        include: { child: true },
        orderBy: { updatedAt: "desc" },
        take: 5,
      }),
    ]);

    const notificationItems = [
      ...pendingTx.map((tx) => ({
        id: `pending-${tx.id}`,
        type: "approval_required",
        message: `${tx.child.nickname} requested ${tx.type} ${Number(tx.amount).toLocaleString()}`,
        createdAt: tx.createdAt,
      })),
      ...recentTx
        .filter((tx) => tx.status !== TransactionStatus.pending)
        .map((tx) => ({
          id: `tx-${tx.id}`,
          type:
            tx.status === TransactionStatus.approved &&
            (tx.description ?? "").toLowerCase().includes("chore reward")
              ? "chore_reward"
              : tx.status === TransactionStatus.approved
                ? "approved"
                : "rejected",
          message:
            tx.status === TransactionStatus.approved &&
            (tx.description ?? "").toLowerCase().includes("chore reward")
              ? `${tx.child.nickname} completed a chore and received UGX ${Number(tx.amount).toLocaleString()}`
              : `${tx.child.nickname} transaction ${tx.status}: ${tx.type} ${Number(tx.amount).toLocaleString()}`,
          createdAt: tx.updatedAt,
        })),
      ...recentAllowances.map((a) => ({
        id: `allowance-${a.id}`,
        type: "allowance",
        message: a.isActive
          ? `Allowance "${a.title}" scheduled for ${a.child.nickname}`
          : `Allowance "${a.title}" was received by ${a.child.nickname}`,
        createdAt: a.updatedAt,
      })),
      ...recentChores.map((c) => ({
        id: `chore-${c.id}`,
        type: "milestone",
        message: `${c.child.nickname} completed chore "${c.title}"`,
        createdAt: c.updatedAt,
      })),
    ]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 30)
      .map((item) => ({ ...item, createdAt: item.createdAt.toISOString() }));

    res.json({ notifications: notificationItems });
  } catch (error) {
    console.error("Get parent notifications error:", error);
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

// ─── Parent Reports ───────────────────────────────────────────────────────────

router.get("/reports/summary", authMiddleware, requireRole("parent"), async (req: AuthenticatedRequest, res) => {
  try {
    const [transactions, goals, chores] = await Promise.all([
      prisma.transaction.findMany({
        where: { child: { parentId: req.user!.userId } },
        include: { child: true },
      }),
      prisma.savingsGoal.findMany({
        where: { child: { parentId: req.user!.userId } },
      }),
      prisma.choreAssignment.findMany({
        where: { parentId: req.user!.userId },
      }),
    ]);

    const approvedTransactions = transactions.filter((tx) => tx.status === TransactionStatus.approved);
    const pendingCount = transactions.filter((tx) => tx.status === TransactionStatus.pending).length;
    const totalSpent = approvedTransactions
      .filter((tx) => tx.type === TransactionType.spend)
      .reduce((sum, tx) => sum + Number(tx.amount), 0);
    const totalEarned = approvedTransactions
      .filter((tx) => tx.type === TransactionType.earn)
      .reduce((sum, tx) => sum + Number(tx.amount), 0);
    const goalsCompleted = goals.filter((g) => g.status === "completed").length;
    const choresCompleted = chores.filter((c) => c.status === "completed").length;

    res.json({
      summary: {
        approvedCount: approvedTransactions.length,
        pendingCount,
        totalSpent,
        totalEarned,
        goalsCompleted,
        choresCompleted,
      },
    });
  } catch (error) {
    console.error("Get parent report summary error:", error);
    res.status(500).json({ error: "Failed to fetch report summary" });
  }
});

// ─── Parent Support ───────────────────────────────────────────────────────────

router.get("/support-tickets", authMiddleware, requireRole("parent"), async (req: AuthenticatedRequest, res) => {
  try {
    const tickets = await prisma.supportTicket.findMany({
      where: { parentId: req.user!.userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    res.json({
      tickets: tickets.map((ticket) => ({
        id: ticket.id,
        issueType: ticket.issueType,
        message: ticket.message,
        status: ticket.status,
        createdAt: ticket.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("Get support tickets error:", error);
    res.status(500).json({ error: "Failed to fetch support tickets" });
  }
});

router.post("/support-tickets", authMiddleware, requireRole("parent"), async (req: AuthenticatedRequest, res) => {
  try {
    const parsed = supportTicketSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid support ticket payload" });
    }

    const ticket = await prisma.supportTicket.create({
      data: {
        parentId: req.user!.userId,
        issueType: parsed.data.issueType,
        message: parsed.data.message,
      },
    });

    res.status(201).json({
      message: "Support request created",
      ticket: {
        id: ticket.id,
        issueType: ticket.issueType,
        message: ticket.message,
        status: ticket.status,
        createdAt: ticket.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Create support ticket error:", error);
    res.status(500).json({ error: "Failed to create support ticket" });
  }
});

export default router;
