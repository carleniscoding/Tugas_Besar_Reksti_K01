import { createThirdwebClient, getContract, prepareContractCall, readContract, sendTransaction } from "thirdweb";
import { defineChain } from "thirdweb/chains";
import { privateKeyToAccount } from "thirdweb/wallets";
import { env } from "../../config/env.js";
import { HttpError } from "../../shared/http.js";

function getVotingContract() {
  if (!env.thirdwebClientId || !env.contractAddress) {
    throw new HttpError(500, "Thirdweb client or contract address is not configured.");
  }
  const client = createThirdwebClient({ clientId: env.thirdwebClientId });
  const chain = defineChain(11155111);
  return {
    client,
    contract: getContract({ client, chain, address: env.contractAddress }),
  };
}

function getAdminAccount(client: ReturnType<typeof createThirdwebClient>) {
  if (!env.adminPrivateKey) throw new HttpError(500, "Admin wallet not configured.");
  return privateKeyToAccount({ client, privateKey: env.adminPrivateKey });
}

export async function castVoteForVoter(params: {
  chainElectionId: bigint;
  chainCandidateId: bigint;
  voterAddress: string;
}) {
  const { client, contract } = getVotingContract();
  const adminAccount = getAdminAccount(client);
  const transaction = prepareContractCall({
    contract,
    method: "function voteFor(uint256 electionId, uint256 candidateId, address voter)",
    params: [params.chainElectionId, params.chainCandidateId, params.voterAddress as `0x${string}`],
  });
  const receipt = await sendTransaction({ transaction, account: adminAccount });
  return receipt.transactionHash;
}

export async function createChainElection(params: {
  name: string;
  description: string;
  startTime: Date;
  endTime: Date;
}) {
  const { client, contract } = getVotingContract();
  const adminAccount = getAdminAccount(client);
  const currentCount = await readContract({ contract, method: "function electionCount() view returns (uint256)", params: [] });
  const transaction = prepareContractCall({
    contract,
    method: "function createElection(string name, string description, uint256 startTime, uint256 endTime) returns (uint256)",
    params: [
      params.name,
      params.description,
      BigInt(Math.floor(params.startTime.getTime() / 1000)),
      BigInt(Math.floor(params.endTime.getTime() / 1000)),
    ],
  });
  const receipt = await sendTransaction({ transaction, account: adminAccount });
  const newCount = await readContract({ contract, method: "function electionCount() view returns (uint256)", params: [] });
  return { transactionHash: receipt.transactionHash, chainElectionId: newCount || BigInt(currentCount) + 1n };
}

export async function addChainCandidate(params: {
  chainElectionId: bigint;
  name: string;
  party: string;
  photoUrl?: string | null;
  expectedChainCandidateId: bigint;
}) {
  const { client, contract } = getVotingContract();
  const adminAccount = getAdminAccount(client);
  const transaction = prepareContractCall({
    contract,
    method: "function addCandidate(uint256 electionId, string name, string party, string imageUrl)",
    params: [params.chainElectionId, params.name, params.party, params.photoUrl || ""],
  });
  const receipt = await sendTransaction({ transaction, account: adminAccount });
  return { transactionHash: receipt.transactionHash, chainCandidateId: params.expectedChainCandidateId };
}
