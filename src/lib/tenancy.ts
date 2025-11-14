import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";

/**
 * Extract X-Household-ID header from the request.
 * Throws a 400 NextResponse if missing.
 */
export function extractHouseholdId(req: Request): string {
  const householdId = req.headers.get("x-household-id");
  if (!householdId) {
    throw NextResponse.json({ error: "X-Household-ID header is required" }, { status: 400 });
  }
  return householdId;
}

/**
 * Require an authenticated NextAuth session and return the current user id.
 * Throws 401 if no session.
 */
export async function requireSession(): Promise<{ userId: string }> {
  const session = await getServerSession(authOptions);
  const uid = (session?.user as any)?.id as string | undefined;
  if (!uid) {
    throw NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return { userId: uid };
}

/**
 * Assert the current user is a member of the given household.
 * Throws 403 if not a member. Returns the membership row if present.
 */
export async function assertMembership(userId: string, householdId: string) {
  const membership = await prisma.membership.findFirst({
    where: { userId, householdId },
  });
  if (!membership) {
    throw NextResponse.json({ error: "Forbidden: not a household member" }, { status: 403 });
  }
  return membership;
}

/**
 * Assert the user can access the given account:
 * - Account.group.householdId must match the provided householdId
 * - If account.scope === PERSONAL, ownerUserId must equal the current user
 * Throws 404 if account not found, 403 if forbidden.
 * Returns the account row if allowed.
 */
export async function assertAccountAccess(userId: string, householdId: string, accountId: string) {
  const account = await prisma.account.findUnique({
    where: { id: accountId },
    include: { group: true },
  });
  if (!account || account.group.householdId !== householdId) {
    throw NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (account.scope === "PERSONAL" && account.ownerUserId !== userId) {
    throw NextResponse.json({ error: "Forbidden: personal account" }, { status: 403 });
  }
  return account;
}

/**
 * Convenience guard to require session + household membership together.
 * Returns { userId, householdId } if allowed.
 */
export async function requireAuthAndTenancy(req: Request): Promise<{ userId: string; householdId: string }> {
  const householdId = extractHouseholdId(req);
  const { userId } = await requireSession();
  await assertMembership(userId, householdId);
  return { userId, householdId };
}