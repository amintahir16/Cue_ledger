import { prisma } from "@/lib/db";

/** Load or create club settings for the signed-in user. */
export async function getOrCreateClubSettings(userId: string) {
  const existing = await prisma.clubSettings.findUnique({
    where: { userId },
  });
  if (existing) return existing;

  return prisma.clubSettings.create({
    data: {
      userId,
      clubName: "My Snooker Club",
    },
  });
}
