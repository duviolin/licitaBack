import {
  buscarContratacoes,
  type PncpFiltros,
  type PncpContratacaoResponse,
  type CancelSignal,
} from "../clients/pncpClient.js";
import * as licitacaoRepo from "../repositories/licitacaoRepository.js";
import * as matchRepo from "../repositories/licitacaoMatchRepository.js";
import prisma from "../lib/prisma.js";
import { processarTexto } from "../utils/text.js";
import { calcularScoreComposto } from "../utils/score.js";
import { randomUUID } from "node:crypto";

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

export interface ImportarOpcoes extends PncpFiltros {
  scoreMinimo?: number;
  empresaId?: string;
}

export interface ImportarResultado {
  totalConsultadas: number;
  totalDuplicadas: number;
  totalDescartadas: number;
  totalImportadas: number;
  matchesCalculados: number;
  scoreMinUsado: number;
  paginasConsultadas: number;
}

export interface ProgressoImportacao {
  fase: "preparando" | "buscando" | "analisando" | "concluido" | "cancelado" | "erro";
  mensagem: string;
  progresso: number;
  detalhes: {
    consultadas: number;
    duplicadas: number;
    descartadas: number;
    importadas: number;
    matches: number;
  };
}

export interface ImportJob {
  id: string;
  status: "running" | "done" | "error" | "cancelled";
  progresso: ProgressoImportacao;
  resultado?: ImportarResultado;
  signal: CancelSignal;
  createdAt: number;
}

const jobs = new Map<string, ImportJob>();

const JOB_TTL_MS = 10 * 60 * 1000;

function cleanupJobs() {
  const now = Date.now();
  for (const [id, job] of jobs) {
    if (job.status !== "running" && now - job.createdAt > JOB_TTL_MS) {
      jobs.delete(id);
    }
  }
}

export function iniciarImportacao(opcoes: ImportarOpcoes): string {
  cleanupJobs();

  const id = randomUUID();
  const signal: CancelSignal = { cancelled: false };
  const job: ImportJob = {
    id,
    status: "running",
    progresso: {
      fase: "preparando",
      mensagem: "Iniciando...",
      progresso: 0,
      detalhes: { consultadas: 0, duplicadas: 0, descartadas: 0, importadas: 0, matches: 0 },
    },
    signal,
    createdAt: Date.now(),
  };
  jobs.set(id, job);

  importarDosPncpComProgresso(opcoes, (p) => {
    job.progresso = p;
  }, signal)
    .then((resultado) => {
      job.resultado = resultado;
      job.status = signal.cancelled ? "cancelled" : "done";
      if (!signal.cancelled) {
        job.progresso = {
          fase: "concluido",
          mensagem: `Concluído! ${resultado.totalImportadas} licitações importadas.`,
          progresso: 100,
          detalhes: {
            consultadas: resultado.totalConsultadas,
            duplicadas: resultado.totalDuplicadas,
            descartadas: resultado.totalDescartadas,
            importadas: resultado.totalImportadas,
            matches: resultado.matchesCalculados,
          },
        };
      }
    })
    .catch((err) => {
      job.status = "error";
      job.progresso = {
        fase: "erro",
        mensagem: err instanceof Error ? err.message : "Erro desconhecido",
        progresso: 0,
        detalhes: job.progresso.detalhes,
      };
    });

  return id;
}

export function obterJobStatus(jobId: string): ImportJob | undefined {
  return jobs.get(jobId);
}

export function cancelarJob(jobId: string): boolean {
  const job = jobs.get(jobId);
  if (!job || job.status !== "running") return false;
  job.signal.cancelled = true;
  job.status = "cancelled";
  job.progresso = {
    fase: "cancelado",
    mensagem: `Cancelado. ${job.progresso.detalhes.importadas} importadas antes da pausa.`,
    progresso: 0,
    detalhes: job.progresso.detalhes,
  };
  return true;
}

export async function importarDosPncp(opcoes: ImportarOpcoes): Promise<ImportarResultado> {
  const result = await importarDosPncpComProgresso(opcoes);
  return result;
}

async function importarDosPncpComProgresso(
  opcoes: ImportarOpcoes,
  onProgress?: (p: ProgressoImportacao) => void,
  signal?: CancelSignal,
): Promise<ImportarResultado> {
  const scoreMinimo = opcoes.scoreMinimo ?? 0.3;

  const emit = (p: ProgressoImportacao) => onProgress?.(p);

  emit({
    fase: "preparando",
    mensagem: "Carregando dados das empresas...",
    progresso: 0,
    detalhes: { consultadas: 0, duplicadas: 0, descartadas: 0, importadas: 0, matches: 0 },
  });

  const empresas = await prisma.empresa.findMany();

  if (empresas.length === 0) {
    throw new Error(
      "Nenhuma empresa cadastrada. Cadastre ao menos uma empresa antes de importar licitações."
    );
  }

  const empresasComStems = empresas
    .filter((e) => opcoes.empresaId ? e.id === opcoes.empresaId : true)
    .map((empresa) => ({
      id: empresa.id,
      stems: [...new Set([...empresa.stemsCnae, ...empresa.stemsChave])],
      uf: empresa.uf,
      ufsInteresse: empresa.ufsInteresse,
      valorMinimo: empresa.valorMinimo ? Number(empresa.valorMinimo) : null,
      valorMaximo: empresa.valorMaximo ? Number(empresa.valorMaximo) : null,
    }))
    .filter((e) => e.stems.length > 0);

  if (empresasComStems.length === 0) {
    throw new Error(
      "Nenhuma empresa tem palavras-chave ou CNAE configurado. Configure preferências antes de importar."
    );
  }

  emit({
    fase: "preparando",
    mensagem: `${empresasComStems.length} empresa(s) carregada(s). Buscando no PNCP...`,
    progresso: 5,
    detalhes: { consultadas: 0, duplicadas: 0, descartadas: 0, importadas: 0, matches: 0 },
  });

  if (signal?.cancelled) {
    return buildResult(0, 0, 0, 0, 0, scoreMinimo);
  }

  const contratacoes = await buscarContratacoes(
    opcoes,
    (p) => {
      emit({
        fase: "buscando",
        mensagem: `${p.modalidade} — pág. ${p.pagina}/${p.totalPaginas}`,
        progresso: Math.min(45, 5 + Math.min(40, p.itensAcumulados * 0.15)),
        detalhes: { consultadas: p.itensAcumulados, duplicadas: 0, descartadas: 0, importadas: 0, matches: 0 },
      });
    },
    signal,
  );

  if (signal?.cancelled) {
    emit({
      fase: "cancelado",
      mensagem: "Importação cancelada pelo usuário.",
      progresso: 0,
      detalhes: { consultadas: contratacoes.length, duplicadas: 0, descartadas: 0, importadas: 0, matches: 0 },
    });
    return buildResult(contratacoes.length, 0, 0, 0, 0, scoreMinimo);
  }

  emit({
    fase: "analisando",
    mensagem: `${contratacoes.length} licitações encontradas. Analisando relevância...`,
    progresso: 50,
    detalhes: { consultadas: contratacoes.length, duplicadas: 0, descartadas: 0, importadas: 0, matches: 0 },
  });

  let totalDuplicadas = 0;
  let totalDescartadas = 0;
  let totalImportadas = 0;
  let matchesCalculados = 0;

  for (let i = 0; i < contratacoes.length; i++) {
    if (signal?.cancelled) break;

    const item = contratacoes[i];

    const existente = await licitacaoRepo.findByPncpId(item.numeroControlePNCP);
    if (existente) {
      totalDuplicadas++;
      emitProgress(i);
      continue;
    }

    const dados = mapearContratacao(item);

    const matchesParaSalvar: Array<{
      empresaId: string;
      score: number;
      scoreTextual: number;
      scoreGeografico: number;
      scoreValor: number;
      palavrasMatch: string[];
    }> = [];

    for (const empresa of empresasComStems) {
      const result = calcularScoreComposto({
        stemsEmpresa: empresa.stems,
        stemsObjeto: dados.stemsObjeto,
        textoObjeto: dados.objeto,
        ufEmpresa: empresa.uf,
        ufsInteresse: empresa.ufsInteresse,
        ufLicitacao: dados.uf,
        valorMinimo: empresa.valorMinimo,
        valorMaximo: empresa.valorMaximo,
        valorEstimado: dados.valorEstimado ? Number(dados.valorEstimado) : null,
      });

      if (result.score >= scoreMinimo) {
        matchesParaSalvar.push({
          empresaId: empresa.id,
          score: result.score,
          scoreTextual: result.scoreTextual,
          scoreGeografico: result.scoreGeografico,
          scoreValor: result.scoreValor,
          palavrasMatch: result.palavrasMatch,
        });
      }
    }

    if (matchesParaSalvar.length === 0) {
      totalDescartadas++;
      emitProgress(i);
      continue;
    }

    const licitacao = await licitacaoRepo.create(dados);
    totalImportadas++;

    for (const match of matchesParaSalvar) {
      await matchRepo.upsert(match.empresaId, licitacao.id, {
        score: match.score,
        scoreTextual: match.scoreTextual,
        scoreGeografico: match.scoreGeografico,
        scoreValor: match.scoreValor,
        palavrasMatch: match.palavrasMatch,
      });
      matchesCalculados++;
    }

    emitProgress(i);
  }

  function emitProgress(i: number) {
    const pct = 50 + Math.round(((i + 1) / contratacoes.length) * 48);
    emit({
      fase: "analisando",
      mensagem: `${i + 1} de ${contratacoes.length} — ${totalImportadas} salvas, ${totalDescartadas} descartadas`,
      progresso: Math.min(pct, 99),
      detalhes: {
        consultadas: contratacoes.length,
        duplicadas: totalDuplicadas,
        descartadas: totalDescartadas,
        importadas: totalImportadas,
        matches: matchesCalculados,
      },
    });
  }

  if (signal?.cancelled) {
    emit({
      fase: "cancelado",
      mensagem: `Cancelado. ${totalImportadas} importadas antes da pausa.`,
      progresso: 0,
      detalhes: { consultadas: contratacoes.length, duplicadas: totalDuplicadas, descartadas: totalDescartadas, importadas: totalImportadas, matches: matchesCalculados },
    });
  } else {
    emit({
      fase: "concluido",
      mensagem: `Concluído! ${totalImportadas} licitações importadas, ${totalDescartadas} descartadas.`,
      progresso: 100,
      detalhes: { consultadas: contratacoes.length, duplicadas: totalDuplicadas, descartadas: totalDescartadas, importadas: totalImportadas, matches: matchesCalculados },
    });
  }

  return buildResult(contratacoes.length, totalDuplicadas, totalDescartadas, totalImportadas, matchesCalculados, scoreMinimo);
}

function buildResult(
  consultadas: number, duplicadas: number, descartadas: number,
  importadas: number, matches: number, scoreMin: number,
): ImportarResultado {
  return {
    totalConsultadas: consultadas,
    totalDuplicadas: duplicadas,
    totalDescartadas: descartadas,
    totalImportadas: importadas,
    matchesCalculados: matches,
    scoreMinUsado: scoreMin,
    paginasConsultadas: Math.ceil(consultadas / 50) || 1,
  };
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

// ── Match status management ──

export async function atualizarStatusMatch(matchId: string, status: "NOVO" | "FAVORITO" | "DESCARTADO") {
  const { MatchStatus } = await import("../generated/prisma/client.js");
  return matchRepo.updateStatus(matchId, MatchStatus[status]);
}

// ── Cleanup ──

export interface LimpezaPreview {
  matchesDescartados: number;
  licitacoesEncerradas: number;
  licitacoesOrfas: number;
}

export async function previewLimpeza(): Promise<LimpezaPreview> {
  const [statusCounts, encerradas, orfas] = await Promise.all([
    matchRepo.countByStatus(),
    licitacaoRepo.countEncerradas(),
    licitacaoRepo.countOrfas(),
  ]);

  return {
    matchesDescartados: statusCounts.DESCARTADO,
    licitacoesEncerradas: encerradas,
    licitacoesOrfas: orfas,
  };
}

export interface LimpezaResultado {
  matchesRemovidos: number;
  licitacoesEncerradasRemovidas: number;
  licitacoesOrfasRemovidas: number;
}

export async function executarLimpeza(): Promise<LimpezaResultado> {
  const descartados = await matchRepo.deleteDescartados();
  const encerradas = await licitacaoRepo.deleteEncerradasAntigas(30);
  const orfas = await licitacaoRepo.deleteOrfas();

  return {
    matchesRemovidos: descartados.count,
    licitacoesEncerradasRemovidas: encerradas.count,
    licitacoesOrfasRemovidas: orfas.count,
  };
}
