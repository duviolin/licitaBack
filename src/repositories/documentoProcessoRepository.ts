import prisma from "../lib/prisma.js";
import { Prisma } from "../generated/prisma/client.js";

export async function createMany(
  data: Prisma.DocumentoProcessoUncheckedCreateInput[]
) {
  const results = [];
  for (const item of data) {
    const doc = await prisma.documentoProcesso.create({ data: item });
    results.push(doc);
  }
  return results;
}

export async function findByParticipacaoId(participacaoId: string) {
  return prisma.documentoProcesso.findMany({
    where: { participacaoId },
    orderBy: [{ tipo: "asc" }, { createdAt: "asc" }],
  });
}

export async function deleteByParticipacaoId(participacaoId: string) {
  return prisma.documentoProcesso.deleteMany({
    where: { participacaoId },
  });
}

export async function update(
  id: string,
  data: Prisma.DocumentoProcessoUpdateInput
) {
  return prisma.documentoProcesso.update({ where: { id }, data });
}
