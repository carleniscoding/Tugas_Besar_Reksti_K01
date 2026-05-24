import { prisma } from "../../shared/prisma.js";

export function getElectionById(id: string) {
  return prisma.election.findUnique({
    where: { id: BigInt(id) },
    include: {
      candidates: { orderBy: { orderIndex: "asc" } },
      creator: { include: { penduduk: true } },
    },
  });
}

export function getAllElections(includeDeleted = false) {
  return prisma.election.findMany({
    where: includeDeleted ? {} : { deletedAt: null },
    include: {
      candidates: { orderBy: { orderIndex: "asc" } },
      creator: { include: { penduduk: true } },
      _count: { select: { votes: true } },
    },
    orderBy: { startTime: "desc" },
  });
}

export async function getElectionsForUser(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { penduduk: true } });
  if (!user?.penduduk) throw new Error("User or citizen data not found");
  return prisma.election.findMany({
    where: {
      deletedAt: null,
      OR: [
        { level: "NASIONAL" },
        { level: "PROVINSI", province: user.penduduk.provinsi },
        { level: "KOTA", city: user.penduduk.kabKota, province: user.penduduk.provinsi },
      ],
    },
    include: { candidates: { orderBy: { orderIndex: "asc" } } },
    orderBy: { startTime: "desc" },
  });
}

export async function getVoteCounts(electionId: string) {
  const votes = await prisma.vote.groupBy({
    by: ["candidateId"],
    where: { electionId: BigInt(electionId) },
    _count: { candidateId: true },
  });
  const voteCounts: Record<string, number> = {};
  let totalVotes = 0;
  votes.forEach((vote) => {
    voteCounts[vote.candidateId.toString()] = vote._count.candidateId;
    totalVotes += vote._count.candidateId;
  });
  return { voteCounts, totalVotes };
}
