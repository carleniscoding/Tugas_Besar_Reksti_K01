import type { NextFunction, Request, Response } from "express";
import { Role } from "../../shared/prisma.js";
import { getCurrentUserFromToken } from "./service.js";
import { HttpError } from "../../shared/http.js";

export type AuthenticatedRequest = Request & {
  user?: Awaited<ReturnType<typeof getCurrentUserFromToken>>;
  token?: string;
};

export function extractToken(req: Request) {
  const authorization = req.header("authorization");
  if (authorization?.toLowerCase().startsWith("bearer ")) {
    return authorization.slice("bearer ".length).trim();
  }
  return req.cookies?.token as string | undefined;
}

export async function requireAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  try {
    const token = extractToken(req);
    if (!token) throw new HttpError(401, "Unauthorized");
    req.token = token;
    req.user = await getCurrentUserFromToken(token);
    next();
  } catch (error) {
    next(error);
  }
}

export async function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  await requireAuth(req, res, (error?: unknown) => {
    if (error) return next(error);
    if (req.user?.role !== Role.ADMIN) return next(new HttpError(403, "Forbidden: Admin access required"));
    next();
  });
}
