import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";
import { withAuth } from "@/lib/hybrid-auth";
import { addCorsHeaders } from "@/lib/cors";

const acceptInvitationSchema = z.object({
  token: z.string().min(1),
});

// Handle preflight
export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get("origin");
  const res = new NextResponse(null, { status: 200 });
  return addCorsHeaders(res, origin);
}

export const POST = withAuth(async (req: Request, userId: string) => {
  const json = await req.json().catch(() => ({}));
  const parsed = acceptInvitationSchema.safeParse(json);
  if (!parsed.success) {
    const res = NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    return addCorsHeaders(res, req.headers.get('origin'));
  }

  const { token: invitationToken } = parsed.data;

  // Find invitation
  const invitation = await prisma.invitation.findUnique({
    where: { token: invitationToken },
    include: {
      household: true,
    },
  });

  if (!invitation) {
    const res = NextResponse.json({ error: "Invalid invitation token" }, { status: 404 });
    return addCorsHeaders(res, req.headers.get('origin'));
  }

  // Check if invitation is still valid
  if (invitation.status !== "PENDING" || invitation.expiresAt < new Date()) {
    const res = NextResponse.json({ error: "Invitation has expired or been used" }, { status: 400 });
    return addCorsHeaders(res, req.headers.get('origin'));
  }

  // Get current user
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    const res = NextResponse.json({ error: "User not found" }, { status: 404 });
    return addCorsHeaders(res, req.headers.get('origin'));
  }

  // Check if invitation email matches user's email
  if (invitation.email.toLowerCase() !== user.email.toLowerCase()) {
    const res = NextResponse.json({ error: "This invitation is not for your email address" }, { status: 403 });
    return addCorsHeaders(res, req.headers.get('origin'));
  }

  // Check if user is already a member of household
  const existingMembership = await prisma.membership.findFirst({
    where: {
      userId: userId,
      householdId: invitation.householdId,
    },
  });

  if (existingMembership) {
    const res = NextResponse.json({ error: "You are already a member of this household" }, { status: 409 });
    return addCorsHeaders(res, req.headers.get('origin'));
  }

  // Create membership and update invitation status in a transaction
  const result = await prisma.$transaction(async (tx) => {
    // Create membership
    const membership = await tx.membership.create({
      data: {
        userId: userId,
        householdId: invitation.householdId,
        role: "MEMBER",
      },
      include: {
        household: true,
        user: { select: { name: true, email: true } },
      },
    });

    // Update invitation status
    await tx.invitation.update({
      where: { id: invitation.id },
      data: { status: "ACCEPTED" },
    });

    return membership;
  });

  const res = NextResponse.json({
    message: "Successfully joined household",
    household: result.household,
    membership: {
      role: result.role,
      createdAt: result.createdAt,
    },
  });
  return addCorsHeaders(res, req.headers.get('origin'));
});

export async function GET(req: NextRequest) {
  const origin = req.headers.get("origin");
  
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");

    if (!token) {
      const res = NextResponse.json({ error: "Token is required" }, { status: 400 });
      return addCorsHeaders(res, origin);
    }

    // Find invitation
    const invitation = await prisma.invitation.findUnique({
      where: { token },
      include: {
        household: { select: { name: true } },
        invitedBy: { select: { name: true, email: true } },
      },
    });

    if (!invitation) {
      const res = NextResponse.json({ error: "Invalid invitation token" }, { status: 404 });
      return addCorsHeaders(res, origin);
    }

    // Check if invitation is still valid
    if (invitation.status !== "PENDING" || invitation.expiresAt < new Date()) {
      const res = NextResponse.json({ 
        error: "Invitation has expired or been used",
        status: invitation.status,
        expired: invitation.expiresAt < new Date()
      }, { status: 400 });
      return addCorsHeaders(res, origin);
    }

    const res = NextResponse.json({
      email: invitation.email,
      household: invitation.household,
      invitedBy: invitation.invitedBy,
      expiresAt: invitation.expiresAt,
    });
    return addCorsHeaders(res, origin);

  } catch (error) {
    console.error("Error fetching invitation:", error);
    const res = NextResponse.json({ error: "Internal server error" }, { status: 500 });
    return addCorsHeaders(res, origin);
  }
}