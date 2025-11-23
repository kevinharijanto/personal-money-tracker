import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { createAccountGroupSchema } from "@/lib/validations";
import { withAuthAndTenancy } from "@/lib/hybrid-auth";

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

  // Filter accounts the user can access and calculate balances
  const filtered = await Promise.all(groups.map(async (g) => {
    // Filter accounts based on scope
    const visibleAccounts = g.accounts.filter(
      (a) => a.scope === "HOUSEHOLD" || (a.scope === "PERSONAL" && a.ownerUserId === userId)
    );

    // Calculate balance for each account
    const accountsWithBalance = await Promise.all(visibleAccounts.map(async (a) => {
      const sum = await prisma.transaction.aggregate({
        _sum: { amount: true },
        where: { accountId: a.id },
      });
      const base = sum._sum.amount ?? new Prisma.Decimal(0);
      const balance = base.plus(a.startingBalance).toString();
      
      return { ...a, balance };
    }));

    return {
      ...g,
      accounts: accountsWithBalance,
    };
  }));

  return NextResponse.json(filtered);
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
