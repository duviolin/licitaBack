import prisma from "../../../lib/prisma.js";
import { Prisma } from "../../../generated/prisma/client.js";

export async function createMany(
  data: Prisma.DocumentoExigidoUncheckedCreateInput[]
) {
  const results = [];
  for (const item of data) {
    const doc = await prisma.documentoExigido.create({ data: item });
    results.push(doc);
  }
  return results;
}

export async function findByLicitacaoExecId(licitacaoExecId: string) {
  return prisma.documentoExigido.findMany({
    where: { licitacaoExecId },
    orderBy: { tipo: "asc" },
  });
}

export async function deleteByLicitacaoExecId(licitacaoExecId: string) {
  return prisma.documentoExigido.deleteMany({
    where: { licitacaoExecId },
  });
}
