import { Router } from "express";
import { requireAuth, type AuthenticatedRequest } from "../auth/middleware.js";
import { asyncHandler, HttpError } from "../../shared/http.js";
import { serializeBigInt } from "../../shared/serializers.js";
import { getAllElections, getElectionById, getElectionsForUser, getVoteCounts } from "./service.js";

export const electionsRouter = Router();

electionsRouter.get("/", asyncHandler(async (req: AuthenticatedRequest, res) => {
  if (req.query.forUser === "true") {
    await new Promise<void>((resolve, reject) => requireAuth(req, res, (error) => error ? reject(error) : resolve()));
    const elections = await getElectionsForUser(req.user!.id);
    res.json({ success: true, data: serializeBigInt(elections) });
    return;
  }
  const elections = await getAllElections();
  res.json({ success: true, data: serializeBigInt(elections) });
}));

electionsRouter.get("/:electionId", asyncHandler(async (req, res) => {
  const election = await getElectionById(req.params.electionId);
  if (!election) throw new HttpError(404, "Pemilu tidak ditemukan");
  const includeResults = req.query.includeResults === "true";
  const counts: { voteCounts: Record<string, number>; totalVotes?: number } = includeResults
    ? await getVoteCounts(req.params.electionId)
    : { voteCounts: {}, totalVotes: undefined };
  const data = {
    ...election,
    totalVotes: counts.totalVotes,
    candidates: election.candidates.map((candidate) => ({
      ...candidate,
      voteCount: includeResults ? counts.voteCounts[candidate.id.toString()] || 0 : undefined,
    })),
  };
  res.json({ success: true, data: serializeBigInt(data) });
}));

electionsRouter.get("/:electionId/results", asyncHandler(async (req, res) => {
  const election = await getElectionById(req.params.electionId);
  if (!election) throw new HttpError(404, "Election not found");
  if (new Date() <= election.endTime) {
    throw new HttpError(403, "Election results are not yet available. Results will be visible after the election ends.");
  }
  const { voteCounts, totalVotes } = await getVoteCounts(req.params.electionId);
  const results = election.candidates
    .map((candidate) => {
      const voteCount = voteCounts[candidate.id.toString()] || 0;
      return {
        candidateId: candidate.id.toString(),
        name: candidate.name,
        party: candidate.party,
        imageUrl: candidate.photoUrl,
        voteCount,
        percentage: totalVotes > 0 ? ((voteCount / totalVotes) * 100).toFixed(2) : "0.00",
      };
    })
    .sort((a, b) => b.voteCount - a.voteCount);
  res.json({
    success: true,
    data: serializeBigInt({
      electionId: election.id,
      electionName: election.name,
      description: election.description,
      startTime: election.startTime,
      endTime: election.endTime,
      totalVotes,
      results,
      winner: results[0] || null,
    }),
  });
}));

electionsRouter.all("/:electionId/vote", (_req, res) => {
  res.status(410).json({ success: false, error: "This endpoint is deprecated. Please use /api/vote/cast instead." });
});
