import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { updatePocketSchema, updateAccountSchema } from "@/lib/validations";
import { Prisma } from "@prisma/client";
import { withAuthAndTenancy } from "@/lib/hybrid-auth";
export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";


export const GET = withAuthAndTenancy(async (req: Request, userId: string, householdId: string, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const p = await prisma.account.findFirst({
    where: { id, group: { householdId } },
    include: { group: true },
  });
  if (!p) return NextResponse.json({ error: "not found" }, { status: 404 });

  if (p.scope === "PERSONAL" && p.ownerUserId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sum = await prisma.transaction.aggregate({
    _sum: { amount: true },
    where: { accountId: p.id },
  });
  const base = sum._sum.amount ?? new Prisma.Decimal(0);
  const balance = base.plus(p.startingBalance).toString();

  return NextResponse.json({ ...p, balance });
});

export const PUT = withAuthAndTenancy(async (req: Request, userId: string, householdId: string, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const json = await req.json().catch(() => ({}));
  
  // Try v2 schema first, then fallback to v1
  const v2 = updateAccountSchema.safeParse(json);
  let parsed: any;
  
  if (v2.success) {
    parsed = v2;
    
    // Validate group belongs to household
    if (parsed.data.groupId !== undefined) {
      const targetGroup = await prisma.accountGroup.findFirst({
        where: { id: parsed.data.groupId, householdId },
      });
      if (!targetGroup) {
        return NextResponse.json(
          { error: "Target Account Group not in this household" },
          { status: 400 }
        );
      }
    }
  } else {
    parsed = updatePocketSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    
    // Validate group belongs to household for v1
    if (parsed.data.bankId !== undefined) {
      const targetGroup = await prisma.accountGroup.findFirst({
        where: { id: parsed.data.bankId, householdId },
      });
      if (!targetGroup) {
        return NextResponse.json(
          { error: "Target Account Group not in this household" },
          { status: 400 }
        );
      }
    }
  }

  const existing = await prisma.account.findFirst({
    where: { id, group: { householdId } },
    include: { group: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (existing.scope === "PERSONAL" && existing.ownerUserId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Build update data based on schema version
  let updateData: any = {};
  
  if (v2.success) {
    // V2 schema
    if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
    if (parsed.data.groupId !== undefined) updateData.groupId = parsed.data.groupId;
    if (parsed.data.currency !== undefined) updateData.currency = parsed.data.currency;
    if (parsed.data.startingBalance !== undefined) updateData.startingBalance = parsed.data.startingBalance;
    if (parsed.data.isArchived !== undefined) updateData.isArchived = parsed.data.isArchived;
    if (parsed.data.scope !== undefined) {
      // If changing from HOUSEHOLD to PERSONAL, ensure user is the original creator of the account
      if (existing.scope === "HOUSEHOLD" && parsed.data.scope === "PERSONAL") {
        // Check if user is the original creator of the account using raw query
        const result = await prisma.$queryRaw`SELECT createdById FROM Account WHERE id = ${id}`;
        const accountWithCreator = result as { createdById: string }[];
        
        if (!accountWithCreator.length || accountWithCreator[0].createdById !== userId) {
          return NextResponse.json(
            { error: "Forbidden: only the original creator of an account can change its scope from HOUSEHOLD to PERSONAL" },
            { status: 403 }
          );
        }
      }
      
      updateData.scope = parsed.data.scope;
      updateData.ownerUserId = parsed.data.scope === "PERSONAL" ? userId : null;
    }
  } else {
    // V1 schema (legacy)
    if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
    if (parsed.data.bankId !== undefined) updateData.groupId = parsed.data.bankId;
  }

  const updated = await prisma.account.update({
    where: { id },
    data: updateData,
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
  const existing = await prisma.account.findFirst({
    where: { id, group: { householdId } },
    include: { group: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  if (existing.scope === "PERSONAL") {
    if (existing.ownerUserId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else {
    // Require OWNER role to delete household-scoped accounts
    const member = await prisma.membership.findUnique({
      where: { userId_householdId: { userId, householdId } },
    });
    if (!member || member.role !== "OWNER") {
      return NextResponse.json(
        { error: "Forbidden: only household OWNER can delete household accounts" },
        { status: 403 }
      );
    }
  }

  await prisma.account.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
