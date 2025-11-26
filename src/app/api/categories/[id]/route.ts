import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createCategorySchema } from "@/lib/validations";
import { withAuthAndTenancy } from "@/lib/hybrid-auth";
export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";


export const GET = withAuthAndTenancy(async (req: Request, userId: string, _householdId: string, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const category = await prisma.category.findFirst({ where: { id, userId } });
  if (!category) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(category);
});

export const PUT = withAuthAndTenancy(async (req: Request, userId: string, _householdId: string, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const json = await req.json().catch(() => ({}));
  const parsed = createCategorySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.category.findFirst({ where: { id, userId } });
  if (!existing) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  try {
    const updated = await prisma.category.update({
      where: { id },
      data: {
        name: parsed.data.name,
        ...(parsed.data.type !== undefined && { type: parsed.data.type })
      },
    });
    return NextResponse.json(updated);
  } catch (err: any) {
    if (err?.code === "P2002") {
      return NextResponse.json(
        { error: "Category name already exists for this user" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Failed to update category" }, { status: 500 });
  }
});

export const DELETE = withAuthAndTenancy(async (req: Request, userId: string, _householdId: string, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const existing = await prisma.category.findFirst({ where: { id, userId } });
  if (!existing) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  await prisma.category.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});

export const OPTIONS = withAuthAndTenancy(async (req: Request, userId: string, _householdId: string, { params }: { params: Promise<{ id: string }> }) => {
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
