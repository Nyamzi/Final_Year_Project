import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { Router } from "express";
import { prisma } from "../db";
import { authMiddleware, AuthenticatedRequest, requireRole } from "../middleware/auth";
import { z } from "zod";
import { BudgetPeriod, GoalStatus, Prisma, Role, TransactionStatus, TransactionType } from "@prisma/client";
import { getSupabaseAdmin } from "../lib/supabase";
import PDFDocument from "pdfkit";

const router = Router();

const createChildSchema = z.object({
  fullName: z.string().min(3).max(120),
  email: z.string().email(),
  password: z.string().min(8).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/),
  nickname: z.string().min(2),
  age: z.number().int().min(5).max(17),
  profileImageUrl: z.string().min(1),
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
  periodType: z.enum(["daily", "weekly", "monthly"]),
});

const profileSchema = z.object({
  fullName: z.string().min(3).max(120),
  nin: z.string().regex(/^[A-Za-z0-9]{8,20}$/),
  phoneNumber: z.string().regex(/^\+?[0-9]{10,15}$/),
  email: z.string().email(),
  sex: z.enum(["male", "female"]).nullable().optional(),
  profileImageUrl: z.string().nullable().optional(),
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

const childPasswordUpdateSchema = z.object({
  newPassword: z.string().min(8),
  confirmPassword: z.string().min(8),
});

const assignLearningLessonSchema = z.object({
  childId: z.string().min(1),
  lessonId: z.string().min(1),
  studyStartAt: z.string().min(1),
  studyEndAt: z.string().min(1),
});

function parseOptionalDate(value?: string): Date | null | undefined {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed;
}

/** Supabase Auth rejects bodies > 1MB; base64 avatars must be stored locally first. */
function resolvePublicApiBaseUrl(req: AuthenticatedRequest): string {
  const envBase = process.env.PUBLIC_API_BASE_URL?.trim().replace(/\/$/, "");
  if (envBase) return envBase;
  const host = req.get("x-forwarded-host") ?? req.get("host") ?? "localhost:3000";
  const proto = req.get("x-forwarded-proto") ?? req.protocol ?? "http";
  return `${proto}://${host}`;
}

function persistDataUriProfileImage(req: AuthenticatedRequest, dataUri: string): string {
  const base64Marker = ";base64,";
  const markerIndex = dataUri.indexOf(base64Marker);
  if (markerIndex === -1 || !dataUri.startsWith("data:")) {
    throw new Error("invalid_image");
  }

  const mimePart = dataUri.slice(5, markerIndex);
  const base64Data = dataUri.slice(markerIndex + base64Marker.length);
  const buffer = Buffer.from(base64Data, "base64");
  if (buffer.length > 8 * 1024 * 1024) {
    throw new Error("image_too_large");
  }

  const ext = mimePart.includes("png")
    ? "png"
    : mimePart.includes("webp")
      ? "webp"
      : mimePart.includes("gif")
        ? "gif"
        : "jpeg";

  const uploadDir = path.join(process.cwd(), "uploads", "profiles");
  fs.mkdirSync(uploadDir, { recursive: true });
  const fileName = `${randomUUID()}.${ext}`;
  const targetPath = path.join(uploadDir, fileName);
  fs.writeFileSync(targetPath, buffer);

  const relative = `/uploads/profiles/${fileName}`;
  return `${resolvePublicApiBaseUrl(req)}${relative}`;
}

type ParentReportRange = "this_month" | "last_30_days" | "all_time";
type ParentReportExportType =
  | "parent-summary"
  | "children-overview"
  | "transactions"
  | "pending"
  | "goals"
  | "chores"
  | "allowances"
  | "learning"
  | "support"
  | "full-export";
type StatementIncludeField = "date" | "child" | "type" | "status" | "description" | "amount";

function getFromDateForRange(range: ParentReportRange): Date | null {
  const now = new Date();
  if (range === "all_time") return null;
  if (range === "last_30_days") return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function getBudgetPeriodStart(date: Date, periodType: BudgetPeriod): Date {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);

  if (periodType === "daily") {
    return start;
  }

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

function escapeCsvValue(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return "";
  const text = String(value).replace(/"/g, "\"\"");
  return /[",\n]/.test(text) ? `"${text}"` : text;
}

function toCsv(rows: Array<Record<string, string | number | boolean | null | undefined>>): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const headerRow = headers.map((header) => escapeCsvValue(header)).join(",");
  const dataRows = rows.map((row) => headers.map((header) => escapeCsvValue(row[header])).join(","));
  return [headerRow, ...dataRows].join("\n");
}

type UnifiedParentTxRow = {
  id: string;
  childId: string | null;
  childName: string;
  accountScope: "parent" | "child";
  amount: number;
  type: TransactionType;
  status: TransactionStatus;
  description: string | null;
  createdAt: Date;
};

/** Parent wallet deposits plus all child-wallet transactions (sorted newest first). */
async function fetchUnifiedParentTransactions(parentUserId: string): Promise<UnifiedParentTxRow[]> {
  const [transactions, deposits] = await Promise.all([
    prisma.transaction.findMany({
      where: { child: { parentId: parentUserId } },
      include: { child: true },
    }),
    prisma.parentDeposit.findMany({
      where: { parentId: parentUserId },
    }),
  ]);

  const childRows: UnifiedParentTxRow[] = transactions.map((item) => ({
    id: item.id,
    childId: item.childId,
    childName: item.child.nickname,
    accountScope: "child",
    amount: Number(item.amount),
    type: item.type,
    status: item.status,
    description: item.description,
    createdAt: item.createdAt,
  }));

  const parentRows: UnifiedParentTxRow[] = deposits.map((d) => ({
    id: `parent-deposit-${d.id}`,
    childId: null,
    childName: "Parent wallet",
    accountScope: "parent",
    amount: Number(d.amount),
    type: TransactionType.earn,
    status: TransactionStatus.approved,
    description: "Wallet deposit",
    createdAt: d.createdAt,
  }));

  return [...childRows, ...parentRows].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
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

// â”€â”€â”€ Children â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
        profileImageUrl: child.childUser.profileImageUrl,
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

    let profileImageUrl = parsed.data.profileImageUrl;
    if (profileImageUrl.startsWith("data:")) {
      try {
        profileImageUrl = persistDataUriProfileImage(req, profileImageUrl);
      } catch (err) {
        const code = err instanceof Error ? err.message : "";
        if (code === "image_too_large") {
          return res.status(400).json({ error: "Profile image is too large. Choose a smaller photo." });
        }
        return res.status(400).json({ error: "Invalid profile image" });
      }
    }

    const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (existing) {
      return res.status(409).json({ error: "Email already exists" });
    }

    const admin = getSupabaseAdmin();
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email: parsed.data.email,
      password: parsed.data.password,
      email_confirm: true,
      user_metadata: {
        fullName: parsed.data.fullName,
        role: Role.child,
        parentId: req.user!.userId,
        profileImageUrl,
      },
    });
    if (authError || !authData.user) {
      return res.status(400).json({ error: authError?.message ?? "Unable to create child auth user" });
    }

    let result: { id: string };
    try {
      result = await prisma.$transaction(async (tx) => {
        const childUser = await tx.user.create({
          data: {
            id: authData.user.id,
            fullName: parsed.data.fullName,
            email: parsed.data.email,
            profileImageUrl,
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
    } catch (error) {
      await admin.auth.admin.deleteUser(authData.user.id);
      throw error;
    }

    res.status(201).json({ message: "Child account created", childId: result.id });
  } catch (error) {
    console.error("Create child error:", error);
    res.status(500).json({ error: "Failed to create child" });
  }
});

router.patch("/children/:childId/deactivate", authMiddleware, requireRole("parent"), async (req: AuthenticatedRequest, res) => {
  try {
    const child = await prisma.childProfile.findFirst({
      where: { id: req.params.childId, parentId: req.user!.userId },
      include: { childUser: true },
    });
    if (!child) {
      return res.status(404).json({ error: "Child not found" });
    }

    await prisma.user.update({
      where: { id: child.childUserId },
      data: { isActive: false, deactivatedAt: new Date() },
    });
    await getSupabaseAdmin().auth.admin.updateUserById(child.childUserId, { ban_duration: "876000h" });

    res.json({ message: `${child.nickname} has been deactivated` });
  } catch (error) {
    console.error("Deactivate child error:", error);
    res.status(500).json({ error: "Failed to deactivate child account" });
  }
});

router.delete("/children/:childId", authMiddleware, requireRole("parent"), async (req: AuthenticatedRequest, res) => {
  try {
    const child = await prisma.childProfile.findFirst({
      where: { id: req.params.childId, parentId: req.user!.userId },
      include: { childUser: true },
    });
    if (!child) {
      return res.status(404).json({ error: "Child not found" });
    }

    await prisma.user.delete({ where: { id: child.childUserId } });
    await getSupabaseAdmin().auth.admin.deleteUser(child.childUserId);

    res.json({ message: `${child.nickname} has been deleted` });
  } catch (error) {
    console.error("Delete child error:", error);
    res.status(500).json({ error: "Failed to delete child account" });
  }
});
// â”€â”€â”€ Pending Transactions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

    if (decision === TransactionStatus.approved && transaction.type === TransactionType.spend) {
      const activeBudgets = await prisma.budget.findMany({
        where: { childId: transaction.childId, isActive: true },
        orderBy: [{ periodType: "asc" }, { createdAt: "desc" }],
      });

      for (const activeBudget of activeBudgets) {
        const activeLimit = Number(activeBudget.monthlyLimit);
        const periodStart = getBudgetPeriodStart(new Date(), activeBudget.periodType);
        const periodSpentAggregate = await prisma.transaction.aggregate({
          _sum: { amount: true },
          where: {
            childId: transaction.childId,
            type: TransactionType.spend,
            status: TransactionStatus.approved,
            createdAt: { gte: periodStart },
          },
        });
        const spentThisPeriod = Number(periodSpentAggregate._sum.amount ?? 0);
        const remaining = Math.max(0, activeLimit - spentThisPeriod);

        if (Number(transaction.amount) > remaining) {
          await prisma.transaction.update({
            where: { id: transaction.id },
            data: {
              status: TransactionStatus.rejected,
              approvedById: req.user!.userId,
              reviewedAt: new Date(),
              description: `${transaction.description ?? "Withdrawal request"} (spending limit reached)`,
            },
          });

          return res.json({
            message: `Spending limit reached. Withdrawal request rejected. Remaining ${activeBudget.periodType} amount: UGX ${Math.round(remaining).toLocaleString()}`,
          });
        }
      }
    }

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
        } else if (transaction.withdrawalSource === "goal" && transaction.savingsGoalId) {
          const goal = await tx.savingsGoal.findFirst({
            where: {
              id: transaction.savingsGoalId,
              childId: transaction.childId,
            },
          });

          if (!goal) {
            throw new Error("Savings goal not found for this withdrawal");
          }

          if (Number(goal.currentAmount) < Number(amount)) {
            throw new Error("Savings goal does not have enough saved money");
          }

          const remainingGoalAmount = Math.max(0, Number(goal.currentAmount) - Number(amount));

          await tx.savingsGoal.update({
            where: { id: goal.id },
            data: {
              currentAmount: remainingGoalAmount,
              status: GoalStatus.completed,
              completedAt: goal.completedAt ?? new Date(),
            },
          });

          await tx.wallet.update({
            where: { id: transaction.walletId },
            data: {
              totalSpent: transaction.wallet.totalSpent + amount,
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

// â”€â”€â”€ Spending Limits â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
        where: { childId: child.id, isActive: true, periodType: parsed.data.periodType as BudgetPeriod },
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

// â”€â”€â”€ Chores â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€ Allowances â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€ All Transactions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

router.get("/transactions", authMiddleware, requireRole("parent"), async (req: AuthenticatedRequest, res) => {
  try {
    await processDueAllowancesForParent(req.user!.userId);

    const childId = typeof req.query.childId === "string" ? req.query.childId : undefined;

    if (childId === "parent_wallet") {
      const deposits = await prisma.parentDeposit.findMany({
        where: { parentId: req.user!.userId },
        orderBy: { createdAt: "desc" },
      });
      return res.json({
        transactions: deposits.map((d) => ({
          id: `parent-deposit-${d.id}`,
          childId: null,
          childName: "Parent wallet",
          accountScope: "parent" as const,
          amount: Number(d.amount),
          type: "earn",
          status: "approved",
          description: "Wallet deposit",
          createdAt: d.createdAt.toISOString(),
        })),
      });
    }

    if (childId) {
      const transactions = await prisma.transaction.findMany({
        where: {
          child: { parentId: req.user!.userId },
          childId,
        },
        include: { child: true },
        orderBy: { createdAt: "desc" },
      });

      return res.json({
        transactions: transactions.map((item) => ({
          id: item.id,
          childId: item.childId,
          childName: item.child.nickname,
          accountScope: "child" as const,
          amount: Number(item.amount),
          type: item.type,
          status: item.status,
          description: item.description,
          createdAt: item.createdAt.toISOString(),
        })),
      });
    }

    const unified = await fetchUnifiedParentTransactions(req.user!.userId);

    res.json({
      transactions: unified.map((row) => ({
        id: row.id,
        childId: row.childId,
        childName: row.childName,
        accountScope: row.accountScope,
        amount: row.amount,
        type: row.type,
        status: row.status,
        description: row.description,
        createdAt: row.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("Get all transactions error:", error);
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
});

// â”€â”€â”€ Fund Child Wallet â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€ Parent Account Balance & Deposits â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

    const updated = await prisma.$transaction(async (tx) => {
      const parent = await tx.user.update({
        where: { id: req.user!.userId },
        data: {
          accountBalance: { increment: parsed.data.amount },
          totalDeposited: { increment: parsed.data.amount },
        },
        select: { accountBalance: true, totalDeposited: true },
      });

      await tx.parentDeposit.create({
        data: {
          parentId: req.user!.userId,
          amount: parsed.data.amount,
        },
      });

      return parent;
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

// â”€â”€â”€ Savings Goals â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
        completedAt: g.completedAt?.toISOString() ?? null,
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
        completedAt: goal.completedAt?.toISOString() ?? null,
      },
    });
  } catch (error) {
    console.error("Create savings goal error:", error);
    res.status(500).json({ error: "Failed to create savings goal" });
  }
});

// â”€â”€â”€ Account â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

router.get("/learning/assignments", authMiddleware, requireRole("parent"), async (req: AuthenticatedRequest, res) => {
  try {
    const assignments = await prisma.childLessonAssignment.findMany({
      where: { parentId: req.user!.userId },
      include: { child: true, lesson: true },
      orderBy: { assignedAt: "desc" },
    });

    res.json({
      assignments: assignments.map((assignment) => ({
        assignmentId: assignment.id,
        childId: assignment.childId,
        childName: assignment.child.nickname,
        lessonId: assignment.lessonId,
        lessonTitle: assignment.lesson.title,
        resourceType: assignment.lesson.resourceType,
        status: assignment.status,
        progressPercent: assignment.progressPercent,
        firstViewedAt: assignment.firstViewedAt?.toISOString() ?? null,
        lastViewedAt: assignment.lastViewedAt?.toISOString() ?? null,
        completedAt: assignment.completedAt?.toISOString() ?? null,
        assignedAt: assignment.assignedAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("Get learning assignments error:", error);
    res.status(500).json({ error: "Failed to fetch learning assignments" });
  }
});

router.post("/learning/assignments", authMiddleware, requireRole("parent"), async (req: AuthenticatedRequest, res) => {
  try {
    const parsed = assignLearningLessonSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid learning assignment payload" });
    }

    const studyStartAt = new Date(parsed.data.studyStartAt);
    const studyEndAt = new Date(parsed.data.studyEndAt);
    if (Number.isNaN(studyStartAt.getTime()) || Number.isNaN(studyEndAt.getTime())) {
      return res.status(400).json({ error: "Invalid study date range" });
    }
    if (studyEndAt < studyStartAt) {
      return res.status(400).json({ error: "Study end date must be after start date" });
    }
    const studyDays = Math.max(1, Math.ceil((studyEndAt.getTime() - studyStartAt.getTime()) / (1000 * 60 * 60 * 24)));

    const child = await prisma.childProfile.findFirst({
      where: {
        id: parsed.data.childId,
        parentId: req.user!.userId,
      },
      select: { id: true, nickname: true },
    });
    if (!child) {
      return res.status(404).json({ error: "Child not found" });
    }

    const lesson = await prisma.lesson.findFirst({
      where: {
        id: parsed.data.lessonId,
        isPublished: true,
      },
      select: { id: true, title: true },
    });
    if (!lesson) {
      return res.status(404).json({ error: "Published lesson not found" });
    }

    const assignment = await prisma.childLessonAssignment.upsert({
      where: {
        childId_lessonId: {
          childId: child.id,
          lessonId: lesson.id,
        },
      },
      update: {
        parentId: req.user!.userId,
        status: "assigned",
        progressPercent: 0,
        studyDays,
        studyStartAt,
        studyEndAt,
        firstViewedAt: null,
        lastViewedAt: null,
        completedAt: null,
      },
      create: {
        parentId: req.user!.userId,
        childId: child.id,
        lessonId: lesson.id,
        status: "assigned",
        studyDays,
        studyStartAt,
        studyEndAt,
      },
    });

    res.status(201).json({
      message: `${lesson.title} assigned to ${child.nickname} from ${studyStartAt.toLocaleDateString()} to ${studyEndAt.toLocaleDateString()}`,
      assignmentId: assignment.id,
    });
  } catch (error) {
    console.error("Assign learning lesson error:", error);
    res.status(500).json({ error: "Failed to assign learning lesson" });
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
        sex: parsed.data.sex ?? undefined,
        profileImageUrl: parsed.data.profileImageUrl ?? undefined,
      },
      select: { fullName: true, nin: true, phoneNumber: true, email: true, sex: true, profileImageUrl: true },
    });

    res.json({ message: "Account details updated", profile: updatedUser });
  } catch (error) {
    console.error("Update account error:", error);
    res.status(500).json({ error: "Failed to update profile" });
  }
});


router.patch("/account/deactivate", authMiddleware, requireRole("parent"), async (req: AuthenticatedRequest, res) => {
  try {
    await prisma.user.update({
      where: { id: req.user!.userId },
      data: { isActive: false, deactivatedAt: new Date() },
    });
    await getSupabaseAdmin().auth.admin.updateUserById(req.user!.userId, { ban_duration: "876000h" });
    res.json({ message: "Parent account deactivated" });
  } catch (error) {
    console.error("Deactivate parent account error:", error);
    res.status(500).json({ error: "Failed to deactivate parent account" });
  }
});

router.delete("/account", authMiddleware, requireRole("parent"), async (req: AuthenticatedRequest, res) => {
  try {
    const parent = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      include: { parentChildren: { select: { childUserId: true } } },
    });
    if (!parent) {
      return res.status(404).json({ error: "Parent account not found" });
    }
    const authIds = [parent.id, ...parent.parentChildren.map((child) => child.childUserId)];
    await prisma.user.delete({ where: { id: parent.id } });
    await Promise.all(authIds.map((id) => getSupabaseAdmin().auth.admin.deleteUser(id).catch(() => null)));

    res.json({ message: "Parent account deleted" });
  } catch (error) {
    console.error("Delete parent account error:", error);
    res.status(500).json({ error: "Failed to delete parent account" });
  }
});

router.patch("/children/:childId/password", authMiddleware, requireRole("parent"), async (req: AuthenticatedRequest, res) => {
  try {
    const parsed = childPasswordUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid password payload" });
    }

    if (parsed.data.newPassword !== parsed.data.confirmPassword) {
      return res.status(400).json({ error: "Password confirmation does not match" });
    }

    const child = await prisma.childProfile.findFirst({
      where: {
        id: req.params.childId,
        parentId: req.user!.userId,
      },
      include: {
        childUser: true,
      },
    });

    if (!child) {
      return res.status(404).json({ error: "Child not found" });
    }
    const admin = getSupabaseAdmin();
    const { error: updateError } = await admin.auth.admin.updateUserById(child.childUser.id, {
      password: parsed.data.newPassword,
    });

    if (updateError) {
      const isMissingAuthUser = /not\s*found|does not exist|404/i.test(updateError.message);
      if (!isMissingAuthUser) {
        return res.status(400).json({ error: updateError.message });
      }

      const { data: authData, error: createError } = await admin.auth.admin.createUser({
        email: child.childUser.email,
        password: parsed.data.newPassword,
        email_confirm: true,
        user_metadata: {
          fullName: child.childUser.fullName,
          role: Role.child,
          parentId: req.user!.userId,
          profileImageUrl: child.childUser.profileImageUrl,
        },
      });

      if (createError || !authData.user) {
        return res.status(400).json({ error: createError?.message ?? "Could not recreate child auth account" });
      }

      await prisma.user.update({
        where: { id: child.childUser.id },
        data: { id: authData.user.id },
      });
    }

    res.json({ message: `Password updated for ${child.nickname}` });
  } catch (error) {
    console.error("Update child password error:", error);
    res.status(500).json({ error: "Failed to update child password" });
  }
});

// â”€â”€â”€ Parent Preferences â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€ Parent Notifications â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

router.get("/notifications", authMiddleware, requireRole("parent"), async (req: AuthenticatedRequest, res) => {
  try {
    await processDueAllowancesForParent(req.user!.userId);

    const [pendingTx, recentTx, recentAllowances, recentChores, recentDeposits] = await Promise.all([
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
      prisma.parentDeposit.findMany({
        where: { parentId: req.user!.userId },
        orderBy: { createdAt: "desc" },
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
              : (tx.description ?? "").toLowerCase().includes("spending limit reached")
                ? `${tx.child.nickname} hit their spending limit. Withdrawal of UGX ${Number(tx.amount).toLocaleString()} was blocked.`
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
      ...recentDeposits.map((d) => ({
        id: `deposit-${d.id}`,
        type: "deposit",
        message: `You deposited UGX ${Number(d.amount).toLocaleString()} into your account`,
        createdAt: d.createdAt,
      })),
    ]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 30)
      .map((item) => ({ ...item, createdAt: item.createdAt.toISOString() }));

    const readRows = await prisma.notificationRead.findMany({
      where: {
        userId: req.user!.userId,
        notificationId: { in: notificationItems.map((item) => item.id) },
      },
      select: { notificationId: true },
    });
    const readSet = new Set(readRows.map((row) => row.notificationId));

    const notifications = notificationItems.map((item) => ({
      ...item,
      isRead: readSet.has(item.id),
    }));

    const unreadCount = notifications.filter((item) => !item.isRead).length;

    res.json({ notifications, unreadCount });
  } catch (error) {
    console.error("Get parent notifications error:", error);
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

router.patch("/notifications/mark-read", authMiddleware, requireRole("parent"), async (req: AuthenticatedRequest, res) => {
  try {
    const parsed = z.object({ notificationIds: z.array(z.string().min(1)).min(1) }).safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid notification payload" });
    }

    await prisma.$transaction(
      parsed.data.notificationIds.map((notificationId) =>
        prisma.notificationRead.upsert({
          where: {
            userId_notificationId: {
              userId: req.user!.userId,
              notificationId,
            },
          },
          create: {
            userId: req.user!.userId,
            notificationId,
          },
          update: {
            readAt: new Date(),
          },
        })
      )
    );

    res.json({ message: "Notifications marked as read" });
  } catch (error) {
    console.error("Mark notifications read error:", error);
    res.status(500).json({ error: "Failed to mark notifications as read" });
  }
});

router.patch("/notifications/mark-all-read", authMiddleware, requireRole("parent"), async (req: AuthenticatedRequest, res) => {
  try {
    await processDueAllowancesForParent(req.user!.userId);

    const [pendingTx, recentTx, recentAllowances, recentChores, recentDeposits] = await Promise.all([
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
      prisma.parentDeposit.findMany({
        where: { parentId: req.user!.userId },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    ]);

    const notificationIds = [
      ...pendingTx.map((tx) => `pending-${tx.id}`),
      ...recentTx.filter((tx) => tx.status !== TransactionStatus.pending).map((tx) => `tx-${tx.id}`),
      ...recentAllowances.map((a) => `allowance-${a.id}`),
      ...recentChores.map((c) => `chore-${c.id}`),
      ...recentDeposits.map((d) => `deposit-${d.id}`),
    ];

    if (notificationIds.length > 0) {
      await prisma.$transaction(
        notificationIds.map((notificationId) =>
          prisma.notificationRead.upsert({
            where: {
              userId_notificationId: {
                userId: req.user!.userId,
                notificationId,
              },
            },
            create: {
              userId: req.user!.userId,
              notificationId,
            },
            update: {
              readAt: new Date(),
            },
          })
        )
      );
    }

    res.json({ message: "All notifications marked as read" });
  } catch (error) {
    console.error("Mark all notifications read error:", error);
    res.status(500).json({ error: "Failed to mark all notifications as read" });
  }
});

// â”€â”€â”€ Parent Reports â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

router.get("/reports/summary", authMiddleware, requireRole("parent"), async (req: AuthenticatedRequest, res) => {
  try {
    const range = typeof req.query.range === "string" ? req.query.range : "this_month";
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const fromDate = range === "all_time" ? null : range === "last_30_days" ? last30Days : startOfMonth;

    const [parent, transactions, goals, chores, wallets, deposits, activeAllowances] = await Promise.all([
      prisma.user.findUnique({
        where: { id: req.user!.userId },
        select: {
          accountBalance: true,
          totalDeposited: true,
          parentChildren: { select: { id: true } },
        },
      }),
      prisma.transaction.findMany({
        where: {
          child: { parentId: req.user!.userId },
          ...(fromDate ? { createdAt: { gte: fromDate } } : {}),
        },
      }),
      prisma.savingsGoal.findMany({
        where: {
          child: { parentId: req.user!.userId },
          status: "completed",
          ...(fromDate ? { updatedAt: { gte: fromDate } } : {}),
        },
      }),
      prisma.choreAssignment.findMany({
        where: {
          parentId: req.user!.userId,
          status: "completed",
          ...(fromDate ? { completedAt: { gte: fromDate } } : {}),
        },
      }),
      prisma.wallet.findMany({
        where: { child: { parentId: req.user!.userId } },
        select: {
          balance: true,
          totalEarned: true,
          totalSpent: true,
        },
      }),
      prisma.parentDeposit.findMany({
        where: {
          parentId: req.user!.userId,
          ...(fromDate ? { createdAt: { gte: fromDate } } : {}),
        },
        select: { amount: true },
      }),
      prisma.allowanceSchedule.findMany({
        where: {
          parentId: req.user!.userId,
          isActive: true,
        },
        select: { amount: true },
      }),
    ]);

    if (!parent) {
      return res.status(404).json({ error: "Parent account not found" });
    }

    const approvedTransactions = transactions.filter((tx) => tx.status === TransactionStatus.approved);
    const pendingCount = transactions.filter((tx) => tx.status === TransactionStatus.pending).length;
    const childrenTotalSpent = approvedTransactions
      .filter((tx) => tx.type === TransactionType.spend)
      .reduce((sum, tx) => sum + Number(tx.amount), 0);
    const childrenTotalEarned = approvedTransactions
      .filter((tx) => tx.type === TransactionType.earn)
      .reduce((sum, tx) => sum + Number(tx.amount), 0);
    const goalsCompleted = goals.length;
    const choresCompleted = chores.length;

    const totalWalletBalance = wallets.reduce((sum, wallet) => sum + Number(wallet.balance), 0);
    const walletLifetimeEarned = wallets.reduce((sum, wallet) => sum + Number(wallet.totalEarned), 0);
    const walletLifetimeSpent = wallets.reduce((sum, wallet) => sum + Number(wallet.totalSpent), 0);

    const totalDeposits = deposits.reduce((sum, item) => sum + Number(item.amount), 0);
    const reservedForActiveAllowances = activeAllowances.reduce((sum, item) => sum + Number(item.amount), 0);

    res.json({
      summary: {
        parent: {
          currentBalance: Number(parent.accountBalance),
          totalDeposited: Number(parent.totalDeposited),
          depositTransactions: deposits.length,
          totalDepositAmount: totalDeposits,
          reservedForActiveAllowances,
          totalSentToChildren: childrenTotalEarned,
        },
        children: {
          childCount: parent.parentChildren.length,
          approvedCount: approvedTransactions.length,
          pendingCount,
          totalEarned: childrenTotalEarned,
          totalSpent: childrenTotalSpent,
          walletBalance: totalWalletBalance,
          lifetimeEarned: walletLifetimeEarned,
          lifetimeSpent: walletLifetimeSpent,
          goalsCompleted,
          choresCompleted,
        },
      },
    });
  } catch (error) {
    console.error("Get parent report summary error:", error);
    res.status(500).json({ error: "Failed to fetch report summary" });
  }
});

router.get("/reports/export", authMiddleware, requireRole("parent"), async (req: AuthenticatedRequest, res) => {
  try {
    const range = (typeof req.query.range === "string" ? req.query.range : "this_month") as ParentReportRange;
    const type = (typeof req.query.type === "string" ? req.query.type : "full-export") as ParentReportExportType;
    const allowedTypes: ParentReportExportType[] = [
      "parent-summary",
      "children-overview",
      "transactions",
      "pending",
      "goals",
      "chores",
      "allowances",
      "learning",
      "support",
      "full-export",
    ];
    const allowedRanges: ParentReportRange[] = ["this_month", "last_30_days", "all_time"];
    if (!allowedTypes.includes(type)) {
      return res.status(400).json({ error: "Invalid report export type" });
    }
    if (!allowedRanges.includes(range)) {
      return res.status(400).json({ error: "Invalid report range" });
    }

    const computed = await computeParentReportRows(req.user!.userId, range, type);
    if (!computed) {
      return res.status(404).json({ error: "Parent account not found" });
    }
    const { rows, filename } = computed;
    const csv = toCsv(rows);
    return res.json({
      filename,
      csv,
      type,
      range,
      rowCount: rows.length,
    });
  } catch (error) {
    console.error("Export parent report error:", error);
    res.status(500).json({ error: "Failed to export parent report" });
  }
});

router.get("/transactions/statement-pdf", authMiddleware, requireRole("parent"), async (req: AuthenticatedRequest, res) => {
  try {
    await processDueAllowancesForParent(req.user!.userId);

    const childId = typeof req.query.childId === "string" ? req.query.childId : "all";
    const txType = typeof req.query.txType === "string" ? req.query.txType : "all";
    const txStatus = typeof req.query.txStatus === "string" ? req.query.txStatus : "all";
    const includeRaw = typeof req.query.include === "string" ? req.query.include : "date,child,type,status,description,amount";
    const includeSet = new Set(includeRaw.split(",").map((item) => item.trim()).filter(Boolean));
    const allowedInclude: StatementIncludeField[] = ["date", "child", "type", "status", "description", "amount"];
    const includeFields = allowedInclude.filter((field) => includeSet.has(field));

    let rows = await fetchUnifiedParentTransactions(req.user!.userId);

    if (childId !== "all") {
      if (childId === "parent_wallet") {
        rows = rows.filter((r) => r.accountScope === "parent");
      } else {
        rows = rows.filter((r) => r.childId === childId);
      }
    }

    if (txType === "earn" || txType === "spend") {
      rows = rows.filter((r) => r.type === txType);
    }
    if (txStatus === "pending" || txStatus === "approved" || txStatus === "rejected") {
      rows = rows.filter((r) => r.status === txStatus);
    }

    const [parent, selectedChild] = await Promise.all([
      prisma.user.findUnique({
        where: { id: req.user!.userId },
        select: { fullName: true, email: true },
      }),
      childId !== "all" && childId !== "parent_wallet"
        ? prisma.childProfile.findFirst({
            where: { id: childId, parentId: req.user!.userId },
            select: { nickname: true },
          })
        : Promise.resolve(null),
    ]);

    if (!parent) {
      return res.status(404).json({ error: "Parent account not found" });
    }

    const doc = new PDFDocument({ margin: 36, size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));

    const generatedAt = new Date();
    const childLabel =
      childId === "all"
        ? "Parent wallet & all children"
        : childId === "parent_wallet"
          ? "Parent wallet only"
          : selectedChild?.nickname ?? "Selected child";
    const typeLabel = txType === "all" ? "All types" : txType;
    const statusLabel = txStatus === "all" ? "All statuses" : txStatus;

    doc.fontSize(18).text("KidsApp Transaction Statement", { align: "left" });
    doc.moveDown(0.3);
    doc.fontSize(10).text(`Generated: ${generatedAt.toLocaleString()}`);
    doc.text(`Parent: ${parent.fullName ?? parent.email}`);
    doc.text(`Filters: Account=${childLabel}, Type=${typeLabel}, Status=${statusLabel}`);
    doc.text(`Records: ${rows.length}`);
    doc.moveDown(0.7);

    if (rows.length === 0) {
      doc.fontSize(12).text("No transactions found for the selected filters.");
    } else {
      rows.forEach((item, index) => {
        if (doc.y > 730) {
          doc.addPage();
        }
        doc.fontSize(11).text(`${index + 1}.`, { continued: true }).text(` ${item.childName}`, { continued: true }).text(` - ${Number(item.amount).toLocaleString()} UGX`);

        if (includeFields.includes("date")) {
          doc.fontSize(9).text(`Date: ${item.createdAt.toLocaleString()}`);
        }
        if (includeFields.includes("child")) {
          doc.fontSize(9).text(`Account: ${item.childName}`);
        }
        if (includeFields.includes("type")) {
          doc.fontSize(9).text(`Type: ${item.type}`);
        }
        if (includeFields.includes("status")) {
          doc.fontSize(9).text(`Status: ${item.status}`);
        }
        if (includeFields.includes("description")) {
          doc.fontSize(9).text(`Description: ${item.description ?? "No description"}`);
        }
        if (includeFields.includes("amount")) {
          doc.fontSize(9).text(`Amount: ${item.type === "earn" ? "+" : "-"} ${Number(item.amount).toLocaleString()} UGX`);
        }

        doc.moveDown(0.4);
      });
    }

    doc.end();

    await new Promise<void>((resolve) => {
      doc.on("end", () => resolve());
    });

    const pdfBuffer = Buffer.concat(chunks);
    const safeDate = generatedAt.toISOString().slice(0, 10);
    const filename = `transaction-statement-${safeDate}.pdf`;
    return res.json({
      filename,
      mimeType: "application/pdf",
      pdfBase64: pdfBuffer.toString("base64"),
      count: rows.length,
    });
  } catch (error) {
    console.error("Generate transaction statement PDF error:", error);
    res.status(500).json({ error: "Failed to generate transaction statement PDF" });
  }
});

async function computeParentReportRows(
  parentUserId: string,
  range: ParentReportRange,
  type: ParentReportExportType,
): Promise<{ rows: Array<Record<string, string | number | boolean | null | undefined>>; filename: string } | null> {
  await processDueAllowancesForParent(parentUserId);
  const fromDate = getFromDateForRange(range);
  const suffix = range === "this_month" ? "this-month" : range === "last_30_days" ? "last-30-days" : "all-time";

  const [parent, children, transactions, goals, chores, allowances, learningAssignments, supportTickets] = await Promise.all([
    prisma.user.findUnique({
      where: { id: parentUserId },
      select: {
        accountBalance: true,
        totalDeposited: true,
        parentDeposits: {
          where: fromDate ? { createdAt: { gte: fromDate } } : undefined,
          select: { amount: true },
        },
      },
    }),
    prisma.childProfile.findMany({
      where: { parentId: parentUserId },
      include: { wallet: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.transaction.findMany({
      where: {
        child: { parentId: parentUserId },
        ...(fromDate ? { createdAt: { gte: fromDate } } : {}),
      },
      include: { child: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.savingsGoal.findMany({
      where: {
        child: { parentId: parentUserId },
        ...(fromDate ? { updatedAt: { gte: fromDate } } : {}),
      },
      include: { child: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.choreAssignment.findMany({
      where: {
        parentId: parentUserId,
        ...(fromDate ? { createdAt: { gte: fromDate } } : {}),
      },
      include: { child: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.allowanceSchedule.findMany({
      where: {
        parentId: parentUserId,
        ...(fromDate ? { createdAt: { gte: fromDate } } : {}),
      },
      include: { child: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.childLessonAssignment.findMany({
      where: {
        parentId: parentUserId,
        ...(fromDate ? { assignedAt: { gte: fromDate } } : {}),
      },
      include: { child: true, lesson: true },
      orderBy: { assignedAt: "desc" },
    }),
    prisma.supportTicket.findMany({
      where: {
        parentId: parentUserId,
        ...(fromDate ? { createdAt: { gte: fromDate } } : {}),
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  if (!parent) {
    return null;
  }

  const goalsByChild = new Map<string, { currentAmount: number; completed: number }>();
  for (const goal of goals) {
    const existing = goalsByChild.get(goal.childId) ?? { currentAmount: 0, completed: 0 };
    goalsByChild.set(goal.childId, {
      currentAmount: existing.currentAmount + Number(goal.currentAmount),
      completed: existing.completed + (goal.status === GoalStatus.completed ? 1 : 0),
    });
  }
  const completedChoresByChild = new Map<string, number>();
  for (const chore of chores) {
    if (chore.status !== "completed") continue;
    completedChoresByChild.set(chore.childId, (completedChoresByChild.get(chore.childId) ?? 0) + 1);
  }

  const totalDepositsInRange = parent.parentDeposits.reduce((sum, row) => sum + Number(row.amount), 0);
  const approvedTransactions = transactions.filter((tx) => tx.status === TransactionStatus.approved);
  const totalSentToChildren = approvedTransactions
    .filter((tx) => tx.type === TransactionType.earn)
    .reduce((sum, tx) => sum + Number(tx.amount), 0);
  const pendingApprovals = transactions.filter((tx) => tx.status === TransactionStatus.pending).length;
  const reservedForActiveAllowances = allowances.filter((item) => item.isActive).reduce((sum, item) => sum + Number(item.amount), 0);

  let rows: Array<Record<string, string | number | boolean | null | undefined>> = [];
  let filename = `report-${type}-${suffix}.csv`;

  if (type === "parent-summary") {
    rows = [{
      range: suffix,
      parentBalance: Number(parent.accountBalance),
      totalDepositedLifetime: Number(parent.totalDeposited),
      depositsInRange: totalDepositsInRange,
      pendingApprovals,
      reservedForActiveAllowances,
      totalSentToChildren,
    }];
  } else if (type === "children-overview") {
    rows = children.map((child) => {
      const goalStats = goalsByChild.get(child.id) ?? { currentAmount: 0, completed: 0 };
      const walletBalance = Number(child.wallet?.balance ?? 0);
      const totalSaved = walletBalance + goalStats.currentAmount;
      const completedGoals = goalStats.completed;
      const completedChores = completedChoresByChild.get(child.id) ?? 0;
      return {
        childId: child.id,
        childName: child.nickname,
        age: child.age,
        walletBalance,
        walletTotalEarned: Number(child.wallet?.totalEarned ?? 0),
        walletTotalSpent: Number(child.wallet?.totalSpent ?? 0),
        savedInGoals: goalStats.currentAmount,
        totalSaved,
        goalsCompleted: completedGoals,
        badgesEarned: completedGoals + completedChores,
      };
    });
  } else if (type === "transactions") {
    rows = transactions.map((tx) => ({
      transactionId: tx.id,
      childId: tx.childId,
      childName: tx.child.nickname,
      type: tx.type,
      status: tx.status,
      amount: Number(tx.amount),
      description: tx.description ?? "",
      createdAt: tx.createdAt.toISOString(),
    }));
  } else if (type === "pending") {
    filename = `report-pending-${suffix}.csv`;
    rows = transactions
      .filter((tx) => tx.status === TransactionStatus.pending)
      .map((tx) => ({
        transactionId: tx.id,
        childId: tx.childId,
        childName: tx.child.nickname,
        type: tx.type,
        status: tx.status,
        amount: Number(tx.amount),
        description: tx.description ?? "",
        createdAt: tx.createdAt.toISOString(),
      }));
  } else if (type === "goals") {
    rows = goals.map((goal) => ({
      goalId: goal.id,
      childId: goal.childId,
      childName: goal.child.nickname,
      title: goal.title,
      targetAmount: Number(goal.targetAmount),
      currentAmount: Number(goal.currentAmount),
      status: goal.status,
      targetDate: goal.targetDate?.toISOString() ?? "",
      completedAt: goal.completedAt?.toISOString() ?? "",
    }));
  } else if (type === "chores") {
    rows = chores.map((chore) => ({
      choreId: chore.id,
      childId: chore.childId,
      childName: chore.child.nickname,
      title: chore.title,
      status: chore.status,
      rewardAmount: Number(chore.rewardAmount),
      dueDate: chore.dueDate?.toISOString() ?? "",
      completedAt: chore.completedAt?.toISOString() ?? "",
    }));
  } else if (type === "allowances") {
    rows = allowances.map((item) => ({
      allowanceId: item.id,
      childId: item.childId,
      childName: item.child.nickname,
      title: item.title,
      amount: Number(item.amount),
      availableOn: item.availableOn.toISOString(),
      isActive: item.isActive,
      notes: item.notes ?? "",
    }));
  } else if (type === "learning") {
    rows = learningAssignments.map((item) => ({
      assignmentId: item.id,
      childId: item.childId,
      childName: item.child.nickname,
      lessonId: item.lessonId,
      lessonTitle: item.lesson.title,
      status: item.status,
      progressPercent: item.progressPercent,
      assignedAt: item.assignedAt.toISOString(),
      firstViewedAt: item.firstViewedAt?.toISOString() ?? "",
      lastViewedAt: item.lastViewedAt?.toISOString() ?? "",
      completedAt: item.completedAt?.toISOString() ?? "",
    }));
  } else if (type === "support") {
    rows = supportTickets.map((item) => ({
      ticketId: item.id,
      issueType: item.issueType,
      status: item.status,
      createdAt: item.createdAt.toISOString(),
      message: item.message,
    }));
  } else {
    filename = `full-report-export-${suffix}.csv`;
    rows = [
      {
        section: "summary",
        key: "parent_balance",
        value: Number(parent.accountBalance),
      },
      {
        section: "summary",
        key: "total_sent_to_children",
        value: totalSentToChildren,
      },
      ...children.map((child) => {
        const goalStats = goalsByChild.get(child.id) ?? { currentAmount: 0, completed: 0 };
        const walletBalance = Number(child.wallet?.balance ?? 0);
        const totalSaved = walletBalance + goalStats.currentAmount;
        const completedGoals = goalStats.completed;
        const completedChores = completedChoresByChild.get(child.id) ?? 0;
        return {
          section: "child_overview",
          key: child.nickname,
          value: `saved=${totalSaved}; goals=${completedGoals}; badges=${completedGoals + completedChores}`,
        };
      }),
      ...transactions.slice(0, 300).map((tx) => ({
        section: "transaction",
        key: tx.id,
        value: `${tx.child.nickname}; ${tx.type}; ${tx.status}; ${Number(tx.amount)}`,
      })),
    ];
  }

  return { rows, filename };
}

function filterReportRowsForPdfInclude(
  type: ParentReportExportType,
  rows: Array<Record<string, string | number | boolean | null | undefined>>,
  includeRaw: string | undefined,
): Array<Record<string, string | number | boolean | null | undefined>> {
  const raw = includeRaw?.trim() ?? "";
  if (!raw) return rows;
  const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);

  if (type === "transactions" || type === "pending") {
    const keyFor = (field: string): string | null => {
      if (field === "date") return "createdAt";
      if (field === "child") return "childName";
      if (field === "type" || field === "status" || field === "description" || field === "amount") return field;
      return null;
    };
    return rows.map((row) => {
      const next: Record<string, string | number | boolean | null | undefined> = {};
      for (const p of parts) {
        const k = keyFor(p);
        if (k && Object.prototype.hasOwnProperty.call(row, k)) {
          next[k] = row[k];
        }
      }
      return Object.keys(next).length > 0 ? next : row;
    });
  }

  if (type === "children-overview") {
    const allow = new Set(parts);
    return rows.map((row) => {
      const next: Record<string, string | number | boolean | null | undefined> = {};
      for (const k of Object.keys(row)) {
        if (allow.has(k)) next[k] = row[k];
      }
      return Object.keys(next).length > 0 ? next : row;
    });
  }

  if (type === "full-export") {
    const allow = new Set(parts);
    return rows.filter((row) => allow.has(String(row.section ?? "")));
  }

  return rows;
}

function reportTypePdfTitle(type: ParentReportExportType): string {
  switch (type) {
    case "transactions":
      return "Transaction history";
    case "pending":
      return "Pending requests";
    case "children-overview":
      return "Spending summary";
    case "full-export":
      return "Monthly report";
    default:
      return `Report (${type})`;
  }
}

async function renderParentReportPdfBuffer(opts: {
  title: string;
  subtitle: string;
  rows: Array<Record<string, string | number | boolean | null | undefined>>;
}): Promise<Buffer> {
  const doc = new PDFDocument({ margin: 36, size: "A4" });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(chunk));

  doc.fontSize(16).text(opts.title, { align: "left" });
  doc.moveDown(0.3);
  doc.fontSize(10).text(opts.subtitle);
  doc.text(`Generated: ${new Date().toLocaleString()}`);
  doc.moveDown(0.5);

  if (opts.rows.length === 0) {
    doc.fontSize(12).text("No records for this selection.");
  } else {
    const limit = 350;
    opts.rows.slice(0, limit).forEach((row, index) => {
      if (doc.y > 740) doc.addPage();
      doc.fontSize(9).font("Helvetica-Bold").text(`${index + 1}.`);
      doc.font("Helvetica");
      Object.entries(row).forEach(([k, v]) => {
        doc.fontSize(8).text(`  ${k}: ${v === null || v === undefined ? "" : String(v)}`);
      });
      doc.moveDown(0.25);
    });
    if (opts.rows.length > limit) {
      doc.fontSize(9).text(`Showing ${limit} of ${opts.rows.length} rows.`);
    }
  }

  doc.end();
  await new Promise<void>((resolve, reject) => {
    doc.on("end", () => resolve());
    doc.on("error", reject);
  });
  return Buffer.concat(chunks);
}

router.get("/reports/pdf", authMiddleware, requireRole("parent"), async (req: AuthenticatedRequest, res) => {
  try {
    const range = (typeof req.query.range === "string" ? req.query.range : "this_month") as ParentReportRange;
    const type = (typeof req.query.type === "string" ? req.query.type : "full-export") as ParentReportExportType;
    const includeRaw = typeof req.query.include === "string" ? req.query.include : undefined;
    const allowedTypes: ParentReportExportType[] = [
      "parent-summary",
      "children-overview",
      "transactions",
      "pending",
      "goals",
      "chores",
      "allowances",
      "learning",
      "support",
      "full-export",
    ];
    const allowedRanges: ParentReportRange[] = ["this_month", "last_30_days", "all_time"];
    if (!allowedTypes.includes(type)) {
      return res.status(400).json({ error: "Invalid report export type" });
    }
    if (!allowedRanges.includes(range)) {
      return res.status(400).json({ error: "Invalid report range" });
    }

    const computed = await computeParentReportRows(req.user!.userId, range, type);
    if (!computed) {
      return res.status(404).json({ error: "Parent account not found" });
    }

    const rowsFiltered = filterReportRowsForPdfInclude(type, computed.rows, includeRaw);
    const title = reportTypePdfTitle(type);
    const suffixLabel =
      range === "this_month" ? "This month" : range === "last_30_days" ? "Last 30 days" : "All time";
    const subtitle = `Period: ${suffixLabel}`;
    const pdfBuffer = await renderParentReportPdfBuffer({
      title,
      subtitle,
      rows: rowsFiltered,
    });

    const pdfFilename = computed.filename.replace(/\.csv$/i, ".pdf");
    return res.json({
      filename: pdfFilename,
      mimeType: "application/pdf",
      pdfBase64: pdfBuffer.toString("base64"),
      type,
      range,
      count: rowsFiltered.length,
    });
  } catch (error) {
    console.error("Generate parent report PDF error:", error);
    res.status(500).json({ error: "Failed to generate parent report PDF" });
  }
});

// â”€â”€â”€ Parent Support â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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












