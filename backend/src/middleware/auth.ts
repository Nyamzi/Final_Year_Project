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

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user?.email) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const appUser = await prisma.user.findUnique({
    where: { id: data.user.id },
    select: { id: true, email: true, role: true },
  });
  if (!appUser) {
    return res.status(401).json({ error: "User profile not found" });
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


