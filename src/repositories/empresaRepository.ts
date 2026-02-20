import prisma from "../lib/prisma.js";
import { Prisma } from "../generated/prisma/client.js";

export async function findByCnpj(cnpj: string) {
  return prisma.empresa.findUnique({ where: { cnpj } });
}

export async function findById(id: string) {
  return prisma.empresa.findUnique({ where: { id } });
}

export async function findAll() {
  return prisma.empresa.findMany({ orderBy: { createdAt: "desc" } });
}

export async function create(data: Prisma.EmpresaCreateInput) {
  return prisma.empresa.create({ data });
}

export async function update(id: string, data: Prisma.EmpresaUpdateInput) {
  return prisma.empresa.update({ where: { id }, data });
}
