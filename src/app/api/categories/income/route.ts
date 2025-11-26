import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuthAndTenancy } from "@/lib/hybrid-auth";
export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";


export const GET = withAuthAndTenancy(async (req: Request, userId: string, _householdId: string) => {
  const incomeCategories = await prisma.category.findMany({
    where: { 
      userId,
      type: "INCOME"
    },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(incomeCategories);
});

export const OPTIONS = withAuthAndTenancy(async (req: Request, userId: string, _householdId: string) => {
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
