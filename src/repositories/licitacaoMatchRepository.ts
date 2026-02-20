import prisma from "../lib/prisma.js";
import { Prisma, MatchStatus } from "../generated/prisma/client.js";

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
    status?: MatchStatus;
    excluirDescartados?: boolean;
    limit?: number;
  } = {}
) {
  const { scoreMin = 0, apenasAbertas = false, status, excluirDescartados = true, limit = 50 } = options;

  const where: Prisma.LicitacaoMatchWhereInput = {
    empresaId,
    score: { gte: scoreMin },
  };

  if (status) {
    where.status = status;
  } else if (excluirDescartados) {
    where.status = { not: MatchStatus.DESCARTADO };
  }

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
    orderBy: [
      { status: "asc" },
      { score: "desc" },
    ],
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

export async function updateStatus(matchId: string, status: MatchStatus) {
  return prisma.licitacaoMatch.update({
    where: { id: matchId },
    data: { status },
  });
}

export async function deleteDescartados() {
  return prisma.licitacaoMatch.deleteMany({
    where: { status: MatchStatus.DESCARTADO },
  });
}

export async function countByStatus() {
  const results = await prisma.licitacaoMatch.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  const counts: Record<string, number> = { NOVO: 0, FAVORITO: 0, DESCARTADO: 0 };
  for (const r of results) {
    counts[r.status] = r._count._all;
  }
  return counts;
}
