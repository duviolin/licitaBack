import prisma from "../../../lib/prisma.js";
import { Prisma } from "../../../generated/prisma/client.js";

export async function create(data: Prisma.EmpresaDocumentoUncheckedCreateInput) {
  return prisma.empresaDocumento.create({ data });
}

export async function findById(id: string) {
  return prisma.empresaDocumento.findUnique({ where: { id } });
}

export async function findByEmpresaId(empresaId: string) {
  return prisma.empresaDocumento.findMany({
    where: { empresaId },
    orderBy: { tipo: "asc" },
  });
}

export async function findByEmpresaAndTipo(empresaId: string, tipo: string) {
  return prisma.empresaDocumento.findMany({
    where: {
      empresaId,
      tipo: tipo as Prisma.EnumDocumentoTipoFilter,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function update(
  id: string,
  data: Prisma.EmpresaDocumentoUpdateInput
) {
  return prisma.empresaDocumento.update({ where: { id }, data });
}

export async function deleteById(id: string) {
  return prisma.empresaDocumento.delete({ where: { id } });
}
