import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashWithPepper } from "@/lib/security";
import { z } from "zod";
import { authenticate, handleError } from "@/lib/auth";

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(100),
  name: z.string().optional(),
  householdName: z.string().min(1).max(100),
});

/**
 * List users for inviting:
 * - Requires authentication
 * - Optional query param ?excludeHouseholdId={cuid}
 *   Returns users who are NOT already members of that household
 * - Excludes the current user from the results
 */
export async function GET(req: NextRequest) {
  try {
    const userId = await authenticate(req);

    const { searchParams } = new URL(req.url);
    const excludeHouseholdId = searchParams.get("excludeHouseholdId");

    const users = await prisma.user.findMany({
      where: {
        AND: [
          { id: { not: userId } },
          excludeHouseholdId
            ? { memberships: { none: { householdId: excludeHouseholdId } } }
            : {},
        ],
      },
      select: { id: true, email: true, name: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json(users);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Sign up a new user and bootstrap their first household.
 * Simplified: no email verification, no SMTP.
 */
export async function POST(req: Request) {
  const json = await req.json().catch(() => ({}));
  const parsed = signupSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { email, password, name, householdName } = parsed.data;

  // Check if user already exists
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "User already exists" }, { status: 409 });
  }


  // ... [rest of code remains the same] ...

  // Hash password and create user with household
  const passwordHash = await hashWithPepper(password);

  const user = await prisma.$transaction(async (tx) => {
    // Create the user
    const createdUser = await tx.user.create({
      data: {
        email: email.toLowerCase(),
        name: name ?? null,
        passwordHash,
      },
      select: { id: true, email: true, name: true, createdAt: true },
    });

    // Create the household
    const household = await tx.household.create({
      data: { name: householdName },
    });

    // Create membership with OWNER role
    await tx.membership.create({
      data: {
        userId: createdUser.id,
        householdId: household.id,
        role: "OWNER",
      },
    });

    return createdUser;
  });

  return NextResponse.json(user, { status: 201 });
}