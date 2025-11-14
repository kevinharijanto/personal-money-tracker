import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { upsertPocketSchema, upsertAccountSchema } from "@/lib/validations";
import { requireAuthAndTenancy } from "@/lib/tenancy";

// NOTE: "pockets" endpoint now proxies to Accounts for backward compatibility.
// - Pocket => Account
// - Bank   => AccountGroup
// Tenancy: requires X-Household-ID header.

export async function GET(req: Request) {
  let userId: string, householdId: string;
  try {
    ({ userId, householdId } = await requireAuthAndTenancy(req));
  } catch (res: any) {
    return res;
  }

  const accounts = await prisma.account.findMany({
    where: { group: { householdId } },
    include: { group: true },
    orderBy: { createdAt: "desc" },
  });

  // filter to accounts the user can access
  const visible = accounts.filter(
    (a) => a.scope === "HOUSEHOLD" || (a.scope === "PERSONAL" && a.ownerUserId === userId)
  );

  // derive balances (sum of amounts) + startingBalance
  const results: any[] = [];
  for (const a of visible) {
    const sum = await prisma.transaction.aggregate({
      _sum: { amount: true },
      where: { accountId: a.id },
    });
    const base = sum._sum.amount ?? new Prisma.Decimal(0);
    const balance = base.plus(a.startingBalance).toString();
    results.push({ ...a, balance });
  }

  return NextResponse.json(results);
}

export async function POST(req: Request) {
  let userId: string, householdId: string;
  try {
    ({ userId, householdId } = await requireAuthAndTenancy(req));
  } catch (res: any) {
    return res;
  }

  const json = await req.json().catch(() => ({}));

  // Prefer v2 account shape; fallback to legacy pocket shape
  const v2 = upsertAccountSchema.safeParse(json);
  if (v2.success) {
    // Validate group belongs to household
    const group = await prisma.accountGroup.findFirst({
      where: { id: v2.data.groupId, householdId },
    });
    if (!group) {
      return NextResponse.json({ error: "AccountGroup not found in this household" }, { status: 400 });
    }

    const scope = v2.data.scope ?? "HOUSEHOLD";
    const ownerUserId = scope === "PERSONAL" ? userId : null;

    const account = await prisma.account.create({
      data: {
        name: v2.data.name,
        groupId: v2.data.groupId,
        currency: v2.data.currency ?? "IDR",
        startingBalance: v2.data.startingBalance ?? "0",
        isArchived: v2.data.isArchived ?? false,
        scope,
        ownerUserId,
        createdById: userId, // Track who created the account
      },
    });
    return NextResponse.json(account, { status: 201 });
  }

  // Legacy: { name, bankId }
  const v1 = upsertPocketSchema.safeParse(json);
  if (!v1.success) {
    return NextResponse.json({ error: { v2: v2.error?.flatten?.(), v1: v1.error.flatten() } }, { status: 400 });
  }

  // Validate legacy bankId as AccountGroup in the same household
  const group = await prisma.accountGroup.findFirst({
    where: { id: v1.data.bankId, householdId },
  });
  if (!group) {
    return NextResponse.json({ error: "AccountGroup (legacy bankId) not found in this household" }, { status: 400 });
  }

  const account = await prisma.account.create({
    data: {
      name: v1.data.name,
      groupId: v1.data.bankId,
      currency: "IDR",
      startingBalance: "0",
      isArchived: false,
      scope: "HOUSEHOLD",
      ownerUserId: null,
      createdById: userId, // Track who created the account
    },
  });
  return NextResponse.json(account, { status: 201 });
}
