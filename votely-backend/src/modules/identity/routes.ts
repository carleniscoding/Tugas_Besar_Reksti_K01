import { Router } from "express";
import { extractToken } from "../auth/middleware.js";
import { verifyAuthToken } from "../auth/service.js";
import { asyncHandler } from "../../shared/http.js";
import { generateEmbedding, registerFace, verifyFace } from "./service.js";

export const identityRouter = Router();

identityRouter.post("/", asyncHandler(async (req, res) => {
  const token = extractToken(req);
  const decoded = token ? verifyAuthToken(token) : undefined;
  const data = await verifyFace({
    image: req.body.image,
    nik: req.body.nik || decoded?.nik,
    userId: decoded?.userId,
    electionId: req.body.electionId,
  });
  res.json(data);
}));

identityRouter.post("/register", asyncHandler(async (req, res) => {
  const data = await registerFace(req.body.nik, req.body.image);
  res.json(data);
}));

identityRouter.post("/generate-embedding", asyncHandler(async (req, res) => {
  const data = await generateEmbedding(req.body.image);
  res.json(data);
}));
