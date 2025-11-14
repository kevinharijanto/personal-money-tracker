import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createAccountGroupSchema } from "@/lib/validations";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const householdId = req.headers.get("x-household-id");
  if (!householdId) {
    return NextResponse.json({ error: "X-Household-ID header is required" }, { status: 400 });
  }

  const { id } = await params;
  const group = await (prisma as any).accountGroup.findUnique({
    where: { id },
    include: { accounts: true },
  });
  if (!group || group.householdId !== householdId) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json(group);
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const householdId = req.headers.get("x-household-id");
  if (!householdId) {
    return NextResponse.json({ error: "X-Household-ID header is required" }, { status: 400 });
  }

  const { id } = await params;
  const existing = await (prisma as any).accountGroup.findUnique({ where: { id } });
  if (!existing || existing.householdId !== householdId) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const json = await req.json().catch(() => ({}));
  const parsed = createAccountGroupSchema.safeParse({ ...json, householdId });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const updated = await (prisma as any).accountGroup.update({
    where: { id },
    data: {
      name: parsed.data.name,
      ...(parsed.data.kind && { kind: parsed.data.kind })
    },
  });
  return NextResponse.json(updated);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const householdId = req.headers.get("x-household-id");
  if (!householdId) {
    return NextResponse.json({ error: "X-Household-ID header is required" }, { status: 400 });
  }

  const { id } = await params;
  const existing = await (prisma as any).accountGroup.findUnique({ where: { id } });
  if (!existing || existing.householdId !== householdId) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  await (prisma as any).accountGroup.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
