import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { createAccountGroupSchema } from "@/lib/validations";
import { withAuthAndTenancy } from "@/lib/hybrid-auth";
export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";


// NOTE: "banks" endpoint now proxies to Account Groups for backward compatibility.
// - Bank => AccountGroup
// - Pocket => Account
// Tenancy: requires X-Household-ID header.

export const GET = withAuthAndTenancy(async (req: Request, userId: string, householdId: string) => {
  const groups = await prisma.accountGroup.findMany({
    where: { householdId },
    include: { accounts: true },
    orderBy: { createdAt: "desc" },
  });

  const visibleAccounts = groups.flatMap((group) =>
    group.accounts.filter(
      (account) =>
        account.scope === "HOUSEHOLD" ||
        (account.scope === "PERSONAL" && account.ownerUserId === userId),
    ),
  );

  const accountIds = visibleAccounts.map((account) => account.id);
  const balances = accountIds.length
    ? await prisma.transaction.groupBy({
        by: ["accountId"],
        _sum: { amount: true },
        where: { accountId: { in: accountIds } },
      })
    : [];

  const balanceMap = new Map(
    balances.map((row) => [row.accountId, row._sum.amount ?? new Prisma.Decimal(0)]),
  );

  const enhanced = groups.map((group) => {
    const accounts = group.accounts
      .filter(
        (account) =>
          account.scope === "HOUSEHOLD" ||
          (account.scope === "PERSONAL" && account.ownerUserId === userId),
      )
      .map((account) => {
        const base = balanceMap.get(account.id) ?? new Prisma.Decimal(0);
        const balance = base.plus(account.startingBalance).toString();
        return { ...account, balance };
      });

    return { ...group, accounts };
  });

  return NextResponse.json(enhanced);
});

export const POST = withAuthAndTenancy(async (req: Request, userId: string, householdId: string) => {
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
    
    return NextResponse.json(group);
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
});

export const OPTIONS = withAuthAndTenancy(async (req: Request, userId: string, householdId: string) => {
  // OPTIONS handler for CORS preflight requests
  const origin = req.headers.get('origin');
  const response = new NextResponse(null, { status: 200 });
  
  // Add CORS headers
  response.headers.set('Access-Control-Allow-Origin', origin || '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Household-ID');
  response.headers.set('Access-Control-Allow-Credentials', 'true');
  
  return response;
});
