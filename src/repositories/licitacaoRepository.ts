import prisma from "../lib/prisma.js";
import { Prisma } from "../generated/prisma/client.js";

export async function findByPncpId(pncpId: string) {
  return prisma.licitacao.findUnique({ where: { pncpId } });
}

export async function findById(id: string) {
  return prisma.licitacao.findUnique({
    where: { id },
    include: {
      matches: {
        include: { empresa: { select: { id: true, razaoSocial: true, cnpj: true } } },
        orderBy: { score: "desc" },
      },
    },
  });
}

export async function create(data: Prisma.LicitacaoCreateInput) {
  return prisma.licitacao.create({ data });
}

export interface LicitacaoFiltros {
  empresaId?: string;
  scoreMin?: number;
  modalidade?: string;
  uf?: string;
  esfera?: string;
  situacao?: string;
  valorMin?: number;
  valorMax?: number;
  apenasAbertas?: boolean;
  dataMinima?: string;
  page?: number;
  limit?: number;
}

export async function findWithFilters(filtros: LicitacaoFiltros) {
  const {
    empresaId,
    scoreMin = 0,
    modalidade,
    uf,
    esfera,
    situacao,
    valorMin,
    valorMax,
    apenasAbertas = false,
    dataMinima,
    page = 1,
    limit = 20,
  } = filtros;

  const take = Math.min(limit, 100);
  const skip = (page - 1) * take;

  if (empresaId) {
    const matchWhere: Prisma.LicitacaoMatchWhereInput = {
      empresaId,
      score: { gte: scoreMin },
    };

    const licWhere: Prisma.LicitacaoWhereInput = {};
    if (modalidade) licWhere.modalidade = { contains: modalidade, mode: "insensitive" };
    if (uf) licWhere.uf = uf;
    if (esfera) licWhere.esfera = esfera;
    if (situacao) licWhere.situacao = situacao;
    if (valorMin !== undefined) licWhere.valorEstimado = { ...((licWhere.valorEstimado as object) || {}), gte: valorMin };
    if (valorMax !== undefined) licWhere.valorEstimado = { ...((licWhere.valorEstimado as object) || {}), lte: valorMax };
    if (apenasAbertas) {
      licWhere.OR = [
        { dataEncerramento: { gt: new Date() } },
        { dataEncerramento: null },
      ];
    }
    if (dataMinima) {
      const d = parseYYYYMMDD(dataMinima);
      if (d) licWhere.dataPublicacao = { gte: d };
    }

    if (Object.keys(licWhere).length > 0) {
      matchWhere.licitacao = licWhere;
    }

    const [matches, total] = await Promise.all([
      prisma.licitacaoMatch.findMany({
        where: matchWhere,
        include: { licitacao: true },
        orderBy: { score: "desc" },
        skip,
        take,
      }),
      prisma.licitacaoMatch.count({ where: matchWhere }),
    ]);

    const data = matches.map((m) => ({
      ...m.licitacao,
      score: m.score,
      scoreTextual: m.scoreTextual,
      scoreGeografico: m.scoreGeografico,
      scoreValor: m.scoreValor,
      palavrasMatch: m.palavrasMatch,
    }));

    return { data, total, page, limit: take, totalPages: Math.ceil(total / take) };
  }

  const where: Prisma.LicitacaoWhereInput = {};
  if (modalidade) where.modalidade = { contains: modalidade, mode: "insensitive" };
  if (uf) where.uf = uf;
  if (esfera) where.esfera = esfera;
  if (situacao) where.situacao = situacao;
  if (valorMin !== undefined) where.valorEstimado = { ...((where.valorEstimado as object) || {}), gte: valorMin };
  if (valorMax !== undefined) where.valorEstimado = { ...((where.valorEstimado as object) || {}), lte: valorMax };
  if (apenasAbertas) {
    where.OR = [
      { dataEncerramento: { gt: new Date() } },
      { dataEncerramento: null },
    ];
  }
  if (dataMinima) {
    const d = parseYYYYMMDD(dataMinima);
    if (d) where.dataPublicacao = { gte: d };
  }

  const [data, total] = await Promise.all([
    prisma.licitacao.findMany({
      where,
      orderBy: { dataPublicacao: "desc" },
      skip,
      take,
    }),
    prisma.licitacao.count({ where }),
  ]);

  return { data, total, page, limit: take, totalPages: Math.ceil(total / take) };
}

function parseYYYYMMDD(s: string): Date | null {
  if (!/^\d{8}$/.test(s)) return null;
  const y = parseInt(s.slice(0, 4));
  const m = parseInt(s.slice(4, 6)) - 1;
  const d = parseInt(s.slice(6, 8));
  return new Date(y, m, d);
}
