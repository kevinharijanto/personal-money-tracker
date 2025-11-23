import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createTxnSchema, createTxnSchemaV2 } from "@/lib/validations";
import { TxnType } from "@prisma/client";
import { withAuthAndTenancy } from "@/lib/hybrid-auth";

/**
 * Transactions API (v2-ready)
 * - Schema refactor replaced Pocket -> Account.
 * - Backward compatible: supports pocketId in query and body by mapping to accountId.
 */
export const GET = withAuthAndTenancy(async (req: Request, userId: string, householdId: string) => {

  const url = new URL(req.url);
  const sp = url.searchParams;

  // Support both new and legacy query params
  const accountId = sp.get("accountId") || sp.get("pocketId") || undefined;
  const categoryId = sp.get("categoryId") || undefined;
  const typeParam = (sp.get("type") as TxnType | null) || null;
  const dateFrom = sp.get("dateFrom");
  const dateTo = sp.get("dateTo");
  const q = sp.get("q");

  const where: any = {
    // Enforce tenancy and per-account access (HOUSEHOLD or PERSONAL owned by user)
    account: {
      AND: [
        { group: { householdId } },
        { OR: [{ scope: "HOUSEHOLD" }, { scope: "PERSONAL", ownerUserId: userId }] },
      ],
    },
  };
  if (accountId) where.accountId = accountId;
  if (categoryId) where.categoryId = categoryId;
  if (typeParam) where.type = typeParam;
  if (dateFrom || dateTo) {
    where.date = {};
    if (dateFrom) where.date.gte = new Date(dateFrom);
    if (dateTo) where.date.lte = new Date(dateTo);
  }
  if (q) {
    where.description = { contains: q, mode: "insensitive" };
  }

  // If a specific account is requested, ensure it's accessible; otherwise 403
  if (accountId) {
    const accessibleAccount = await prisma.account.findFirst({
      where: {
        id: accountId,
        AND: [
          { group: { householdId } },
          { OR: [{ scope: "HOUSEHOLD" }, { scope: "PERSONAL", ownerUserId: userId }] },
        ],
      },
    });
    if (!accessibleAccount) {
      return NextResponse.json({ error: "Forbidden: no access to account" }, { status: 403 });
    }
  }

  const txns = await prisma.transaction.findMany({
    where,
    include: { account: true, category: true },
    orderBy: { date: "desc" },
  });
  return NextResponse.json(txns);
});


export const POST = withAuthAndTenancy(async (req: Request, userId: string, householdId: string) => {

  const json = await req.json().catch(() => ({}));

  // Prefer V2 shape if valid, else fallback to legacy v1
  const tryV2 = createTxnSchemaV2.safeParse(json);
  let payload:
    | {
        amount: string;
        type: TxnType | string;
        accountId: string;
        categoryId: string;
        description?: string;
        date?: string;
      }
    | null = null;

  if (tryV2.success) {
    const d = tryV2.data;
    payload = {
      amount: d.amount,
      type: d.type,
      accountId: d.accountId,
      categoryId: d.categoryId,
      description: d.description,
      date: d.date,
    };
  } else {
    const tryV1 = createTxnSchema.safeParse(json);
    if (!tryV1.success) {
      return NextResponse.json(
        { error: { v2: tryV2.error.flatten(), v1: tryV1.error.flatten() } },
        { status: 400 }
      );
    }
    const d = tryV1.data;
    payload = {
      amount: d.amount,
      type: d.type,
      accountId: d.pocketId, // map legacy pocketId -> accountId
      categoryId: d.categoryId,
      description: d.description,
      date: d.date,
    };
  }

  const { amount, type, accountId, categoryId, description, date } = payload!;

  // Validate account exists within the requesting household and is accessible
  const account = await prisma.account.findFirst({
    where: {
      id: accountId,
      AND: [
        { group: { householdId } },
        { OR: [{ scope: "HOUSEHOLD" }, { scope: "PERSONAL", ownerUserId: userId }] },
      ],
    },
    include: { group: true },
  });
  if (!account) {
    return NextResponse.json(
      { error: "Account not found or not accessible in this household" },
      { status: 400 }
    );
  }

  // Validate category belongs to this household
  const category = await prisma.category.findFirst({
    where: { id: categoryId, householdId },
  });
  if (!category) {
    return NextResponse.json({ error: "Category not found in this household" }, { status: 400 });
  }

  // Validate category type matches transaction type
  if (type === "INCOME" && (category as any).type !== "INCOME") {
    return NextResponse.json({ error: "Income transactions must use an INCOME category" }, { status: 400 });
  }
  if ((type === "EXPENSE" || type === "TRANSFER_OUT") && (category as any).type !== "EXPENSE") {
    return NextResponse.json({ error: "Expense transactions must use an EXPENSE category" }, { status: 400 });
  }

  // sign at write-time
  const isNegative = type === "EXPENSE" || type === "TRANSFER_OUT";
  const signed = isNegative ? `-${amount}` : amount;

  const txn = await prisma.transaction.create({
    data: {
      amount: signed,
      type: type as TxnType,
      accountId,
      categoryId,
      description,
      ...(date ? { date: new Date(date) } : {}),
    },
  });

  return NextResponse.json(txn, { status: 201 });
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
