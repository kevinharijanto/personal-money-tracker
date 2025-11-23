import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import crypto from "crypto";
import type { NextRequest } from "next/server";
import { withAuth } from "@/lib/hybrid-auth";

const inviteSchema = z.object({
  email: z.string().email(),
  householdId: z.string().cuid(),
});

export const POST = withAuth(async (req: Request, userId: string) => {
  const json = await req.json().catch(() => ({}));
  const parsed = inviteSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { email, householdId } = parsed.data;

  // Check if user is a member of household
  const membership = await prisma.membership.findFirst({
    where: {
      userId: userId,
      householdId,
      role: "OWNER",
    },
  });

  if (!membership) {
    return NextResponse.json({ error: "Only household owners can send invitations" }, { status: 403 });
  }

  // Check if user already exists in household
  const existingUser = await prisma.user.findUnique({
    where: { email },
    include: { memberships: true },
  });

  if (existingUser) {
    const alreadyMember = existingUser.memberships.some(m => m.householdId === householdId);
    if (alreadyMember) {
      return NextResponse.json({ error: "User is already a member of this household" }, { status: 409 });
    }
  }

  // Check if there's already a pending invitation
  const existingInvitation = await prisma.invitation.findFirst({
    where: {
      email,
      householdId,
      status: "PENDING",
      expiresAt: { gt: new Date() },
    },
  });

  if (existingInvitation) {
    return NextResponse.json({ error: "Invitation already sent" }, { status: 409 });
  }

  // Create invitation
  const invitationToken = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // Expires in 7 days

  const [invitation, household, invitedBy] = await prisma.$transaction(async (tx) => {
    const invitation = await tx.invitation.create({
      data: {
        email,
        householdId,
        invitedById: userId,
        token: invitationToken,
        expiresAt,
      },
    });

    // Get the household and invitedBy user details within the same transaction
    const [household, invitedBy] = await Promise.all([
      tx.household.findUnique({
        where: { id: householdId },
        select: { name: true },
      }),
      tx.user.findUnique({
        where: { id: userId },
        select: { name: true, email: true },
      }),
    ]);

    return [invitation, household, invitedBy];
  });
  // In-app invitation only: no SMTP email sending
  return NextResponse.json({
    id: invitation.id,
    email: invitation.email,
    household,
    invitedBy,
    status: invitation.status,
    expiresAt: invitation.expiresAt,
  }, { status: 201 });

});

export const GET = withAuth(async (req: Request, userId: string) => {
  const { searchParams } = new URL(req.url);
  const householdId = searchParams.get("householdId");

  if (!householdId) {
    return NextResponse.json({ error: "householdId is required" }, { status: 400 });
  }

  // Check if user is a member of household
  const membership = await prisma.membership.findFirst({
    where: {
      userId,
      householdId,
    },
  });

  if (!membership) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  // Get all invitations for the household
  const invitations = await prisma.invitation.findMany({
    where: { householdId },
    include: {
      invitedBy: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(invitations);
});

export const OPTIONS = withAuth(async (req: Request, userId: string) => {
  // OPTIONS handler for CORS preflight requests
  return new NextResponse(null, { status: 200 });
});