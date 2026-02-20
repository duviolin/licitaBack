import prisma from "../../../lib/prisma.js";
import { Prisma } from "../../../generated/prisma/client.js";

export async function createMany(
  data: Prisma.ConformidadeDocumentoUncheckedCreateInput[]
) {
  const results = [];
  for (const item of data) {
    const doc = await prisma.conformidadeDocumento.create({ data: item });
    results.push(doc);
  }
  return results;
}

export async function findByLicitacaoExecId(licitacaoExecId: string) {
  return prisma.conformidadeDocumento.findMany({
    where: { licitacaoExecId },
    include: { documentoExigido: true, empresaDocumento: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function deleteByLicitacaoExecId(licitacaoExecId: string) {
  return prisma.conformidadeDocumento.deleteMany({
    where: { licitacaoExecId },
  });
}
