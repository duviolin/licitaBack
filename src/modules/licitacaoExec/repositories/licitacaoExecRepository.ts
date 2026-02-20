import prisma from "../../../lib/prisma.js";
import { Prisma } from "../../../generated/prisma/client.js";

export async function create(data: Prisma.LicitacaoExecUncheckedCreateInput) {
  return prisma.licitacaoExec.create({
    data,
    include: { licitacao: true, empresa: true },
  });
}

export async function findById(id: string) {
  return prisma.licitacaoExec.findUnique({
    where: { id },
    include: {
      licitacao: true,
      empresa: true,
      documentosExigidos: true,
      conformidades: {
        include: { documentoExigido: true, empresaDocumento: true },
      },
      prazos: true,
      participacaoPreparada: true,
    },
  });
}

export async function findByLicitacaoAndEmpresa(
  licitacaoId: string,
  empresaId: string
) {
  return prisma.licitacaoExec.findFirst({
    where: { licitacaoId, empresaId },
  });
}

export async function updateStatus(
  id: string,
  status: Prisma.LicitacaoExecUpdateInput["status"]
) {
  return prisma.licitacaoExec.update({
    where: { id },
    data: { status },
  });
}

export async function updateEditalTexto(id: string, editalTexto: string) {
  return prisma.licitacaoExec.update({
    where: { id },
    data: { editalTexto },
  });
}

export async function findAll(empresaId?: string) {
  const where: Prisma.LicitacaoExecWhereInput = {};
  if (empresaId) where.empresaId = empresaId;

  return prisma.licitacaoExec.findMany({
    where,
    include: { licitacao: true, prazos: true },
    orderBy: { createdAt: "desc" },
  });
}
