import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { authMiddleware, AuthenticatedRequest } from "../middleware/auth";

const router = Router();

const actionSchema = z.object({
  dashboard: z.string().min(2).max(40),
  action: z.string().min(2).max(120),
  metadata: z.string().max(500).optional(),
});

router.post("/log", authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const parsed = actionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid action payload" });
    }

    await prisma.dashboardActionLog.create({
      data: {
        userId: req.user!.userId,
        role: req.user!.role,
        dashboard: parsed.data.dashboard.trim(),
        action: parsed.data.action.trim(),
        metadata: parsed.data.metadata?.trim() || null,
      },
    });

    res.status(201).json({ message: "Action logged" });
  } catch (error) {
    console.error("Action log error:", error);
    res.status(500).json({ error: "Failed to log action" });
  }
});

export default router;
