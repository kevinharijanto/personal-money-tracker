import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { updateTxnSchema, createTxnSchemaV2 } from "@/lib/validations";
import { TxnType } from "@prisma/client";
import { withAuthAndTenancy } from "@/lib/hybrid-auth";
export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";


export const GET = withAuthAndTenancy(async (req: Request, userId: string, householdId: string, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const t = await prisma.transaction.findUnique({
    where: { id },
    include: { category: true, account: { include: { group: true } } },
  });
  if (!t) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Enforce tenancy by the transaction's account group household
  if (t.account.group.householdId !== householdId) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  // Enforce account scope access
  if (t.account.scope === "PERSONAL" && t.account.ownerUserId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(t);
});

export const PUT = withAuthAndTenancy(async (req: Request, userId: string, householdId: string, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const json = await req.json().catch(() => ({}));
  
  // Try v2 schema first, then fallback to v1
  const v2 = createTxnSchemaV2.partial().safeParse(json);
  let parsed: any;
  
  if (v2.success) {
    parsed = v2;
  } else {
    parsed = updateTxnSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
  }

  const existing = await prisma.transaction.findUnique({
    where: { id },
    include: { account: { include: { group: true } } },
  });
  if (!existing) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  // Enforce tenancy and scope access on existing transaction account
  if (existing.account.group.householdId !== householdId) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (existing.account.scope === "PERSONAL" && existing.account.ownerUserId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const data: any = {};
  const newType = parsed.data.type ?? (existing.type as TxnType);
  const normalize = (s: string) => s.replace(/^[-+]/, "");
  const isNeg = (t: TxnType) => t === "EXPENSE" || t === "TRANSFER_OUT";

  if (parsed.data.amount !== undefined) {
    const base = normalize(String(parsed.data.amount));
    // Only sign if the existing amount is positive (not already signed)
    const existingIsPositive = !existing.amount.toString().startsWith('-');
    data.amount = (existingIsPositive && isNeg(newType)) ? `-${base}` : base;
  } else if (parsed.data.type !== undefined) {
    const base = normalize(existing.amount.toString());
    // Re-sign the existing amount if type changes
    const existingIsNegative = existing.amount.toString().startsWith('-');
    const newIsNegative = isNeg(parsed.data.type as TxnType);
    
    if (existingIsNegative && !newIsNegative) {
      // Convert from negative to positive
      data.amount = base;
    } else if (!existingIsNegative && newIsNegative) {
      // Convert from positive to negative
      data.amount = `-${base}`;
    } else {
      // Keep existing sign
      data.amount = existing.amount.toString();
    }
  }

  if (parsed.data.type !== undefined) data.type = newType as TxnType;

  // If changing account, validate target account accessibility
  if (parsed.data.accountId !== undefined || (parsed.data as any).pocketId !== undefined) {
    const targetAccountId = (parsed.data.accountId || (parsed.data as any).pocketId) as string;
    const targetAccount = await prisma.account.findFirst({
      where: {
        id: targetAccountId,
        AND: [
          { group: { householdId } },
          { OR: [{ scope: "HOUSEHOLD" }, { scope: "PERSONAL", ownerUserId: userId }] },
        ],
      },
    });
    if (!targetAccount) {
      return NextResponse.json({ error: "Forbidden: no access to target account" }, { status: 403 });
    }
    data.accountId = targetAccountId;
  }

  // If changing category, enforce household tenancy
  if (parsed.data.categoryId !== undefined) {
    const categoryOk = await prisma.category.findFirst({
      where: { id: parsed.data.categoryId, userId },
    });
    if (!categoryOk) {
      return NextResponse.json({ error: "Category not found for this user" }, { status: 400 });
    }
    data.categoryId = parsed.data.categoryId;
  }

  if (parsed.data.description !== undefined) data.description = parsed.data.description;
  if (parsed.data.date !== undefined) data.date = new Date(parsed.data.date);

  const updated = await prisma.transaction.update({
    where: { id },
    data,
  });
  return NextResponse.json(updated);
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

export const DELETE = withAuthAndTenancy(async (req: Request, userId: string, householdId: string, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const existing = await prisma.transaction.findUnique({
    where: { id },
    include: { account: { include: { group: true } } },
  });
  if (!existing) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  if (existing.account.group.householdId !== householdId) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (existing.account.scope === "PERSONAL" && existing.account.ownerUserId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.transaction.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
