import { Router } from "express";
import { env } from "../../config/env.js";
import { asyncHandler, HttpError } from "../../shared/http.js";
import { serializeBigInt } from "../../shared/serializers.js";
import { extractToken, requireAuth, type AuthenticatedRequest } from "./middleware.js";
import { getCurrentUserFromToken, loginVoterAccount, registerVoterAccount, registerWithFace } from "./service.js";

export const authRouter = Router();

function setAuthCookie(res: any, token: string) {
  res.cookie("token", token, {
    httpOnly: true,
    secure: env.nodeEnv === "production",
    sameSite: "lax",
    maxAge: 24 * 60 * 60 * 1000,
    path: "/",
  });
}

authRouter.post("/login", asyncHandler(async (req, res) => {
  const { nik, password } = req.body;
  if (!nik || !password) throw new HttpError(400, "NIK dan password wajib diisi.");

  const result = await loginVoterAccount(nik, password);
  setAuthCookie(res, result.token);
  res.json({ success: true, message: "Login berhasil", data: result.user, token: result.token });
}));

authRouter.get("/me", requireAuth, asyncHandler(async (req: AuthenticatedRequest, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.json({ success: true, data: serializeBigInt(req.user) });
}));

authRouter.post("/logout", (_req, res) => {
  res.clearCookie("token", { path: "/" });
  res.json({ success: true, message: "Logout berhasil" });
});

authRouter.post("/register", asyncHandler(async (req, res) => {
  const { nik, namaLengkap, password, provinsi, kabKota, kecamatan, kelurahan, dob } = req.body;
  if (!nik || !namaLengkap || !password || !provinsi || !kabKota || !kecamatan || !kelurahan || !dob) {
    throw new HttpError(400, "Semua field wajib diisi.");
  }
  const data = await registerVoterAccount(password, {
    nik,
    namaLengkap,
    provinsi,
    kabKota,
    kecamatan,
    kelurahan,
    tanggalLahir: new Date(dob),
  });
  res.status(201).json(serializeBigInt(data));
}));

authRouter.post("/register-with-face", asyncHandler(async (req, res) => {
  const data = await registerWithFace(req.body);
  res.status(201).json({ success: true, message: "Registrasi berhasil", data });
}));

authRouter.post("/validate-credentials", asyncHandler(async (req, res) => {
  const { nik, password } = req.body;
  const result = await loginVoterAccount(nik, password);
  res.json({ success: true, data: result.user });
}));

authRouter.get("/verify", asyncHandler(async (req, res) => {
  const token = extractToken(req);
  if (!token) throw new HttpError(401, "Unauthorized");
  const data = await getCurrentUserFromToken(token);
  res.json({ success: true, data: serializeBigInt(data) });
}));
