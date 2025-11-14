import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createCategorySchema } from "@/lib/validations";
import { requireAuthAndTenancy } from "@/lib/tenancy";

export async function GET(req: Request) {
  let householdId: string;
  try {
    ({ householdId } = await requireAuthAndTenancy(req));
  } catch (res: any) {
    return res;
  }

  const categories = await prisma.category.findMany({
    where: { householdId },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(categories);
}

export async function POST(req: Request) {
  let householdId: string;
  try {
    ({ householdId } = await requireAuthAndTenancy(req));
  } catch (res: any) {
    return res;
  }

  const json = await req.json().catch(() => ({}));
  const parsed = createCategorySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const category = await prisma.category.create({
      data: {
        name: parsed.data.name,
        householdId,
      },
    });
    return NextResponse.json(category, { status: 201 });
  } catch (err: any) {
    if (err?.code === "P2002") {
      return NextResponse.json(
        { error: "Category name already exists in this household" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Failed to create category" }, { status: 500 });
  }
}
