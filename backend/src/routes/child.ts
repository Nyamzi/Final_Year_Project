import { Router } from "express";
import { z } from "zod";
import { ChoreStatus, TransactionStatus, TransactionType } from "@prisma/client";
import { authMiddleware, AuthenticatedRequest, requireRole } from "../middleware/auth";
import { prisma } from "../db";

const router = Router();

const txSchema = z.object({
  amount: z.number().positive(),
  type: z.enum(["earn", "spend"]),
  description: z.string().max(200).optional(),
});

const goalSchema = z.object({
  title: z.string().min(2),
  targetAmount: z.number().positive(),
  targetDate: z.string().datetime().optional(),
});

const fundGoalSchema = z.object({
  goalId: z.string().min(1),
  amount: z.number().positive(),
});

// ─── Wallet ──────────────────────────────────────────────────────────────────

router.get("/wallet", authMiddleware, requireRole("child"), async (req: AuthenticatedRequest, res) => {
  try {
    const childProfile = await prisma.childProfile.findUnique({
      where: { childUserId: req.user!.userId },
      include: {
        wallet: true,
        savingsGoals: { orderBy: { createdAt: "desc" } },
      },
    });

    if (!childProfile?.wallet) {
      return res.status(404).json({ error: "Wallet not found" });
    }

    res.json({
      wallet: {
        balance: Number(childProfile.wallet.balance),
        totalEarned: Number(childProfile.wallet.totalEarned),
        totalSpent: Number(childProfile.wallet.totalSpent),
      },
      savingsGoals: childProfile.savingsGoals.map((goal) => ({
        id: goal.id,
        title: goal.title,
        targetAmount: Number(goal.targetAmount),
        currentAmount: Number(goal.currentAmount),
        status: goal.status,
        targetDate: goal.targetDate,
      })),
    });
  } catch (error) {
    console.error("Get wallet error:", error);
    res.status(500).json({ error: "Failed to fetch wallet" });
  }
});

// ─── Transactions ─────────────────────────────────────────────────────────────

router.get("/transactions", authMiddleware, requireRole("child"), async (req: AuthenticatedRequest, res) => {
  try {
    const child = await prisma.childProfile.findUnique({
      where: { childUserId: req.user!.userId },
      include: { wallet: true },
    });

    if (!child?.wallet) {
      return res.status(404).json({ error: "Wallet not found" });
    }

    const transactions = await prisma.transaction.findMany({
      where: { walletId: child.wallet.id },
      orderBy: { createdAt: "desc" },
    });

    res.json({
      transactions: transactions.map((tx) => ({
        id: tx.id,
        amount: Number(tx.amount),
        type: tx.type,
        status: tx.status,
        description: tx.description,
        createdAt: tx.createdAt,
      })),
    });
  } catch (error) {
    console.error("Get transactions error:", error);
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
});

router.post("/transactions", authMiddleware, requireRole("child"), async (req: AuthenticatedRequest, res) => {
  try {
    const parsed = txSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid transaction payload" });
    }

    const child = await prisma.childProfile.findUnique({
      where: { childUserId: req.user!.userId },
      include: {
        wallet: true,
        budgets: { where: { isActive: true }, take: 1, orderBy: { createdAt: "desc" } },
      },
    });

    if (!child?.wallet) {
      return res.status(404).json({ error: "Wallet not found" });
    }

    const amount = parsed.data.amount;
    const type = parsed.data.type as TransactionType;

    let status: TransactionStatus = TransactionStatus.pending;
    if (type === TransactionType.earn) {
      status = TransactionStatus.approved;
    }

    const activeLimit = child.budgets[0] ? Number(child.budgets[0].monthlyLimit) : null;
    if (type === TransactionType.spend && activeLimit !== null && amount <= activeLimit) {
      status = TransactionStatus.approved;
    }

    const created = await prisma.$transaction(async (tx) => {
      const createdTx = await tx.transaction.create({
        data: {
          walletId: child.wallet!.id,
          childId: child.id,
          amount,
          type,
          status,
          description: parsed.data.description,
        },
      });

      if (status === TransactionStatus.approved) {
        if (type === TransactionType.earn) {
          await tx.wallet.update({
            where: { id: child.wallet!.id },
            data: {
              balance: child.wallet!.balance + amount,
              totalEarned: child.wallet!.totalEarned + amount,
            },
          });
        } else {
          await tx.wallet.update({
            where: { id: child.wallet!.id },
            data: {
              balance: child.wallet!.balance - amount,
              totalSpent: child.wallet!.totalSpent + amount,
            },
          });
        }
      }

      return createdTx;
    });

    res.status(201).json({
      message: created.status === TransactionStatus.pending
        ? "Transaction submitted for parent approval"
        : "Transaction recorded",
      transactionId: created.id,
      status: created.status,
    });
  } catch (error) {
    console.error("Create transaction error:", error);
    res.status(500).json({ error: "Failed to create transaction" });
  }
});

// ─── Savings Goals ────────────────────────────────────────────────────────────

router.get("/savings-goals", authMiddleware, requireRole("child"), async (req: AuthenticatedRequest, res) => {
  try {
    const child = await prisma.childProfile.findUnique({
      where: { childUserId: req.user!.userId },
      include: { savingsGoals: { orderBy: { createdAt: "desc" } } },
    });

    if (!child) {
      return res.status(404).json({ error: "Child profile not found" });
    }

    res.json({
      savingsGoals: child.savingsGoals.map((goal) => ({
        id: goal.id,
        title: goal.title,
        targetAmount: Number(goal.targetAmount),
        currentAmount: Number(goal.currentAmount),
        status: goal.status,
        targetDate: goal.targetDate,
      })),
    });
  } catch (error) {
    console.error("Get savings goals error:", error);
    res.status(500).json({ error: "Failed to fetch savings goals" });
  }
});

router.post("/savings-goals", authMiddleware, requireRole("child"), async (req: AuthenticatedRequest, res) => {
  try {
    const parsed = goalSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid savings goal payload" });
    }

    const child = await prisma.childProfile.findUnique({
      where: { childUserId: req.user!.userId },
    });

    if (!child) {
      return res.status(404).json({ error: "Child profile not found" });
    }

    const goal = await prisma.savingsGoal.create({
      data: {
        childId: child.id,
        title: parsed.data.title,
        targetAmount: parsed.data.targetAmount,
        targetDate: parsed.data.targetDate ? new Date(parsed.data.targetDate) : undefined,
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
        targetDate: goal.targetDate,
      },
    });
  } catch (error) {
    console.error("Create savings goal error:", error);
    res.status(500).json({ error: "Failed to create savings goal" });
  }
});

router.post("/savings-goals/fund", authMiddleware, requireRole("child"), async (req: AuthenticatedRequest, res) => {
  try {
    const parsed = fundGoalSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid fund goal payload" });
    }

    const child = await prisma.childProfile.findUnique({
      where: { childUserId: req.user!.userId },
      include: { wallet: true },
    });

    if (!child?.wallet) {
      return res.status(404).json({ error: "Wallet not found" });
    }

    const goal = await prisma.savingsGoal.findFirst({
      where: { id: parsed.data.goalId, childId: child.id },
    });

    if (!goal) {
      return res.status(404).json({ error: "Savings goal not found" });
    }

    const amount = parsed.data.amount;
    if (child.wallet.balance < amount) {
      return res.status(400).json({ error: "Insufficient wallet balance" });
    }

    const [updatedWallet, updatedGoal] = await prisma.$transaction([
      prisma.wallet.update({
        where: { id: child.wallet.id },
        data: {
          balance: child.wallet.balance - amount,
        },
      }),
      prisma.savingsGoal.update({
        where: { id: goal.id },
        data: {
          currentAmount: goal.currentAmount + amount,
        },
      }),
    ]);

    res.status(201).json({
      message: "Goal funded successfully",
      wallet: {
        balance: Number(updatedWallet.balance),
        totalEarned: Number(updatedWallet.totalEarned),
        totalSpent: Number(updatedWallet.totalSpent),
      },
      goal: {
        id: updatedGoal.id,
        title: updatedGoal.title,
        targetAmount: Number(updatedGoal.targetAmount),
        currentAmount: Number(updatedGoal.currentAmount),
        status: updatedGoal.status,
        targetDate: updatedGoal.targetDate,
      },
    });
  } catch (error) {
    console.error("Fund savings goal error:", error);
    res.status(500).json({ error: "Failed to fund savings goal" });
  }
});

// ─── Chores ───────────────────────────────────────────────────────────────────

router.get("/chores", authMiddleware, requireRole("child"), async (req: AuthenticatedRequest, res) => {
  try {
    const child = await prisma.childProfile.findUnique({
      where: { childUserId: req.user!.userId },
      include: { chores: { orderBy: [{ status: "asc" }, { createdAt: "desc" }] } },
    });

    if (!child) {
      return res.status(404).json({ error: "Child profile not found" });
    }

    res.json({
      chores: child.chores.map((chore) => ({
        id: chore.id,
        title: chore.title,
        description: chore.description,
        dueDate: chore.dueDate?.toISOString() ?? null,
        status: chore.status,
        completedAt: chore.completedAt?.toISOString() ?? null,
      })),
    });
  } catch (error) {
    console.error("Get chores error:", error);
    res.status(500).json({ error: "Failed to fetch chores" });
  }
});

// POST /api/child/chores/:id/complete
router.post("/chores/:id/complete", authMiddleware, requireRole("child"), async (req: AuthenticatedRequest, res) => {
  try {
    const child = await prisma.childProfile.findUnique({
      where: { childUserId: req.user!.userId },
      select: { id: true },
    });

    if (!child) {
      return res.status(404).json({ error: "Child profile not found" });
    }

    const chore = await prisma.choreAssignment.findFirst({
      where: { id: req.params.id, childId: child.id },
      select: { id: true, status: true },
    });

    if (!chore) {
      return res.status(404).json({ error: "Chore not found" });
    }

    if (chore.status === ChoreStatus.completed) {
      return res.status(409).json({ error: "Chore already completed" });
    }

    await prisma.choreAssignment.update({
      where: { id: chore.id },
      data: { status: ChoreStatus.completed, completedAt: new Date() },
    });

    res.json({ message: "Chore marked as completed" });
  } catch (error) {
    console.error("Complete chore error:", error);
    res.status(500).json({ error: "Failed to complete chore" });
  }
});

// ─── Allowances ───────────────────────────────────────────────────────────────

router.get("/allowances", authMiddleware, requireRole("child"), async (req: AuthenticatedRequest, res) => {
  try {
    const child = await prisma.childProfile.findUnique({
      where: { childUserId: req.user!.userId },
      include: {
        allowanceSchedules: {
          where: { isActive: true },
          orderBy: [{ availableOn: "asc" }, { createdAt: "desc" }],
        },
      },
    });

    if (!child) {
      return res.status(404).json({ error: "Child profile not found" });
    }

    res.json({
      allowances: child.allowanceSchedules.map((a) => ({
        id: a.id,
        title: a.title,
        amount: Number(a.amount),
        availableOn: a.availableOn.toISOString(),
        notes: a.notes,
        isActive: a.isActive,
      })),
    });
  } catch (error) {
    console.error("Get allowances error:", error);
    res.status(500).json({ error: "Failed to fetch allowances" });
  }
});

export default router;
