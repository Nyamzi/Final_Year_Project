import { Router } from "express";
import { prisma } from "../db";
import { authMiddleware, AuthenticatedRequest, requireRole } from "../middleware/auth";
import { GoalStatus, Role, TransactionStatus, TransactionType } from "@prisma/client";
import { z } from "zod";
import fs from "fs";
import path from "path";

const router = Router();

const lessonSchema = z.object({
  title: z.string().min(3),
  content: z.string().min(3),
  resourceType: z.enum(["text", "pdf", "video"]).optional(),
  resourceUrl: z.string().optional(),
  fileName: z.string().optional(),
  fileData: z.string().optional(),
  isPublished: z.boolean().optional(),
});

const quizSchema = z.object({
  title: z.string().min(3),
  isPublished: z.boolean().optional(),
});

// GET /api/admin/users/parents
router.get("/users/parents", authMiddleware, requireRole("admin"), async (_req: AuthenticatedRequest, res) => {
  try {
    const [totalParents, parentProfiles, totalParentDeposits, openTickets, pendingTransactions] = await Promise.all([
      prisma.user.count({ where: { role: Role.parent } }),
      prisma.user.findMany({
        where: { role: Role.parent },
        select: {
          id: true,
          fullName: true,
          email: true,
          accountBalance: true,
          totalDeposited: true,
          parentChildren: { select: { id: true } },
          supportTickets: {
            where: { status: { not: "resolved" } },
            select: { id: true },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.parentDeposit.aggregate({
        _sum: { amount: true },
        _count: { _all: true },
      }),
      prisma.supportTicket.count({
        where: {
          status: { not: "resolved" },
        },
      }),
      prisma.transaction.count({ where: { status: TransactionStatus.pending } }),
    ]);

    const totalChildrenLinked = parentProfiles.reduce((sum, parent) => sum + parent.parentChildren.length, 0);
    const totalBalanceHeld = parentProfiles.reduce((sum, parent) => sum + Number(parent.accountBalance), 0);

    res.json({
      summary: {
        totalParents,
        totalChildrenLinked,
        totalBalanceHeld,
        totalParentDeposits: Number(totalParentDeposits._sum.amount ?? 0),
        totalDepositTransactions: totalParentDeposits._count._all,
        openSupportTickets: openTickets,
        pendingTransactions,
      },
      parents: parentProfiles.slice(0, 12).map((parent) => ({
        id: parent.id,
        fullName: parent.fullName ?? "Unnamed Parent",
        email: parent.email,
        childCount: parent.parentChildren.length,
        accountBalance: Number(parent.accountBalance),
        totalDeposited: Number(parent.totalDeposited),
        openTicketCount: parent.supportTickets.length,
      })),
    });
  } catch (error) {
    console.error("Get admin parent users error:", error);
    res.status(500).json({ error: "Failed to fetch parent user stats" });
  }
});

// GET /api/admin/users/children
router.get("/users/children", authMiddleware, requireRole("admin"), async (_req: AuthenticatedRequest, res) => {
  try {
    const [totalChildren, childProfiles, transactions, goals, chores] = await Promise.all([
      prisma.user.count({ where: { role: Role.child } }),
      prisma.childProfile.findMany({
        include: {
          wallet: true,
          parent: { select: { id: true, fullName: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.transaction.findMany({
        include: { child: true },
      }),
      prisma.savingsGoal.count({ where: { status: "completed" } }),
      prisma.choreAssignment.count({ where: { status: "completed" } }),
    ]);

    const totalWalletBalance = childProfiles.reduce((sum, child) => sum + Number(child.wallet?.balance ?? 0), 0);
    const pendingApprovals = transactions.filter((tx) => tx.status === TransactionStatus.pending).length;
    const approvedEarn = transactions
      .filter((tx) => tx.status === TransactionStatus.approved && tx.type === TransactionType.earn)
      .reduce((sum, tx) => sum + Number(tx.amount), 0);
    const approvedSpend = transactions
      .filter((tx) => tx.status === TransactionStatus.approved && tx.type === TransactionType.spend)
      .reduce((sum, tx) => sum + Number(tx.amount), 0);

    res.json({
      summary: {
        totalChildren,
        totalWalletBalance,
        pendingApprovals,
        approvedEarn,
        approvedSpend,
        goalsCompleted: goals,
        choresCompleted: chores,
      },
      children: childProfiles.slice(0, 12).map((child) => ({
        id: child.id,
        nickname: child.nickname,
        age: child.age,
        parentName: child.parent.fullName ?? "Unknown Parent",
        walletBalance: Number(child.wallet?.balance ?? 0),
        totalEarned: Number(child.wallet?.totalEarned ?? 0),
        totalSpent: Number(child.wallet?.totalSpent ?? 0),
      })),
    });
  } catch (error) {
    console.error("Get admin child users error:", error);
    res.status(500).json({ error: "Failed to fetch child user stats" });
  }
});

function getCategoryFromTransaction(tx: { type: TransactionType; description: string | null }) {
  const description = (tx.description ?? "").toLowerCase();
  if (description.includes("allowance")) return "Allowance";
  if (description.includes("chore")) return "Chore Reward";
  if (description.includes("goal")) return "Savings Goal";
  if (tx.type === TransactionType.earn) return "Earn";
  return "Spend";
}

function getRecentMonthBuckets(count: number) {
  const now = new Date();
  return Array.from({ length: count }).map((_, idx) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (count - 1 - idx), 1);
    return {
      label: date.toLocaleString("en", { month: "short" }),
      month: date.getMonth(),
      year: date.getFullYear(),
    };
  });
}

function getRecentDayBuckets(count: number) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Array.from({ length: count }).map((_, idx) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (count - 1 - idx));
    return {
      label: date.toLocaleString("en", { weekday: "short" }),
      day: date.getDate(),
      month: date.getMonth(),
      year: date.getFullYear(),
    };
  });
}

function sameMonth(date: Date, bucket: { month: number; year: number }) {
  return date.getMonth() === bucket.month && date.getFullYear() === bucket.year;
}

function sameDay(date: Date, bucket: { day: number; month: number; year: number }) {
  return date.getDate() === bucket.day && date.getMonth() === bucket.month && date.getFullYear() === bucket.year;
}
// GET /api/admin/analytics
router.get("/analytics", authMiddleware, requireRole("admin"), async (_req: AuthenticatedRequest, res) => {
  try {
    const monthBuckets = getRecentMonthBuckets(6);
    const dayBuckets = getRecentDayBuckets(7);
    const now = new Date();
    const sinceForMonths = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const sinceForDays = new Date();
    sinceForDays.setDate(sinceForDays.getDate() - 6);
    sinceForDays.setHours(0, 0, 0, 0);

    const [
      totalParents,
      totalChildren,
      totalAdmins,
      totalTransactions,
      pendingTransactions,
      approvedTransactions,
      totalLessons,
      totalQuizzes,
      earnCount,
      spendCount,
      deposits,
      transactionsForMonths,
      pendingWithdrawalsRaw,
      lessonAssignments,
      quizzes,
      actionLogs,
      activeUsersCount,
      savingsGoals,
    ] = await Promise.all([
      prisma.user.count({ where: { role: Role.parent } }),
      prisma.user.count({ where: { role: Role.child } }),
      prisma.user.count({ where: { role: Role.admin } }),
      prisma.transaction.count(),
      prisma.transaction.count({ where: { status: TransactionStatus.pending } }),
      prisma.transaction.count({ where: { status: TransactionStatus.approved } }),
      prisma.lesson.count(),
      prisma.quiz.count(),
      prisma.transaction.count({ where: { type: TransactionType.earn } }),
      prisma.transaction.count({ where: { type: TransactionType.spend } }),
      prisma.parentDeposit.findMany({ where: { createdAt: { gte: sinceForMonths } }, select: { amount: true, createdAt: true } }),
      prisma.transaction.findMany({
        where: { createdAt: { gte: sinceForMonths } },
        select: { amount: true, type: true, status: true, withdrawalSource: true, description: true, createdAt: true },
      }),
      prisma.transaction.findMany({
        where: { type: TransactionType.spend, status: TransactionStatus.pending },
        include: { child: { include: { parent: { select: { fullName: true, email: true } } } } },
        orderBy: { createdAt: "desc" },
        take: 6,
      }),
      prisma.childLessonAssignment.findMany({
        include: { child: true, lesson: { select: { title: true } } },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.quiz.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
      prisma.dashboardActionLog.findMany({ where: { createdAt: { gte: sinceForDays } }, select: { userId: true, createdAt: true, role: true } }),
      prisma.user.count({ where: { dashboardActionLogs: { some: { createdAt: { gte: sinceForDays } } } } }),
      prisma.savingsGoal.findMany({ include: { child: true }, orderBy: { updatedAt: "desc" }, take: 10 }),
    ]);

    const approvedEarnAmount = transactionsForMonths
      .filter((tx) => tx.status === TransactionStatus.approved && tx.type === TransactionType.earn)
      .reduce((sum, tx) => sum + Number(tx.amount), 0);
    const approvedSpendAmount = transactionsForMonths
      .filter((tx) => tx.status === TransactionStatus.approved && tx.type === TransactionType.spend)
      .reduce((sum, tx) => sum + Number(tx.amount), 0);
    const totalDeposits = deposits.reduce((sum, deposit) => sum + Number(deposit.amount), 0);

    const monthlyTransactions = monthBuckets.map((bucket) => {
      const monthTransactions = transactionsForMonths.filter((tx) => sameMonth(tx.createdAt, bucket));
      const monthDeposits = deposits.filter((deposit) => sameMonth(deposit.createdAt, bucket));
      return {
        month: bucket.label,
        transactions: monthTransactions.length,
        deposits: monthDeposits.reduce((sum, deposit) => sum + Number(deposit.amount), 0),
        withdrawals: monthTransactions.filter((tx) => tx.type === TransactionType.spend).reduce((sum, tx) => sum + Number(tx.amount), 0),
      };
    });

    const completedLessons = lessonAssignments.filter((assignment) => assignment.progressPercent >= 100 || assignment.status === "completed").length;
    const averageLearningProgress = lessonAssignments.length
      ? Math.round(lessonAssignments.reduce((sum, assignment) => sum + assignment.progressPercent, 0) / lessonAssignments.length)
      : 0;

    const publishedQuizzes = quizzes.filter((quiz) => quiz.isPublished).length;

    res.json({
      totalParents,
      totalChildren,
      totalAdmins,
      totalTransactions,
      pendingTransactions,
      approvedTransactions,
      totalLessons,
      totalQuizzes,
      earnCount,
      spendCount,
      usersByRole: [
        { role: "Parents", count: totalParents },
        { role: "Children", count: totalChildren },
        { role: "Admins", count: totalAdmins },
      ],
      depositsVsWithdrawals: {
        deposits: totalDeposits,
        withdrawals: approvedSpendAmount,
        earned: approvedEarnAmount,
      },
      monthlyTransactions,
      pendingWithdrawals: {
        count: pendingWithdrawalsRaw.length,
        totalAmount: pendingWithdrawalsRaw.reduce((sum, tx) => sum + Number(tx.amount), 0),
        items: pendingWithdrawalsRaw.map((tx) => ({
          id: tx.id,
          childName: tx.child.nickname,
          parentName: tx.child.parent.fullName ?? tx.child.parent.email,
          amount: Number(tx.amount),
          description: tx.description,
          createdAt: tx.createdAt.toISOString(),
        })),
      },
      learningProgress: {
        assigned: lessonAssignments.length,
        completed: completedLessons,
        inProgress: lessonAssignments.filter((assignment) => assignment.progressPercent > 0 && assignment.progressPercent < 100).length,
        averageProgress: averageLearningProgress,
        byChild: lessonAssignments.slice(0, 8).map((assignment) => ({
          childName: assignment.child.nickname,
          lessonTitle: assignment.lesson.title,
          progressPercent: assignment.progressPercent,
        })),
      },
      quizPerformance: {
        totalQuizzes,
        published: publishedQuizzes,
        drafts: Math.max(0, totalQuizzes - publishedQuizzes),
        completionRate: totalQuizzes ? Math.round((publishedQuizzes / totalQuizzes) * 100) : 0,
        monthlyPublished: monthBuckets.map((bucket) => ({
          month: bucket.label,
          count: quizzes.filter((quiz) => quiz.isPublished && sameMonth(quiz.createdAt, bucket)).length,
        })),
      },
      activeUsers: {
        activeUsersCount,
        daily: dayBuckets.map((bucket) => ({
          day: bucket.label,
          count: new Set(actionLogs.filter((log) => sameDay(log.createdAt, bucket)).map((log) => log.userId)).size,
        })),
        byRole: [Role.admin, Role.parent, Role.child].map((role) => ({
          role,
          count: new Set(actionLogs.filter((log) => log.role === role).map((log) => log.userId)).size,
        })),
      },
      savingsGoalsProgress: savingsGoals.map((goal) => ({
        id: goal.id,
        title: goal.title,
        childName: goal.child.nickname,
        currentAmount: Number(goal.currentAmount),
        targetAmount: Number(goal.targetAmount),
        progressPercent: goal.targetAmount > 0 ? Math.min(100, Math.round((Number(goal.currentAmount) / Number(goal.targetAmount)) * 100)) : 0,
        status: goal.status,
      })),
      activeSavingsGoals: savingsGoals.filter((goal) => goal.status === GoalStatus.active).length,
    });
  } catch (error) {
    console.error("Get analytics error:", error);
    res.status(500).json({ error: "Failed to fetch analytics" });
  }
});

// GET /api/admin/overview
router.get("/overview", authMiddleware, requireRole("admin"), async (_req: AuthenticatedRequest, res) => {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [transactions, recentTransactionsRaw, goals, tickets, recentUsers] = await Promise.all([
      prisma.transaction.findMany({
        include: { child: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.transaction.findMany({
        include: { child: true },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      prisma.savingsGoal.findMany({
        include: { child: true },
        orderBy: { currentAmount: "desc" },
        take: 5,
      }),
      prisma.supportTicket.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
      }),
      prisma.user.findMany({
        where: { createdAt: { gte: monthStart } },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    ]);

    const totalAmountTransacted = transactions.reduce((sum, tx) => sum + Number(tx.amount), 0);

    const activitySeries = Array.from({ length: 12 }).map((_, idx) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (11 - idx), 1);
      const month = date.getMonth();
      const year = date.getFullYear();
      return transactions.filter((tx) => tx.createdAt.getMonth() === month && tx.createdAt.getFullYear() === year).length;
    });

    const approvalSeries = Array.from({ length: 9 }).map((_, idx) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (8 - idx), 1);
      const month = date.getMonth();
      const year = date.getFullYear();
      const monthTx = transactions.filter((tx) => tx.createdAt.getMonth() === month && tx.createdAt.getFullYear() === year);
      const approved = monthTx.filter((tx) => tx.status === TransactionStatus.approved).length;
      if (monthTx.length === 0) return 0;
      return Math.round((approved / monthTx.length) * 100);
    });

    const categoryTotals = new Map<string, number>();
    for (const tx of transactions) {
      const key = getCategoryFromTransaction(tx);
      categoryTotals.set(key, (categoryTotals.get(key) ?? 0) + Number(tx.amount));
    }
    const categoryBreakdown = Array.from(categoryTotals.entries())
      .map(([label, amount]) => ({
        label,
        amount,
        percent: totalAmountTransacted > 0 ? Math.round((amount / totalAmountTransacted) * 100) : 0,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    const recentTransactions = recentTransactionsRaw.map((tx) => ({
      id: tx.id,
      childName: tx.child.nickname,
      type: tx.type,
      category: getCategoryFromTransaction(tx),
      amount: Number(tx.amount),
      status: tx.status,
      createdAt: tx.createdAt.toISOString(),
    }));

    const topSavingGoals = goals.map((goal) => ({
      id: goal.id,
      title: goal.title,
      childName: goal.child.nickname,
      currentAmount: Number(goal.currentAmount),
      targetAmount: Number(goal.targetAmount),
    }));

    const supportTickets = tickets.map((ticket) => ({
      id: ticket.id,
      issueType: ticket.issueType,
      status: ticket.status,
      createdAt: ticket.createdAt.toISOString(),
    }));

    const criticalAlerts = transactions
      .filter((tx) => tx.status === TransactionStatus.rejected || tx.status === TransactionStatus.pending || Number(tx.amount) >= 1000000)
      .slice(0, 8)
      .map((tx) => ({
        id: tx.id,
        title:
          tx.status === TransactionStatus.rejected
            ? "Rejected transaction"
            : tx.status === TransactionStatus.pending
              ? "Pending approval transaction"
              : "High value transaction",
        detail: `${tx.child.nickname} - UGX ${Number(tx.amount).toLocaleString()}`,
        severity:
          tx.status === TransactionStatus.rejected
            ? "danger"
            : tx.status === TransactionStatus.pending
              ? "warning"
              : "info",
        createdAt: tx.createdAt.toISOString(),
      }));

    res.json({
      totalAmountTransacted,
      activitySeries,
      approvalSeries,
      categoryBreakdown,
      recentTransactions,
      topSavingGoals,
      supportTickets,
      criticalAlerts,
      newUsersThisMonth: recentUsers.length,
    });
  } catch (error) {
    console.error("Get admin overview error:", error);
    res.status(500).json({ error: "Failed to fetch admin overview data" });
  }
});

// GET /api/admin/lessons
router.get("/lessons", authMiddleware, requireRole("admin"), async (req: AuthenticatedRequest, res) => {
  try {
    const lessons = await prisma.lesson.findMany({ orderBy: { createdAt: "desc" } });
    res.json({ lessons });
  } catch (error) {
    console.error("Get lessons error:", error);
    res.status(500).json({ error: "Failed to fetch lessons" });
  }
});

// POST /api/admin/lessons
router.post("/lessons", authMiddleware, requireRole("admin"), async (req: AuthenticatedRequest, res) => {
  try {
    const parsed = lessonSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid lesson payload" });
    }

    const resourceType = parsed.data.resourceType ?? "text";
    let resourceUrl = parsed.data.resourceUrl?.trim() || undefined;
    const fileName = parsed.data.fileName?.trim() || undefined;
    const fileData = parsed.data.fileData?.trim() || undefined;

    if (fileData) {
      const base64Marker = ";base64,";
      const markerIndex = fileData.indexOf(base64Marker);
      if (markerIndex === -1) {
        return res.status(400).json({ error: "Invalid file payload" });
      }

      const mimePart = fileData.slice(5, markerIndex);
      const base64Data = fileData.slice(markerIndex + base64Marker.length);
      const extFromMime = mimePart.includes("pdf")
        ? "pdf"
        : mimePart.includes("mp4")
          ? "mp4"
          : mimePart.includes("webm")
            ? "webm"
            : "bin";
      const uploadDir = path.join(process.cwd(), "uploads", "learning");
      fs.mkdirSync(uploadDir, { recursive: true });
      const safeFileNameBase = (fileName ?? parsed.data.title)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")
        .slice(0, 50) || "learning-file";
      const generatedName = `${Date.now()}-${safeFileNameBase}.${extFromMime}`;
      const targetPath = path.join(uploadDir, generatedName);
      fs.writeFileSync(targetPath, Buffer.from(base64Data, "base64"));
      resourceUrl = `/uploads/learning/${generatedName}`;
    }

    const lesson = await prisma.lesson.create({
      data: {
        title: parsed.data.title,
        content: parsed.data.content,
        resourceType,
        resourceUrl,
        fileName,
        isPublished: parsed.data.isPublished ?? false,
        createdById: req.user!.userId,
      },
    });

    res.status(201).json({ lesson });
  } catch (error) {
    console.error("Create lesson error:", error);
    res.status(500).json({ error: "Failed to create lesson" });
  }
});

// GET /api/admin/quizzes
router.get("/quizzes", authMiddleware, requireRole("admin"), async (req: AuthenticatedRequest, res) => {
  try {
    const quizzes = await prisma.quiz.findMany({ orderBy: { createdAt: "desc" } });
    res.json({ quizzes });
  } catch (error) {
    console.error("Get quizzes error:", error);
    res.status(500).json({ error: "Failed to fetch quizzes" });
  }
});

// POST /api/admin/quizzes
router.post("/quizzes", authMiddleware, requireRole("admin"), async (req: AuthenticatedRequest, res) => {
  try {
    const parsed = quizSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid quiz payload" });
    }

    const quiz = await prisma.quiz.create({
      data: {
        title: parsed.data.title,
        isPublished: parsed.data.isPublished ?? false,
        createdById: req.user!.userId,
      },
    });

    res.status(201).json({ quiz });
  } catch (error) {
    console.error("Create quiz error:", error);
    res.status(500).json({ error: "Failed to create quiz" });
  }
});

export default router;
