import { Router } from "express";
import { z } from "zod";
import { Role } from "@prisma/client";
import {
  AUTH_COOKIE,
  comparePassword,
  hashPassword,
  signToken,
} from "../lib/auth";
import { authMiddleware, AuthenticatedRequest } from "../middleware/auth";
import { prisma } from "../db";

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const registerSchema = z.object({
  fullName: z.string().min(3).max(120),
  nin: z.string().regex(/^[A-Za-z0-9]{8,20}$/),
  phoneNumber: z.string().regex(/^\+?[0-9]{10,15}$/),
  email: z.string().email(),
  password: z.string().min(8),
  confirmPassword: z.string().min(8),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(8),
  newPassword: z.string().min(8),
  confirmPassword: z.string().min(8),
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid input" });
    }

    const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const valid = await comparePassword(parsed.data.password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = signToken({ userId: user.id, role: user.role as "parent" | "child" | "admin", email: user.email });

    res.cookie(AUTH_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
    });

    res.json({ message: "Logged in", role: user.role, token });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Login failed" });
  }
});

// POST /api/auth/register
router.post("/register", async (req, res) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid input" });
    }

    if (parsed.data.password !== parsed.data.confirmPassword) {
      return res.status(400).json({ error: "Passwords do not match" });
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: parsed.data.email },
          { nin: parsed.data.nin.toUpperCase() },
          { phoneNumber: parsed.data.phoneNumber },
        ],
      },
    });

    if (existingUser) {
      if (existingUser.email === parsed.data.email) {
        return res.status(409).json({ error: "Email already registered" });
      }
      if (existingUser.nin === parsed.data.nin.toUpperCase()) {
        return res.status(409).json({ error: "NIN already registered" });
      }
      return res.status(409).json({ error: "Phone number already registered" });
    }

    const passwordHash = await hashPassword(parsed.data.password);
    await prisma.user.create({
      data: {
        fullName: parsed.data.fullName,
        nin: parsed.data.nin.toUpperCase(),
        phoneNumber: parsed.data.phoneNumber,
        email: parsed.data.email,
        passwordHash,
        role: Role.parent,
      },
    });

    res.status(201).json({ message: "Parent account created" });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ error: "Registration failed" });
  }
});

// GET /api/auth/me
router.get("/me", authMiddleware, (req: AuthenticatedRequest, res) => {
  res.json({ user: req.user });
});

// POST /api/auth/logout
router.post("/logout", (req, res) => {
  res.clearCookie(AUTH_COOKIE, { path: "/" });
  res.json({ message: "Logged out" });
});

// POST /api/auth/change-password
router.post("/change-password", authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid input" });
    }

    const { currentPassword, newPassword, confirmPassword } = parsed.data;
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: "New passwords do not match" });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { id: true, passwordHash: true },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const isValid = await comparePassword(currentPassword, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({ error: "New password must be different from current password" });
    }

    const passwordHash = await hashPassword(newPassword);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

    res.json({ message: "Password changed successfully" });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({ error: "Failed to change password" });
  }
});

export default router;

