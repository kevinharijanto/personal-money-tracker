import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createHouseholdSchema } from "@/lib/validations";
import { withAuth, handleAuthError } from "@/lib/hybrid-auth";
export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";


export const GET = withAuth(async (req: Request, userId: string) => {
  const households = await prisma.household.findMany({
    where: { memberships: { some: { userId } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(households);
});

export const POST = withAuth(async (req: Request, userId: string) => {
  const json = await req.json().catch(() => ({}));
  const parsed = createHouseholdSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const result = await prisma.$transaction(async (tx) => {
    const h = await tx.household.create({
      data: { name: parsed.data.name },
    });
    await tx.membership.create({
      data: { userId, householdId: h.id, role: "OWNER" },
    });
    return h;
  });

  return NextResponse.json(result, { status: 201 });
});

export const OPTIONS = withAuth(async (req: Request, userId: string) => {
  // OPTIONS handler for CORS preflight requests
  return new NextResponse(null, { status: 200 });
});
