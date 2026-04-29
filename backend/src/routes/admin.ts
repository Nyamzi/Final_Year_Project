import { Router } from "express";
import { prisma } from "../db";
import { authMiddleware, AuthenticatedRequest, requireRole } from "../middleware/auth";
import { Role, TransactionStatus, TransactionType } from "@prisma/client";
import { z } from "zod";

const router = Router();

const lessonSchema = z.object({
  title: z.string().min(3),
  content: z.string().min(10),
  isPublished: z.boolean().optional(),
});

const quizSchema = z.object({
  title: z.string().min(3),
  isPublished: z.boolean().optional(),
});

// GET /api/admin/analytics
router.get("/analytics", authMiddleware, requireRole("admin"), async (req: AuthenticatedRequest, res) => {
  try {
    const [
      totalParents,
      totalChildren,
      totalTransactions,
      pendingTransactions,
      approvedTransactions,
      totalLessons,
      totalQuizzes,
      earnCount,
      spendCount,
    ] = await Promise.all([
      prisma.user.count({ where: { role: Role.parent } }),
      prisma.user.count({ where: { role: Role.child } }),
      prisma.transaction.count(),
      prisma.transaction.count({ where: { status: TransactionStatus.pending } }),
      prisma.transaction.count({ where: { status: TransactionStatus.approved } }),
      prisma.lesson.count(),
      prisma.quiz.count(),
      prisma.transaction.count({ where: { type: TransactionType.earn } }),
      prisma.transaction.count({ where: { type: TransactionType.spend } }),
    ]);

    res.json({
      totalParents,
      totalChildren,
      totalTransactions,
      pendingTransactions,
      approvedTransactions,
      totalLessons,
      totalQuizzes,
      earnCount,
      spendCount,
    });
  } catch (error) {
    console.error("Get analytics error:", error);
    res.status(500).json({ error: "Failed to fetch analytics" });
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

    const lesson = await prisma.lesson.create({
      data: {
        ...parsed.data,
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
