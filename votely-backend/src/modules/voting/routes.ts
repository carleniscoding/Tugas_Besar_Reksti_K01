import { Router } from "express";
import { requireAuth, type AuthenticatedRequest } from "../auth/middleware.js";
import { asyncHandler, HttpError } from "../../shared/http.js";
import { castVote, checkVote } from "./service.js";

export const votingRouter = Router();

votingRouter.get("/check", requireAuth, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const electionId = String(req.query.electionId || "");
  if (!electionId) throw new HttpError(400, "Election ID is required");
  const data = await checkVote(req.user!.id, electionId);
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.json({ success: true, data });
}));

votingRouter.post("/cast", requireAuth, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { electionId, candidateId, voteToken } = req.body;
  if (!electionId || !candidateId) throw new HttpError(400, "Election ID and Candidate ID are required");
  const data = await castVote({
    userId: req.user!.id,
    electionId: String(electionId),
    candidateId: String(candidateId),
    voteToken,
    sourceIp: req.ip,
    userAgent: req.header("user-agent") || undefined,
  });
  res.json({ success: true, data, message: "Vote cast successfully!" });
}));

votingRouter.post("/record", requireAuth, asyncHandler(async (_req, res) => {
  res.status(410).json({ success: false, error: "Use /api/vote/cast so blockchain and vote-token checks are enforced." });
}));
