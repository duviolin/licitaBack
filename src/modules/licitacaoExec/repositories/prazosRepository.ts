import prisma from "../../../lib/prisma.js";
import { Prisma } from "../../../generated/prisma/client.js";

export async function upsert(
  participacaoId: string,
  data: Omit<Prisma.PrazosEditalUncheckedCreateInput, "participacaoId">
) {
  return prisma.prazosEdital.upsert({
    where: { participacaoId },
    create: { participacaoId, ...data },
    update: data,
  });
}

export async function findByParticipacaoId(participacaoId: string) {
  return prisma.prazosEdital.findUnique({
    where: { participacaoId },
  });
}
