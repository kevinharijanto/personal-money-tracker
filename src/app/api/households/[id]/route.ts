import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { withAuth } from "@/lib/hybrid-auth";
export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";


const updateHouseholdSchema = z.object({
  name: z.string().min(1).max(100),
});

export const GET = withAuth(async (req: Request, userId: string, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  
  const household = await prisma.household.findFirst({
    where: {
      id: id,
      memberships: { some: { userId } }
    },
    include: {
      memberships: {
        include: {
          user: {
            select: { id: true, email: true, name: true }
          }
        }
      }
    }
  });

  if (!household) {
    return NextResponse.json({ error: "Household not found" }, { status: 404 });
  }

  return NextResponse.json(household);
});

export const PUT = withAuth(async (req: Request, userId: string, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  
  // Check if user is an owner of this household
  const membership = await prisma.membership.findFirst({
    where: {
      userId,
      householdId: id,
      role: "OWNER",
    },
  });

  if (!membership) {
    return NextResponse.json({ error: "Only household owners can update household details" }, { status: 403 });
  }

  const json = await req.json().catch(() => ({}));
  const parsed = updateHouseholdSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const household = await prisma.household.update({
    where: { id: id },
    data: { name: parsed.data.name },
  });

  return NextResponse.json(household);
});

export const OPTIONS = withAuth(async (req: Request, userId: string, { params }: { params: Promise<{ id: string }> }) => {
  // OPTIONS handler for CORS preflight requests
  return new NextResponse(null, { status: 200 });
});
