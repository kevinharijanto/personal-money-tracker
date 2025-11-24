import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { createAccountGroupSchema } from "@/lib/validations";
import { withAuthAndTenancy } from "@/lib/hybrid-auth";
export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";


export const GET = withAuthAndTenancy(async (req: Request, userId: string, householdId: string, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const group = await prisma.accountGroup.findUnique({
    where: { id },
    include: { accounts: true },
  });
  if (!group || group.householdId !== householdId) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  // Filter accounts the user can access and calculate balances
  const visibleAccounts = group.accounts.filter(
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

  return NextResponse.json({
    ...group,
    accounts: accountsWithBalance,
  });
});

export const OPTIONS = withAuthAndTenancy(async (req: Request, userId: string, householdId: string, { params }: { params: Promise<{ id: string }> }) => {
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

export const PUT = withAuthAndTenancy(async (req: Request, userId: string, householdId: string, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const existing = await prisma.accountGroup.findUnique({ where: { id } });
  if (!existing || existing.householdId !== householdId) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const json = await req.json().catch(() => ({}));
  const parsed = createAccountGroupSchema.safeParse({ ...json, householdId });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const updated = await prisma.accountGroup.update({
    where: { id },
    data: {
      name: parsed.data.name,
      ...(parsed.data.kind && { kind: parsed.data.kind })
    },
  });
  return NextResponse.json(updated);
});

export const DELETE = withAuthAndTenancy(async (req: Request, userId: string, householdId: string, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const existing = await prisma.accountGroup.findUnique({ where: { id } });
  if (!existing || existing.householdId !== householdId) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  await prisma.accountGroup.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
