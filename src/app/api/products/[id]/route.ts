import { NextResponse } from "next/server";
import { z } from "zod";
import {
  badRequest,
  notFound,
  requireSession,
  unauthorized,
} from "@/lib/api";
import { toNumber } from "@/lib/billing";
import { prisma } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  price: z.number().nonnegative().optional(),
  category: z.string().min(1).optional(),
});

export async function PATCH(req: Request, ctx: Ctx) {
  const session = await requireSession();
  if (!session) return unauthorized();
  const { id } = await ctx.params;

  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message || "Invalid");
  }

  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing || !existing.isActive) return notFound("Product not found");

  const product = await prisma.product.update({
    where: { id },
    data: parsed.data,
  });

  return NextResponse.json({
    product: { ...product, price: toNumber(product.price) },
  });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const session = await requireSession();
  if (!session) return unauthorized();
  const { id } = await ctx.params;

  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing || !existing.isActive) return notFound("Product not found");

  // Soft-delete so past session line items keep their product link history.
  await prisma.product.update({
    where: { id },
    data: { isActive: false },
  });

  return NextResponse.json({ ok: true });
}
