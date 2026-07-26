import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, requireSession, unauthorized } from "@/lib/api";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await requireSession();
  if (!session) return unauthorized();

  const customers = await prisma.customer.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { sessions: true } } },
  });

  return NextResponse.json({ customers });
}

const createSchema = z.object({
  name: z.string().min(1).max(100),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  notes: z.string().optional(),
});

export async function POST(req: Request) {
  const session = await requireSession();
  if (!session) return unauthorized();

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message || "Invalid");

  const customer = await prisma.customer.create({
    data: {
      name: parsed.data.name,
      phone: parsed.data.phone || null,
      email: parsed.data.email || null,
      notes: parsed.data.notes,
    },
  });

  return NextResponse.json({ customer }, { status: 201 });
}
