import { Request, Response, NextFunction } from "express";
import { AUTH_COOKIE, AuthTokenPayload, UserRole } from "../lib/auth";
import { prisma } from "../db";
import { supabase } from "../lib/supabase";

export interface AuthenticatedRequest extends Request {
  user?: AuthTokenPayload;
}

export async function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const cookieToken = (req.cookies as Record<string, string>)?.[AUTH_COOKIE];
  const authHeader = req.header("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  const token = cookieToken || bearerToken;
  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  let authUserId = "";
  let authUserEmail = "";
  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user?.email) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    authUserId = data.user.id;
    authUserEmail = data.user.email.toLowerCase();
  } catch (error) {
    console.error("Supabase auth lookup failed:", error);
    return res.status(503).json({ error: "Authentication service unavailable. Please try again." });
  }

  let appUser: { id: string; email: string; role: UserRole; isActive: boolean } | null = null;
  const findAppUser = async () => {
    const userById = await prisma.user.findUnique({
      where: { id: authUserId },
      select: { id: true, email: true, role: true, isActive: true },
    });
    if (userById) return userById;

    return prisma.user.findUnique({
      where: { email: authUserEmail },
      select: { id: true, email: true, role: true, isActive: true },
    });
  };

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      appUser = await findAppUser();
      break;
    } catch (error) {
      if (attempt === 3) {
        console.error("Database auth lookup failed after retries:", error);
        return res.status(503).json({ error: "Database temporarily unavailable. Please try again." });
      }

      const delayMs = attempt * 600;
      console.warn(`Database auth lookup failed. Retrying in ${delayMs}ms (${attempt}/3).`);
      await prisma.$connect().catch(() => undefined);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  if (!appUser) {
    return res.status(401).json({ error: "User profile not found" });
  }
  if (!appUser.isActive) {
    return res.status(403).json({ error: "Account is deactivated" });
  }

  req.user = {
    userId: appUser.id,
    email: appUser.email,
    role: appUser.role,
  };
  next();
}

export function requireRole(...roles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  };
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
}



