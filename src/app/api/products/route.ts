import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, requireSession, unauthorized } from "@/lib/api";
import { toNumber } from "@/lib/billing";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await requireSession();
  if (!session) return unauthorized();

  const products = await prisma.product.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({
    products: products.map((p) => ({ ...p, price: toNumber(p.price) })),
  });
}

const createSchema = z.object({
  name: z.string().min(1),
  price: z.number().nonnegative(),
  category: z.string().default("F&B"),
});

export async function POST(req: Request) {
  const session = await requireSession();
  if (!session) return unauthorized();

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message || "Invalid");

  const product = await prisma.product.create({ data: parsed.data });
  return NextResponse.json(
    { product: { ...product, price: toNumber(product.price) } },
    { status: 201 },
  );
}
