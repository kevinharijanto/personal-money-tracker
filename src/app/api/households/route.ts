import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createHouseholdSchema } from "@/lib/validations";
import { requireSession } from "@/lib/tenancy";
export async function GET(req: Request) {
  // Require an authenticated session; list only households where the user is a member
  let userId: string;
  try {
    ({ userId } = await requireSession());
  } catch (res: any) {
    return res;
  }

  const households = await prisma.household.findMany({
    where: { memberships: { some: { userId } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(households);
}

export async function POST(req: Request) {
  // Create a household and add the current user as OWNER
  let userId: string;
  try {
    ({ userId } = await requireSession());
  } catch (res: any) {
    return res;
  }

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
}