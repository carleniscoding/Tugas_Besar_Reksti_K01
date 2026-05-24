import crypto from "node:crypto";
import { prisma, type Prisma } from "../../shared/prisma.js";
import { HttpError } from "../../shared/http.js";
import { castVoteForVoter } from "../blockchain/service.js";
import { hashVoteToken } from "../identity/service.js";

export async function checkVote(userId: string, electionId: string) {
  const vote = await prisma.vote.findUnique({
    where: { userId_electionId: { userId, electionId: BigInt(electionId) } },
    include: { candidate: true },
  });
  if (!vote) {
    return { hasVoted: false, candidateId: null, candidateName: null, txHash: null, proofHash: null, votedAt: null };
  }
  return {
    hasVoted: true,
    candidateId: vote.candidateId.toString(),
    candidateName: vote.candidate.name,
    txHash: vote.txHash,
    proofHash: vote.proofHash,
    votedAt: vote.castAt.toISOString(),
  };
}

function buildProofHash(input: { userId: string; electionId: string; txHash: string; castAt: Date }) {
  return crypto
    .createHash("sha256")
    .update(`${input.userId}:${input.electionId}:${input.txHash}:${input.castAt.toISOString()}`)
    .digest("hex");
}

export async function castVote(params: {
  userId: string;
  electionId: string;
  candidateId: string;
  voteToken?: string;
  sourceIp?: string;
  userAgent?: string;
}) {
  const election = await prisma.election.findUnique({
    where: { id: BigInt(params.electionId) },
    include: { candidates: true },
  });
  if (!election) throw new HttpError(404, "Election not found");
  if (!election.chainElectionId) throw new HttpError(400, "Election is not deployed to blockchain");

  const now = new Date();
  if (now < election.startTime) throw new HttpError(400, "Election has not started yet");
  if (now > election.endTime) throw new HttpError(400, "Election has ended");

  const candidate = election.candidates.find((item) => item.id.toString() === params.candidateId);
  if (!candidate) throw new HttpError(404, "Candidate not found in this election");
  if (!candidate.chainCandidateId) throw new HttpError(400, "Candidate is not deployed to blockchain");

  const existingVote = await prisma.vote.findUnique({
    where: { userId_electionId: { userId: params.userId, electionId: BigInt(params.electionId) } },
  });
  if (existingVote) throw new HttpError(400, "You have already voted in this election");

  if (!params.voteToken) throw new HttpError(400, "Vote token is required. Please verify your face first.");
  const tokenHash = hashVoteToken(params.voteToken);
  const voteToken = await prisma.voteToken.findUnique({ where: { tokenHash } });
  if (!voteToken || voteToken.userId !== params.userId || voteToken.electionId !== BigInt(params.electionId)) {
    throw new HttpError(401, "Invalid vote token");
  }
  if (voteToken.usedAt) throw new HttpError(400, "Vote token has already been used");
  if (voteToken.expiresAt <= now) throw new HttpError(400, "Vote token has expired");

  const user = await prisma.user.findUnique({ where: { id: params.userId } });
  if (!user?.walletAddress) throw new HttpError(400, "User wallet is not configured");

  const txHash = await castVoteForVoter({
    chainElectionId: election.chainElectionId,
    chainCandidateId: candidate.chainCandidateId,
    voterAddress: user.walletAddress,
  });

  const castAt = new Date();
  const proofHash = buildProofHash({ userId: params.userId, electionId: params.electionId, txHash, castAt });

  const vote = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.voteToken.update({
      where: { id: voteToken.id },
      data: { usedAt: castAt },
    });
    const created = await tx.vote.create({
      data: {
        userId: params.userId,
        electionId: BigInt(params.electionId),
        candidateId: BigInt(params.candidateId),
        txHash,
        proofHash,
        castAt,
        sourceIp: params.sourceIp,
        userAgent: params.userAgent,
      },
    });
    await tx.auditLog.create({
      data: {
        userId: params.userId,
        action: "VOTE_CAST",
        entityType: "Election",
        entityId: params.electionId,
        metadata: { txHash, proofHash },
      },
    });
    return created;
  });

  return {
    voteId: vote.id.toString(),
    transactionHash: txHash,
    proofHash,
    electionId: params.electionId,
    candidateId: params.candidateId,
    votedAt: castAt.toISOString(),
  };
}
