import {
  buscarContratacoes,
  type PncpFiltros,
  type PncpContratacaoResponse,
} from "../clients/pncpClient.js";
import * as licitacaoRepo from "../repositories/licitacaoRepository.js";
import * as matchRepo from "../repositories/licitacaoMatchRepository.js";
import prisma from "../lib/prisma.js";
import { processarTexto } from "../utils/text.js";
import { calcularScoreComposto } from "../utils/score.js";

const ESFERA_MAP: Record<string, string> = {
  F: "Federal",
  E: "Estadual",
  M: "Municipal",
};

function mapearContratacao(item: PncpContratacaoResponse) {
  return {
    pncpId: item.numeroControlePNCP,
    objeto: item.objetoCompra,
    orgao: item.orgaoEntidade.razaoSocial,
    modalidade: item.modalidadeNome,
    valorEstimado: item.valorTotalEstimado ?? null,
    uf: item.unidadeOrgao.ufSigla,
    municipioIbge: item.unidadeOrgao.codigoIbge || "",
    esfera: ESFERA_MAP[item.orgaoEntidade.esferaId] || "",
    dataPublicacao: new Date(item.dataPublicacaoPncp),
    dataAbertura: item.dataAberturaProposta ? new Date(item.dataAberturaProposta) : null,
    dataEncerramento: item.dataEncerramentoProposta
      ? new Date(item.dataEncerramentoProposta)
      : null,
    situacao: item.situacaoCompraNome || "Divulgada",
    portal: "PNCP",
    linkPortal: item.linkSistemaOrigem || "",
    linkEdital: item.linkProcesso || "",
    stemsObjeto: processarTexto(item.objetoCompra),
  };
}

export interface ImportarResultado {
  totalConsultadas: number;
  totalImportadas: number;
  totalIgnoradas: number;
  matchesCalculados: number;
  paginasConsultadas: number;
}

export async function importarDosPncp(filtros: PncpFiltros): Promise<ImportarResultado> {
  const contratacoes = await buscarContratacoes(filtros);

  let totalImportadas = 0;
  let totalIgnoradas = 0;
  const novasLicitacaoIds: string[] = [];

  for (const item of contratacoes) {
    const existente = await licitacaoRepo.findByPncpId(item.numeroControlePNCP);
    if (existente) {
      totalIgnoradas++;
      continue;
    }

    const dados = mapearContratacao(item);
    const licitacao = await licitacaoRepo.create(dados);
    novasLicitacaoIds.push(licitacao.id);
    totalImportadas++;
  }

  const matchesCalculados = await calcularMatchesParaNovasLicitacoes(novasLicitacaoIds);

  return {
    totalConsultadas: contratacoes.length,
    totalImportadas,
    totalIgnoradas,
    matchesCalculados,
    paginasConsultadas: Math.ceil(contratacoes.length / 50) || 1,
  };
}

async function calcularMatchesParaNovasLicitacoes(
  licitacaoIds: string[]
): Promise<number> {
  if (licitacaoIds.length === 0) return 0;

  const empresas = await prisma.empresa.findMany();
  const licitacoes = await prisma.licitacao.findMany({
    where: { id: { in: licitacaoIds } },
  });

  let count = 0;

  for (const empresa of empresas) {
    const stemsEmpresa = [
      ...new Set([...empresa.stemsCnae, ...empresa.stemsChave]),
    ];
    if (stemsEmpresa.length === 0) continue;

    for (const lic of licitacoes) {
      const result = calcularScoreComposto({
        stemsEmpresa,
        stemsObjeto: lic.stemsObjeto,
        textoObjeto: lic.objeto,
        ufEmpresa: empresa.uf,
        ufsInteresse: empresa.ufsInteresse,
        ufLicitacao: lic.uf,
        valorMinimo: empresa.valorMinimo ? Number(empresa.valorMinimo) : null,
        valorMaximo: empresa.valorMaximo ? Number(empresa.valorMaximo) : null,
        valorEstimado: lic.valorEstimado ? Number(lic.valorEstimado) : null,
      });

      if (result.score > 0) {
        await matchRepo.upsert(empresa.id, lic.id, {
          score: result.score,
          scoreTextual: result.scoreTextual,
          scoreGeografico: result.scoreGeografico,
          scoreValor: result.scoreValor,
          palavrasMatch: result.palavrasMatch,
        });
        count++;
      }
    }
  }

  return count;
}

export async function listarLicitacoes(filtros: licitacaoRepo.LicitacaoFiltros) {
  return licitacaoRepo.findWithFilters(filtros);
}

export async function obterLicitacao(id: string) {
  const licitacao = await licitacaoRepo.findById(id);
  if (!licitacao) {
    throw new Error("Licitação não encontrada");
  }

  return {
    ...licitacao,
    matches: licitacao.matches.map((m) => ({
      empresaId: m.empresa.id,
      razaoSocial: m.empresa.razaoSocial,
      score: m.score,
      scoreTextual: m.scoreTextual,
      scoreGeografico: m.scoreGeografico,
      scoreValor: m.scoreValor,
      palavrasMatch: m.palavrasMatch,
    })),
  };
}
