import prisma from "../lib/prisma.js";
import { Prisma } from "../generated/prisma/client.js";

export async function createMany(
  data: Prisma.LicitacaoMatchCreateManyInput[]
) {
  if (data.length === 0) return { count: 0 };
  return prisma.licitacaoMatch.createMany({ data, skipDuplicates: true });
}

export async function deleteByEmpresaId(empresaId: string) {
  return prisma.licitacaoMatch.deleteMany({ where: { empresaId } });
}

export async function findByEmpresaId(
  empresaId: string,
  options: {
    scoreMin?: number;
    apenasAbertas?: boolean;
    limit?: number;
  } = {}
) {
  const { scoreMin = 0, apenasAbertas = false, limit = 50 } = options;

  const where: Prisma.LicitacaoMatchWhereInput = {
    empresaId,
    score: { gte: scoreMin },
  };

  if (apenasAbertas) {
    where.licitacao = {
      OR: [
        { dataEncerramento: { gt: new Date() } },
        { dataEncerramento: null },
      ],
    };
  }

  return prisma.licitacaoMatch.findMany({
    where,
    include: {
      licitacao: true,
    },
    orderBy: { score: "desc" },
    take: limit,
  });
}

export async function upsert(
  empresaId: string,
  licitacaoId: string,
  data: {
    score: number;
    scoreTextual: number;
    scoreGeografico: number;
    scoreValor: number;
    palavrasMatch: string[];
  }
) {
  return prisma.licitacaoMatch.upsert({
    where: {
      empresaId_licitacaoId: { empresaId, licitacaoId },
    },
    update: data,
    create: {
      empresaId,
      licitacaoId,
      ...data,
    },
  });
}
