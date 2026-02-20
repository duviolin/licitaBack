import prisma from "../../../lib/prisma.js";
import { Prisma } from "../../../generated/prisma/client.js";

export async function upsert(
  licitacaoExecId: string,
  data: Omit<Prisma.PrazosEditalUncheckedCreateInput, "licitacaoExecId">
) {
  return prisma.prazosEdital.upsert({
    where: { licitacaoExecId },
    create: { licitacaoExecId, ...data },
    update: data,
  });
}

export async function findByLicitacaoExecId(licitacaoExecId: string) {
  return prisma.prazosEdital.findUnique({
    where: { licitacaoExecId },
  });
}
