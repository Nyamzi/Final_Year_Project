import { Router } from "express";
import { z } from "zod";
import { Role, Sex } from "@prisma/client";
import { AUTH_COOKIE } from "../lib/auth";
import { authMiddleware, AuthenticatedRequest } from "../middleware/auth";
import { prisma } from "../db";
import { getSupabaseAdmin, supabase } from "../lib/supabase";

const router = Router();

const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

const registerSchema = z.object({
  fullName: z.string().trim().min(3, "Full name must be at least 3 characters.").max(120, "Full name is too long."),
  nin: z.string().trim().regex(/^[A-Za-z0-9]{8,20}$/, "NIN must be 8 to 20 letters or numbers."),
  phoneNumber: z.string().trim().regex(/^\+?[0-9]{10,15}$/, "Phone number must be 10 to 15 digits and may start with +."),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  sex: z.enum(["male", "female"], { message: "Select male or female." }),
  profileImageUrl: z.string().min(20, "Choose a profile picture."),
  password: z.string().min(8, "Password must be at least 8 characters."),
  confirmPassword: z.string().min(8, "Confirm password must be at least 8 characters."),
});

function getValidationMessage(error: z.ZodError) {
  return error.issues[0]?.message ?? "Invalid input";
}

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
      return res.status(400).json({ error: getValidationMessage(parsed.error) });
    }

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    if (authError || !authData.session?.access_token || !authData.user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const user = await prisma.user.findUnique({ where: { id: authData.user.id } });
    if (!user) {
      return res.status(401).json({ error: "User profile not found" });
    }

    res.cookie(AUTH_COOKIE, authData.session.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: authData.session.expires_in * 1000,
    });

    res.json({ message: "Logged in", role: user.role, token: authData.session.access_token });
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
      return res.status(400).json({ error: getValidationMessage(parsed.error) });
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

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: process.env.SUPABASE_AUTH_REDIRECT_URL ?? "kidsapp://auth/callback",
        data: {
          fullName: parsed.data.fullName,
          role: Role.parent,
          sex: parsed.data.sex,
          profileImageUrl: parsed.data.profileImageUrl,
        },
      },
    });

    if (authError || !authData.user) {
      return res.status(400).json({ error: authError?.message ?? "Unable to create auth user" });
    }

    try {
      await prisma.user.create({
        data: {
          id: authData.user.id,
          fullName: parsed.data.fullName,
          nin: parsed.data.nin.toUpperCase(),
          phoneNumber: parsed.data.phoneNumber,
          email: parsed.data.email,
          sex: parsed.data.sex as Sex,
          profileImageUrl: parsed.data.profileImageUrl,
          role: Role.parent,
        },
      });
    } catch (error) {
      await getSupabaseAdmin().auth.admin.deleteUser(authData.user.id);
      throw error;
    }

    res.status(201).json({ message: "Parent account created. Check your email to verify your account.", userId: authData.user.id });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ error: "Registration failed" });
  }
});

// POST /api/auth/oauth-profile
router.post("/oauth-profile", async (req, res) => {
  try {
    const authHeader = req.header("authorization");
    const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    if (!bearerToken) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { data, error } = await supabase.auth.getUser(bearerToken);
    const authUser = data.user;
    if (error || !authUser?.email) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const existingById = await prisma.user.findUnique({ where: { id: authUser.id } });
    if (existingById) {
      return res.json({ user: { userId: existingById.id, email: existingById.email, role: existingById.role, fullName: existingById.fullName, phoneNumber: existingById.phoneNumber, nin: existingById.nin, sex: existingById.sex, profileImageUrl: existingById.profileImageUrl } });
    }

    const existingByEmail = await prisma.user.findUnique({ where: { email: authUser.email } });
    if (existingByEmail) {
      return res.status(409).json({ error: "An app profile already exists for this email. Sign in with the original method or contact support." });
    }

    const fullName =
      (authUser.user_metadata?.fullName as string | undefined) ??
      (authUser.user_metadata?.full_name as string | undefined) ??
      (authUser.user_metadata?.name as string | undefined) ??
      authUser.email.split("@")[0];

    const user = await prisma.user.create({
      data: {
        id: authUser.id,
        fullName,
        email: authUser.email,
        profileImageUrl: (authUser.user_metadata?.avatar_url as string | undefined) ?? null,
        role: Role.parent,
      },
    });

    res.status(201).json({ user: { userId: user.id, email: user.email, role: user.role, fullName: user.fullName, phoneNumber: user.phoneNumber, nin: user.nin, sex: user.sex, profileImageUrl: user.profileImageUrl } });
  } catch (error) {
    console.error("OAuth profile error:", error);
    res.status(500).json({ error: "Failed to prepare Google sign-in profile" });
  }
});
// GET /api/auth/me
router.get("/me", authMiddleware, async (req: AuthenticatedRequest, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
    select: { id: true, email: true, role: true, fullName: true, phoneNumber: true, nin: true, sex: true, profileImageUrl: true },
  });

  if (!user) {
    return res.status(404).json({ error: "User profile not found" });
  }

  let nickname: string | null = null;
  let childAge: number | null = null;
  let aboutMe: string | null = null;
  if (user.role === Role.child) {
    const childProfile = await prisma.childProfile.findUnique({
      where: { childUserId: user.id },
      select: { nickname: true, age: true, aboutMe: true },
    });
    nickname = childProfile?.nickname ?? null;
    childAge = childProfile?.age ?? null;
    aboutMe = childProfile?.aboutMe ?? null;
  }

  res.json({
    user: {
      userId: user.id,
      email: user.email,
      role: user.role,
      fullName: user.fullName,
      phoneNumber: user.phoneNumber,
      nin: user.nin,
      sex: user.sex,
      profileImageUrl: user.profileImageUrl,
      nickname,
      childAge,
      aboutMe,
    },
  });
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
      return res.status(400).json({ error: getValidationMessage(parsed.error) });
    }

    const { currentPassword, newPassword, confirmPassword } = parsed.data;
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: "New passwords do not match" });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { id: true, email: true },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });
    if (signInError) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({ error: "New password must be different from current password" });
    }

    const { error: updateError } = await getSupabaseAdmin().auth.admin.updateUserById(user.id, {
      password: newPassword,
    });
    if (updateError) {
      return res.status(400).json({ error: updateError.message });
    }

    res.json({ message: "Password changed successfully" });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({ error: "Failed to change password" });
  }
});

export default router;


