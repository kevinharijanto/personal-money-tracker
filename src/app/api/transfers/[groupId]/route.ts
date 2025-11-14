// app/api/transfers/[groupId]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAndTenancy } from "@/lib/tenancy";

// Return both legs of a transfer, plus a small summary
export async function GET(req: Request, { params }: { params: Promise<{ groupId: string }> }) {
  let userId: string, householdId: string;
  try {
    ({ userId, householdId } = await requireAuthAndTenancy(req));
  } catch (res: any) {
    return res;
  }

  const { groupId } = await params;

  // Enforce tenancy via TransferGroup.householdId
  const tg = await prisma.transferGroup.findUnique({ where: { id: groupId } });
  if (!tg || tg.householdId !== householdId) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const txns = await prisma.transaction.findMany({
    where: { transferGroupId: groupId },
    include: { category: true },
    orderBy: { date: "asc" },
  });

  if (!txns.length) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  // Ensure the user can access the involved accounts (HOUSEHOLD or PERSONAL owned by user)
  const accountIds = Array.from(new Set(txns.map((t) => t.accountId).filter(Boolean)));
  if (accountIds.length > 0) {
    const accessible = await prisma.account.findMany({
      where: {
        id: { in: accountIds },
        AND: [
          { group: { householdId } },
          { OR: [{ scope: "HOUSEHOLD" }, { scope: "PERSONAL", ownerUserId: userId }] },
        ],
      },
    });
    if (accessible.length < accountIds.length) {
      return NextResponse.json({ error: "Forbidden: transfer involves inaccessible account(s)" }, { status: 403 });
    }
  }

  // Summarize from/to/amount
  const out = txns.find((t) => t.type === "TRANSFER_OUT");
  const _in = txns.find((t) => t.type === "TRANSFER_IN");

  const fromAccountId = out?.accountId ?? null;
  const toAccountId = _in?.accountId ?? null;

  const summary = {
    groupId,
    // v2 canonical fields
    fromAccountId,
    toAccountId,
    // legacy aliases for backward compatibility
    fromPocketId: fromAccountId,
    toPocketId: toAccountId,
    amount: _in?.amount ?? (out?.amount ? out.amount.neg() : null), // Decimal.neg() for out leg
    categoryId: out?.categoryId ?? _in?.categoryId ?? null,
    date: txns[0]?.date ?? null,
  };

  return NextResponse.json({ summary, legs: txns });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ groupId: string }> }) {
  let userId: string, householdId: string;
  try {
    ({ userId, householdId } = await requireAuthAndTenancy(req));
  } catch (res: any) {
    return res;
  }

  const { groupId } = await params;

  // Enforce tenancy via TransferGroup.householdId
  const tg = await prisma.transferGroup.findUnique({ where: { id: groupId } });
  if (!tg || tg.householdId !== householdId) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  // Ensure user can access the involved accounts before allowing deletion
  const txns = await prisma.transaction.findMany({
    where: { transferGroupId: groupId },
    select: { accountId: true },
  });
  const accountIds = Array.from(new Set(txns.map((t) => t.accountId).filter(Boolean)));
  if (accountIds.length > 0) {
    const accessible = await prisma.account.findMany({
      where: {
        id: { in: accountIds },
        AND: [
          { group: { householdId } },
          { OR: [{ scope: "HOUSEHOLD" }, { scope: "PERSONAL", ownerUserId: userId }] },
        ],
      },
    });
    if (accessible.length < accountIds.length) {
      return NextResponse.json({ error: "Forbidden: transfer involves inaccessible account(s)" }, { status: 403 });
    }
  }

  await prisma.transaction.deleteMany({ where: { transferGroupId: groupId } });
  return NextResponse.json({ ok: true });
}