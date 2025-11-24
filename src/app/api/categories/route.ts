import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createCategorySchema } from "@/lib/validations";
import { withAuthAndTenancy } from "@/lib/hybrid-auth";
export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";


export const GET = withAuthAndTenancy(async (req: Request, userId: string, householdId: string) => {
  const url = new URL(req.url);
  const type = url.searchParams.get("type") as "INCOME" | "EXPENSE" | null;
  
  const where: any = { householdId };
  if (type) where.type = type;
  
  const categories = await prisma.category.findMany({
    where,
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });
  return NextResponse.json(categories);
});

export const POST = withAuthAndTenancy(async (req: Request, userId: string, householdId: string) => {
  const json = await req.json().catch(() => ({}));
  const parsed = createCategorySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const category = await prisma.category.create({
      data: {
        name: parsed.data.name,
        type: parsed.data.type,
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
