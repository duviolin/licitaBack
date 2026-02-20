import prisma from "../../../lib/prisma.js";
import { Prisma } from "../../../generated/prisma/client.js";

export async function upsert(
  licitacaoExecId: string,
  empresaId: string,
  data: {
    documentosOk: boolean;
    checklist: Prisma.InputJsonValue;
    propostaBase?: number | null;
    prontoParaEnvio: boolean;
  }
) {
  return prisma.participacaoPreparada.upsert({
    where: { licitacaoExecId },
    create: {
      licitacaoExecId,
      empresaId,
      ...data,
    },
    update: data,
  });
}

export async function findByLicitacaoExecId(licitacaoExecId: string) {
  return prisma.participacaoPreparada.findUnique({
    where: { licitacaoExecId },
    include: { empresa: true },
  });
}
