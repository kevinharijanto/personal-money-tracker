// app/api/transfers/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { transferSchemaV2 } from "@/lib/validations";
import { TxnType, Prisma } from "@prisma/client";
import { withAuthAndTenancy } from "@/lib/hybrid-auth";
export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";


async function getOrCreateTransferCategory(householdId: string) {
  const name = "Transfer";
  const type = "EXPENSE"; // Transfers are typically categorized as expenses
  const found = await prisma.category.findFirst({
    where: { householdId, name, type },
  });
  if (found) return found;
  return prisma.category.create({
    data: {
      name,
      type,
      householdId,
    } as any,
  });
}

export const POST = withAuthAndTenancy(async (req: Request, userId: string, householdId: string) => {
  const json = await req.json().catch(() => ({}));
  const parsed = transferSchemaV2.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { fromAccountId, toAccountId, amount, description, date, mustBeSameGroup, categoryId } =
    parsed.data;

  if (fromAccountId === toAccountId) {
    return NextResponse.json({ error: "fromAccountId and toAccountId must differ" }, { status: 400 });
  }

  const [fromAccount, toAccount] = await Promise.all([
    prisma.account.findFirst({
      where: {
        id: fromAccountId,
        AND: [
          { group: { householdId } },
          { OR: [{ scope: "HOUSEHOLD" }, { scope: "PERSONAL", ownerUserId: userId }] },
        ],
      },
      include: { group: true },
    }),
    prisma.account.findFirst({
      where: {
        id: toAccountId,
        AND: [
          { group: { householdId } },
          { OR: [{ scope: "HOUSEHOLD" }, { scope: "PERSONAL", ownerUserId: userId }] },
        ],
      },
      include: { group: true },
    }),
  ]);

  if (!fromAccount || !toAccount) {
    return NextResponse.json(
      { error: "Invalid or inaccessible account(s) for this household" },
      { status: 403 }
    );
  }

  if (mustBeSameGroup && fromAccount.groupId !== toAccount.groupId) {
    return NextResponse.json({ error: "Accounts must belong to the same group" }, { status: 400 });
  }

  // get a category (use caller-provided or ensure "Transfer" exists) within this household
  const cat =
    categoryId
      ? await prisma.category.findFirst({ where: { id: categoryId, householdId } })
      : await getOrCreateTransferCategory(householdId);
  if (!cat) {
    return NextResponse.json({ error: "Invalid categoryId for this household" }, { status: 400 });
  }

  const when = date ? new Date(date) : undefined;

  const result = await prisma.$transaction(async (tx) => {
    // Create a TransferGroup to bind the two legs
    const tg = await (tx as any).transferGroup.create({
      data: {
        householdId,
      },
    });

    const outTxn = await tx.transaction.create({
      data: {
        amount: `-${String(amount)}`, // negative
        type: TxnType.TRANSFER_OUT,
        description,
        accountId: fromAccountId,
        categoryId: cat.id,
        transferGroupId: tg.id,
        ...(when ? { date: when } : {}),
      } as any,
    });

    const inTxn = await tx.transaction.create({
      data: {
        amount: `${String(amount)}`, // positive
        type: TxnType.TRANSFER_IN,
        description,
        accountId: toAccountId,
        categoryId: cat.id,
        transferGroupId: tg.id,
        ...(when ? { date: when } : {}),
      } as any,
    });

    return { transferGroupId: tg.id, outTxn, inTxn };
  });

  return NextResponse.json(result, { status: 201 });
});

export const OPTIONS = withAuthAndTenancy(async (req: Request, userId: string, householdId: string) => {
  // OPTIONS handler for CORS preflight requests
  return new NextResponse(null, { status: 200 });
});