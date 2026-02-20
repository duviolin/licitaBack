import prisma from "../lib/prisma.js";
import { Prisma } from "../generated/prisma/client.js";

const includeBasic = {
  licitacao: true,
  empresa: true,
} as const;

const includeFull = {
  licitacao: true,
  empresa: true,
  documentosExigidos: { orderBy: { tipo: "asc" as const } },
  conformidades: {
    include: { documentoExigido: true, empresaDocumento: true },
    orderBy: { createdAt: "asc" as const },
  },
  prazos: true,
} as const;

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
    include: includeFull,
  });
}

export async function create(data: Prisma.ParticipacaoUncheckedCreateInput) {
  return prisma.participacao.create({
    data,
    include: includeBasic,
  });
}

export async function update(id: string, data: Prisma.ParticipacaoUpdateInput) {
  return prisma.participacao.update({
    where: { id },
    data,
    include: includeBasic,
  });
}

export async function updateFull(id: string, data: Prisma.ParticipacaoUpdateInput) {
  return prisma.participacao.update({
    where: { id },
    data,
    include: includeFull,
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
    include: {
      licitacao: true,
      empresa: true,
      prazos: true,
    },
    orderBy: { createdAt: "desc" },
  });
}
