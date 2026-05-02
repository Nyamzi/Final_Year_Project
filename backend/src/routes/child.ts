import { Router } from "express";
import { z } from "zod";
import { BudgetPeriod, ChoreStatus, GoalStatus, Prisma, TransactionStatus, TransactionType } from "@prisma/client";
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

const withdrawalSchema = z.object({
  source: z.enum(["wallet", "goal"]),
  amount: z.number().positive(),
  goalId: z.string().min(1).optional(),
  description: z.string().max(200).optional(),
});

const budgetSchema = z.object({
  title: z.string().min(2).max(40).optional(),
  saveAmount: z.number().min(0),
  spendAmount: z.number().min(0),
  shareAmount: z.number().min(0),
  periodType: z.enum(["weekly", "monthly", "quarterly"]).default("monthly"),
});

const learningProgressSchema = z.object({
  progressPercent: z.number().min(0).max(100),
});

async function awardGoalCompletionStar(
  tx: Prisma.TransactionClient,
  input: { childId: string; goalId: string; goalTitle: string }
) {
  const description = `Golden star for completed savings goal ${input.goalId}`;
  const existing = await tx.achievement.findFirst({
    where: {
      childId: input.childId,
      description,
    },
    select: { id: true },
  });

  if (existing) return;

  await tx.achievement.create({
    data: {
      childId: input.childId,
      title: `Golden Star: ${input.goalTitle}`,
      description,
      points: 1,
      unlockedAt: new Date(),
    },
  });
}

async function awardChildAchievement(
  tx: Prisma.TransactionClient,
  input: { childId: string; title: string; description: string; points?: number }
) {
  const existing = await tx.achievement.findFirst({
    where: {
      childId: input.childId,
      description: input.description,
    },
    select: { id: true },
  });

  if (existing) return;

  await tx.achievement.create({
    data: {
      childId: input.childId,
      title: input.title,
      description: input.description,
      points: input.points ?? 1,
      unlockedAt: new Date(),
    },
  });
}

function getBudgetPeriodStart(date: Date, periodType: BudgetPeriod): Date {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);

  if (periodType === "weekly") {
    const day = start.getDay();
    const diffToMonday = day === 0 ? 6 : day - 1;
    start.setDate(start.getDate() - diffToMonday);
    return start;
  }

  if (periodType === "quarterly") {
    const quarterStartMonth = Math.floor(start.getMonth() / 3) * 3;
    start.setMonth(quarterStartMonth, 1);
    return start;
  }

  start.setDate(1);
  return start;
}

function serializeBudget(budget: {
  id: string;
  title: string;
  monthlyLimit: number;
  saveAmount: number;
  spendAmount: number;
  shareAmount: number;
  periodType: BudgetPeriod;
  isActive: boolean;
  periodStart: Date;
  periodEnd: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: budget.id,
    title: budget.title,
    monthlyLimit: Number(budget.monthlyLimit),
    saveAmount: Number(budget.saveAmount),
    spendAmount: Number(budget.spendAmount),
    shareAmount: Number(budget.shareAmount),
    periodType: budget.periodType,
    isActive: budget.isActive,
    periodStart: budget.periodStart.toISOString(),
    periodEnd: budget.periodEnd?.toISOString() ?? null,
    createdAt: budget.createdAt.toISOString(),
    updatedAt: budget.updatedAt.toISOString(),
  };
}

function getSuggestedBudget(balance: number) {
  return {
    saveAmount: Math.round(balance * 0.5),
    spendAmount: Math.round(balance * 0.3),
    shareAmount: Math.round(balance * 0.2),
  };
}

async function processDueAllowancesForChild(childUserId: string) {
  const child = await prisma.childProfile.findUnique({
    where: { childUserId },
    include: { wallet: true },
  });

  if (!child?.wallet) return;
  const wallet = child.wallet;

  const now = new Date();
  const dueAllowances = await prisma.allowanceSchedule.findMany({
    where: {
      childId: child.id,
      isActive: true,
      availableOn: { lte: now },
    },
    orderBy: { availableOn: "asc" },
  });

  if (dueAllowances.length === 0) return;

  await prisma.$transaction(async (tx) => {
    let releasedAmount = 0;

    for (const allowance of dueAllowances) {
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

      releasedAmount += allowance.amount;

      await tx.transaction.create({
        data: {
          walletId: wallet.id,
          childId: child.id,
          amount: allowance.amount,
          type: TransactionType.earn,
          status: TransactionStatus.approved,
          description: `Scheduled allowance: ${allowance.title}`,
          approvedById: allowance.parentId,
          reviewedAt: now,
        },
      });
    }

    if (releasedAmount > 0) {
      await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: wallet.balance + releasedAmount,
          totalEarned: wallet.totalEarned + releasedAmount,
        },
      });
    }
  });
}

// â”€â”€â”€ Wallet â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

router.get("/wallet", authMiddleware, requireRole("child"), async (req: AuthenticatedRequest, res) => {
  try {
    await processDueAllowancesForChild(req.user!.userId);

    const childProfile = await prisma.childProfile.findUnique({
      where: { childUserId: req.user!.userId },
      include: {
        wallet: true,
        savingsGoals: { orderBy: { createdAt: "desc" } },
        achievements: { orderBy: { unlockedAt: "desc" } },
        budgets: { where: { isActive: true }, take: 1, orderBy: { createdAt: "desc" } },
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
        completedAt: goal.completedAt?.toISOString() ?? null,
      })),
      achievements: childProfile.achievements.map((achievement) => ({
        id: achievement.id,
        title: achievement.title,
        description: achievement.description,
        points: achievement.points,
        unlockedAt: achievement.unlockedAt?.toISOString() ?? null,
      })),
      budget: childProfile.budgets[0] ? serializeBudget(childProfile.budgets[0]) : null,
      suggestedBudget: getSuggestedBudget(Number(childProfile.wallet.balance)),
    });
  } catch (error) {
    console.error("Get wallet error:", error);
    res.status(500).json({ error: "Failed to fetch wallet" });
  }
});

router.get("/budget", authMiddleware, requireRole("child"), async (req: AuthenticatedRequest, res) => {
  try {
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

    res.json({
      budget: child.budgets[0] ? serializeBudget(child.budgets[0]) : null,
      suggestedBudget: getSuggestedBudget(Number(child.wallet.balance)),
    });
  } catch (error) {
    console.error("Get child budget error:", error);
    res.status(500).json({ error: "Failed to fetch budget" });
  }
});

router.post("/budget", authMiddleware, requireRole("child"), async (req: AuthenticatedRequest, res) => {
  try {
    const parsed = budgetSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid budget payload" });
    }

    const child = await prisma.childProfile.findUnique({
      where: { childUserId: req.user!.userId },
      include: { wallet: true },
    });

    if (!child?.wallet) {
      return res.status(404).json({ error: "Wallet not found" });
    }

    const saveAmount = Math.round(parsed.data.saveAmount);
    const spendAmount = Math.round(parsed.data.spendAmount);
    const shareAmount = Math.round(parsed.data.shareAmount);
    const totalBudgeted = saveAmount + spendAmount + shareAmount;

    if (totalBudgeted <= 0) {
      return res.status(400).json({ error: "Add at least one amount to your budget." });
    }

    if (totalBudgeted > Number(child.wallet.balance)) {
      return res.status(400).json({ error: "Your budget cannot be bigger than your wallet balance." });
    }

    const budget = await prisma.$transaction(async (tx) => {
      await tx.budget.updateMany({
        where: { childId: child.id, isActive: true },
        data: { isActive: false, periodEnd: new Date() },
      });

      const createdBudget = await tx.budget.create({
        data: {
          childId: child.id,
          title: parsed.data.title?.trim() || "My Budget",
          monthlyLimit: spendAmount,
          saveAmount,
          spendAmount,
          shareAmount,
          periodType: parsed.data.periodType,
          periodStart: getBudgetPeriodStart(new Date(), parsed.data.periodType),
        },
      });

      await awardChildAchievement(tx, {
        childId: child.id,
        title: "Budget Builder",
        description: "Budget builder badge for saving a child budget plan",
        points: 1,
      });

      return createdBudget;
    });

    res.status(201).json({ message: "Budget saved.", budget: serializeBudget(budget) });
  } catch (error) {
    console.error("Save child budget error:", error);
    res.status(500).json({ error: "Failed to save budget" });
  }
});

router.delete("/budget", authMiddleware, requireRole("child"), async (req: AuthenticatedRequest, res) => {
  try {
    const child = await prisma.childProfile.findUnique({
      where: { childUserId: req.user!.userId },
      select: { id: true },
    });

    if (!child) {
      return res.status(404).json({ error: "Child profile not found" });
    }

    await prisma.budget.updateMany({
      where: { childId: child.id, isActive: true },
      data: { isActive: false, periodEnd: new Date() },
    });

    res.json({ message: "Budget cleared." });
  } catch (error) {
    console.error("Clear child budget error:", error);
    res.status(500).json({ error: "Failed to clear budget" });
  }
});
// â”€â”€â”€ Transactions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

    const activeBudget = child.budgets[0];
    if (type === TransactionType.spend && activeBudget) {
      const activeLimit = Number(activeBudget.monthlyLimit);
      const periodStart = getBudgetPeriodStart(new Date(), activeBudget.periodType);
      const periodSpentAggregate = await prisma.transaction.aggregate({
        _sum: { amount: true },
        where: {
          childId: child.id,
          type: TransactionType.spend,
          status: TransactionStatus.approved,
          createdAt: { gte: periodStart },
        },
      });
      const periodSpent = Number(periodSpentAggregate._sum.amount ?? 0);
      const remaining = activeLimit - periodSpent;

      if (amount > remaining) {
        return res.status(400).json({
          error: `This withdrawal exceeds the ${activeBudget.periodType} limit. Remaining amount: UGX ${Math.max(0, Math.round(remaining)).toLocaleString()}`,
        });
      }

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

// â”€â”€â”€ Savings Goals â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
        completedAt: goal.completedAt?.toISOString() ?? null,
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
        completedAt: goal.completedAt?.toISOString() ?? null,
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

    const wallet = child.wallet;
    const nextGoalAmount = Number(goal.currentAmount) + amount;
    const goalWillComplete = nextGoalAmount >= Number(goal.targetAmount);
    const { updatedWallet, updatedGoal } = await prisma.$transaction(async (tx) => {
      const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: wallet.balance - amount,
        },
      });

      const updatedGoal = await tx.savingsGoal.update({
        where: { id: goal.id },
        data: {
          currentAmount: nextGoalAmount,
          status: goalWillComplete ? GoalStatus.completed : GoalStatus.active,
          completedAt: goalWillComplete ? goal.completedAt ?? new Date() : null,
        },
      });

      if (goalWillComplete) {
        await awardGoalCompletionStar(tx, {
          childId: child.id,
          goalId: goal.id,
          goalTitle: goal.title,
        });
      }

      return { updatedWallet, updatedGoal };
    });

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
        completedAt: updatedGoal.completedAt?.toISOString() ?? null,
      },
    });
  } catch (error) {
    console.error("Fund savings goal error:", error);
    res.status(500).json({ error: "Failed to fund savings goal" });
  }
});

// â”€â”€â”€ Chores â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

router.post("/withdrawals", authMiddleware, requireRole("child"), async (req: AuthenticatedRequest, res) => {
  try {
    const parsed = withdrawalSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid withdrawal payload" });
    }

    const child = await prisma.childProfile.findUnique({
      where: { childUserId: req.user!.userId },
      include: { wallet: true },
    });

    if (!child?.wallet) {
      return res.status(404).json({ error: "Wallet not found" });
    }

    const amount = parsed.data.amount;

    if (parsed.data.source === "wallet") {
      if (child.wallet.balance < amount) {
        return res.status(400).json({ error: "You do not have enough money in your wallet." });
      }

      const transaction = await prisma.transaction.create({
        data: {
          walletId: child.wallet.id,
          childId: child.id,
          amount,
          type: TransactionType.spend,
          status: TransactionStatus.pending,
          description: parsed.data.description || "Wallet withdrawal request",
          withdrawalSource: "wallet",
        },
      });

      return res.status(201).json({
        message: "Wallet withdrawal submitted for parent approval",
        transactionId: transaction.id,
        status: transaction.status,
        wallet: {
          balance: Number(child.wallet.balance),
          totalEarned: Number(child.wallet.totalEarned),
          totalSpent: Number(child.wallet.totalSpent),
        },
        goal: null,
      });
    }

    if (!parsed.data.goalId) {
      return res.status(400).json({ error: "Select a completed goal to withdraw from." });
    }

    const goal = await prisma.savingsGoal.findFirst({
      where: { id: parsed.data.goalId, childId: child.id },
    });

    if (!goal) {
      return res.status(404).json({ error: "Savings goal not found" });
    }

    if (goal.status !== GoalStatus.completed && Number(goal.currentAmount) < Number(goal.targetAmount)) {
      return res.status(400).json({ error: "You can only withdraw from a completed goal." });
    }

    if (amount > Number(goal.currentAmount)) {
      return res.status(400).json({ error: "This goal does not have enough saved money." });
    }

    const transaction = await prisma.transaction.create({
      data: {
        walletId: child.wallet.id,
        childId: child.id,
        amount,
        type: TransactionType.spend,
        status: TransactionStatus.pending,
        description: parsed.data.description || `Completed goal withdrawal: ${goal.title}`,
        withdrawalSource: "goal",
        savingsGoalId: goal.id,
      },
    });

    res.status(201).json({
      message: `${goal.title} withdrawal submitted for parent approval`,
      transactionId: transaction.id,
      status: transaction.status,
      wallet: {
        balance: Number(child.wallet.balance),
        totalEarned: Number(child.wallet.totalEarned),
        totalSpent: Number(child.wallet.totalSpent),
      },
      goal: {
        id: goal.id,
        title: goal.title,
        targetAmount: Number(goal.targetAmount),
        currentAmount: Number(goal.currentAmount),
        status: goal.status,
        targetDate: goal.targetDate,
        completedAt: goal.completedAt?.toISOString() ?? null,
      },
    });
  } catch (error) {
    console.error("Create withdrawal error:", error);
    res.status(500).json({ error: "Failed to create withdrawal" });
  }
});

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
        rewardAmount: Number(chore.rewardAmount),
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
      include: { wallet: true },
    });

    if (!child?.wallet) {
      return res.status(404).json({ error: "Child profile or wallet not found" });
    }

    const chore = await prisma.choreAssignment.findFirst({
      where: { id: req.params.id, childId: child.id },
      select: { id: true, title: true, status: true, rewardAmount: true, parentId: true },
    });

    if (!chore) {
      return res.status(404).json({ error: "Chore not found" });
    }

    if (chore.status === ChoreStatus.completed) {
      return res.status(409).json({ error: "Chore already completed" });
    }

    const parent = await prisma.user.findUnique({
      where: { id: chore.parentId },
      select: { id: true, accountBalance: true },
    });

    if (!parent) {
      return res.status(404).json({ error: "Parent account not found" });
    }

    const rewardAmount = Number(chore.rewardAmount);
    if (parent.accountBalance < rewardAmount) {
      return res.status(400).json({ error: "Parent account has insufficient balance for this chore reward" });
    }

    await prisma.$transaction(async (tx) => {
      await tx.choreAssignment.update({
        where: { id: chore.id },
        data: { status: ChoreStatus.completed, completedAt: new Date() },
      });

      await tx.user.update({
        where: { id: parent.id },
        data: {
          accountBalance: parent.accountBalance - rewardAmount,
        },
      });

      await tx.wallet.update({
        where: { id: child.wallet!.id },
        data: {
          balance: child.wallet!.balance + rewardAmount,
          totalEarned: child.wallet!.totalEarned + rewardAmount,
        },
      });

      await tx.transaction.create({
        data: {
          walletId: child.wallet!.id,
          childId: child.id,
          amount: rewardAmount,
          type: TransactionType.earn,
          status: TransactionStatus.approved,
          description: `Chore reward: ${chore.title}`,
          approvedById: parent.id,
          reviewedAt: new Date(),
        },
      });
    });

    res.json({ message: "Chore completed and reward added to your wallet" });
  } catch (error) {
    console.error("Complete chore error:", error);
    res.status(500).json({ error: "Failed to complete chore" });
  }
});

// â”€â”€â”€ Allowances â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

router.get("/allowances", authMiddleware, requireRole("child"), async (req: AuthenticatedRequest, res) => {
  try {
    await processDueAllowancesForChild(req.user!.userId);

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

router.get("/learning/lessons", authMiddleware, requireRole("child"), async (req: AuthenticatedRequest, res) => {
  try {
    const child = await prisma.childProfile.findUnique({
      where: { childUserId: req.user!.userId },
      select: { id: true },
    });
    if (!child) {
      return res.status(404).json({ error: "Child profile not found" });
    }

    const assignments = await prisma.childLessonAssignment.findMany({
      where: { childId: child.id },
      include: { lesson: true },
      orderBy: { assignedAt: "desc" },
    });

    res.json({
      lessons: assignments.map((assignment) => ({
        assignmentId: assignment.id,
        lessonId: assignment.lesson.id,
        title: assignment.lesson.title,
        content: assignment.lesson.content,
        resourceType: assignment.lesson.resourceType,
        resourceUrl: assignment.lesson.resourceUrl,
        fileName: assignment.lesson.fileName,
        status: assignment.status,
        progressPercent: assignment.progressPercent,
        studyDays: assignment.studyDays,
        studyStartAt: assignment.studyStartAt?.toISOString() ?? null,
        studyEndAt: assignment.studyEndAt?.toISOString() ?? null,
        firstViewedAt: assignment.firstViewedAt?.toISOString() ?? null,
        lastViewedAt: assignment.lastViewedAt?.toISOString() ?? null,
        completedAt: assignment.completedAt?.toISOString() ?? null,
        assignedAt: assignment.assignedAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("Get child learning lessons error:", error);
    res.status(500).json({ error: "Failed to fetch assigned learning lessons" });
  }
});

router.patch("/learning/lessons/:assignmentId/progress", authMiddleware, requireRole("child"), async (req: AuthenticatedRequest, res) => {
  try {
    const parsed = learningProgressSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid learning progress payload" });
    }

    const child = await prisma.childProfile.findUnique({
      where: { childUserId: req.user!.userId },
      select: { id: true },
    });
    if (!child) {
      return res.status(404).json({ error: "Child profile not found" });
    }

    const assignment = await prisma.childLessonAssignment.findFirst({
      where: {
        id: req.params.assignmentId,
        childId: child.id,
      },
    });
    if (!assignment) {
      return res.status(404).json({ error: "Learning assignment not found" });
    }

    const progressPercent = Math.round(parsed.data.progressPercent);
    const now = new Date();
    const completed = progressPercent >= 100;
    const updated = await prisma.$transaction(async (tx) => {
      const updatedAssignment = await tx.childLessonAssignment.update({
        where: { id: assignment.id },
        data: {
          progressPercent,
          status: completed ? "completed" : "in_progress",
          firstViewedAt: assignment.firstViewedAt ?? now,
          lastViewedAt: now,
          completedAt: completed ? assignment.completedAt ?? now : null,
        },
      });

      if (completed) {
        await awardChildAchievement(tx, {
          childId: child.id,
          title: "Learning Star",
          description: `Learning star for completed lesson assignment ${assignment.id}`,
          points: 1,
        });
      }

      return updatedAssignment;
    });

    res.json({
      message: completed ? "Lesson marked as completed" : "Lesson progress updated",
      assignment: {
        assignmentId: updated.id,
        status: updated.status,
        progressPercent: updated.progressPercent,
        firstViewedAt: updated.firstViewedAt?.toISOString() ?? null,
        lastViewedAt: updated.lastViewedAt?.toISOString() ?? null,
        completedAt: updated.completedAt?.toISOString() ?? null,
      },
    });
  } catch (error) {
    console.error("Update child learning progress error:", error);
    res.status(500).json({ error: "Failed to update learning progress" });
  }
});

export default router;



