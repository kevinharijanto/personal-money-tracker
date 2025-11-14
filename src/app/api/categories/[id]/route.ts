import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createCategorySchema } from "@/lib/validations";
import { requireAuthAndTenancy } from "@/lib/tenancy";
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let householdId: string;
  try {
    ({ householdId } = await requireAuthAndTenancy(req));
  } catch (res: any) {
    return res;
  }

  const { id } = await params;
  const category = await prisma.category.findFirst({ where: { id, householdId } });
  if (!category) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(category);
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let householdId: string;
  try {
    ({ householdId } = await requireAuthAndTenancy(req));
  } catch (res: any) {
    return res;
  }

  const { id } = await params;
  const json = await req.json().catch(() => ({}));
  const parsed = createCategorySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.category.findFirst({ where: { id, householdId } });
  if (!existing) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  try {
    const updated = await prisma.category.update({
      where: { id },
      data: { name: parsed.data.name },
    });
    return NextResponse.json(updated);
  } catch (err: any) {
    if (err?.code === "P2002") {
      return NextResponse.json(
        { error: "Category name already exists in this household" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Failed to update category" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let householdId: string;
  try {
    ({ householdId } = await requireAuthAndTenancy(req));
  } catch (res: any) {
    return res;
  }

  const { id } = await params;
  const existing = await prisma.category.findFirst({ where: { id, householdId } });
  if (!existing) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  await prisma.category.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
