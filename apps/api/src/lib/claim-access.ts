import { HttpError } from "./http-error.js";
import { prisma } from "./prisma.js";

type ClaimAccessRecord = {
  id: string;
  createdById: string;
  issuerId: string | null;
  parties: Array<{ userId: string | null }>;
};

function isCreatorOrIssuer(claim: ClaimAccessRecord, actorUserId: string): boolean {
  return claim.createdById === actorUserId || claim.issuerId === actorUserId;
}

function isClaimParticipant(claim: ClaimAccessRecord, actorUserId: string): boolean {
  return claim.parties.some((party) => party.userId === actorUserId);
}

async function getClaimAccessRecord(claimId: string): Promise<ClaimAccessRecord> {
  const claim = await prisma.claim.findUnique({
    where: { id: claimId },
    select: {
      id: true,
      createdById: true,
      issuerId: true,
      parties: {
        select: {
          userId: true
        }
      }
    }
  });

  if (!claim) {
    throw new HttpError("Claim not found", 404);
  }

  return claim;
}

export async function assertCanManageClaim(claimId: string, actorUserId: string): Promise<void> {
  const claim = await getClaimAccessRecord(claimId);

  if (!isCreatorOrIssuer(claim, actorUserId)) {
    throw new HttpError("You are not allowed to manage this claim", 403);
  }
}

export async function assertCanActOnClaim(claimId: string, actorUserId: string): Promise<void> {
  const claim = await getClaimAccessRecord(claimId);

  if (!isCreatorOrIssuer(claim, actorUserId) && !isClaimParticipant(claim, actorUserId)) {
    throw new HttpError("You are not allowed to act on this claim", 403);
  }
}
