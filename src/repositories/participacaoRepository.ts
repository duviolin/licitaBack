import prisma from "../lib/prisma.js";
import { Prisma } from "../generated/prisma/client.js";

export async function findByEmpresaAndLicitacao(
  empresaId: string,
  licitacaoId: string
) {
  return prisma.participacao.findUnique({
    where: { empresaId_licitacaoId: { empresaId, licitacaoId } },
  });
}

export async function findById(id: string) {
  return prisma.participacao.findUnique({
    where: { id },
    include: { licitacao: true, empresa: true },
  });
}

export async function create(data: Prisma.ParticipacaoUncheckedCreateInput) {
  return prisma.participacao.create({
    data,
    include: { licitacao: true },
  });
}

export async function update(id: string, data: Prisma.ParticipacaoUpdateInput) {
  return prisma.participacao.update({
    where: { id },
    data,
    include: { licitacao: true },
  });
}

export async function deleteById(id: string) {
  return prisma.participacao.delete({ where: { id } });
}

export interface ParticipacaoFiltros {
  empresaId?: string;
  status?: string;
}

export async function findWithFilters(filtros: ParticipacaoFiltros) {
  const where: Prisma.ParticipacaoWhereInput = {};

  if (filtros.empresaId) where.empresaId = filtros.empresaId;
  if (filtros.status) {
    where.status = filtros.status as Prisma.EnumParticipacaoStatusFilter;
  }

  return prisma.participacao.findMany({
    where,
    include: { licitacao: true },
    orderBy: { createdAt: "desc" },
  });
}
