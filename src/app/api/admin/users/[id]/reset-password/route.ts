import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { hashWithPepper } from "@/lib/security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const resetSchema = z.object({
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

export const POST = async (
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  const admin = requireAdmin(req);
  if (!admin.ok) {
    return admin.response;
  }

  const { id } = await params;
  const json = await req.json().catch(() => ({}));
  const parsed = resetSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { newPassword } = parsed.data;
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const passwordHash = await hashWithPepper(newPassword);
  await prisma.user.update({
    where: { id },
    data: { passwordHash },
  });

  return NextResponse.json({ success: true });
};
