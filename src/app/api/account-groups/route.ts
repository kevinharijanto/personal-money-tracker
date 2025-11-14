import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createAccountGroupSchema } from "@/lib/validations";
import { requireAuthAndTenancy } from "@/lib/tenancy";

// NOTE: "banks" endpoint now proxies to Account Groups for backward compatibility.
// - Bank => AccountGroup
// - Pocket => Account
// Tenancy: requires X-Household-ID header.

export async function GET(req: Request) {
  let userId: string, householdId: string;
  try {
    ({ userId, householdId } = await requireAuthAndTenancy(req));
  } catch (res: any) {
    return res;
  }

  const groups = await prisma.accountGroup.findMany({
    where: { householdId },
    include: { accounts: true },
    orderBy: { createdAt: "desc" },
  });

  const filtered = groups.map((g) => ({
    ...g,
    accounts: g.accounts.filter(
      (a) => a.scope === "HOUSEHOLD" || (a.scope === "PERSONAL" && a.ownerUserId === userId)
    ),
  }));

  return NextResponse.json(filtered);
}

export async function POST(req: Request) {
  let householdId: string;
  try {
    ({ householdId } = await requireAuthAndTenancy(req));
  } catch (res: any) {
    return res;
  }

  // Verify the household exists to avoid foreign key violations (P2003)
  const exists = await prisma.household.findUnique({ where: { id: householdId } });
  if (!exists) {
    return NextResponse.json({ error: "Household not found for X-Household-ID" }, { status: 400 });
  }

  const json = await req.json().catch(() => ({}));
  const parsed = createAccountGroupSchema.safeParse({ ...json, householdId });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const group = await prisma.accountGroup.create({
      data: {
        name: parsed.data.name,
        householdId,
        kind: parsed.data.kind || "CASH",
      },
    });

    return NextResponse.json(group, { status: 201 });
  } catch (err: any) {
    if (err?.code === "P2002") {
      return NextResponse.json(
        { error: "Account Group name already exists in this household" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create Account Group", detail: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
