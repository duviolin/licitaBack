import * as participacaoRepo from "../repositories/participacaoRepository.js";
import * as empresaRepo from "../repositories/empresaRepository.js";
import * as licitacaoRepo from "../repositories/licitacaoRepository.js";
import * as docExigidoRepo from "../modules/licitacaoExec/repositories/documentoExigidoRepository.js";
import * as conformidadeRepo from "../modules/licitacaoExec/repositories/conformidadeRepository.js";
import * as prazosRepo from "../modules/licitacaoExec/repositories/prazosRepository.js";

import * as editalParser from "../modules/licitacaoExec/services/editalParserService.js";
import * as requisitosExtractor from "../modules/licitacaoExec/services/requisitosExtractorService.js";
import * as prazosExtractor from "../modules/licitacaoExec/services/prazosExtractorService.js";
import * as conformidadeService from "../modules/licitacaoExec/services/conformidadeService.js";
import * as participacaoPreparator from "../modules/licitacaoExec/services/participacaoPreparatorService.js";

import { ParticipacaoStatus } from "../generated/prisma/client.js";

const STATUS_VALIDOS = new Set<string>(Object.values(ParticipacaoStatus));

export async function registrar(params: {
  empresaId: string;
  licitacaoId: string;
  editalUrl?: string;
  portalLink?: string;
  valorProposta?: number;
  observacoes?: string;
}) {
  const empresa = await empresaRepo.findById(params.empresaId);
  if (!empresa) throw new Error("Empresa não encontrada");

  const licitacao = await licitacaoRepo.findById(params.licitacaoId);
  if (!licitacao) throw new Error("Licitação não encontrada");

  const existente = await participacaoRepo.findByEmpresaAndLicitacao(
    params.empresaId,
    params.licitacaoId
  );
  if (existente) throw new Error("Participação já registrada para esta empresa e licitação");

  const editalUrl = params.editalUrl || licitacao.linkEdital || "";

  const participacao = await participacaoRepo.create({
    empresaId: params.empresaId,
    licitacaoId: params.licitacaoId,
    valorProposta: params.valorProposta ?? null,
    observacoes: params.observacoes ?? "",
    editalUrl,
    portalLink: params.portalLink || licitacao.linkPortal || "",
  });

  if (editalUrl) {
    try {
      await analisarEdital(participacao.id, params.empresaId, editalUrl);
    } catch (err) {
      console.error(`[Participacao] Análise de edital falhou, participação criada sem análise:`, err);
      await participacaoRepo.update(participacao.id, {
        observacoes: `${participacao.observacoes}\n[Auto] Análise do edital falhou: ${err instanceof Error ? err.message : String(err)}`.trim(),
      });
    }
  }

  return participacaoRepo.findById(participacao.id);
}

async function analisarEdital(
  participacaoId: string,
  empresaId: string,
  editalUrl: string
) {
  console.log(`[Participacao] Iniciando análise de edital para participação ${participacaoId}`);

  const textoEdital = await editalParser.processarEdital(editalUrl);

  await participacaoRepo.update(participacaoId, { editalTexto: textoEdital });

  const requisitosExtraidos = requisitosExtractor.extrairRequisitos(textoEdital);

  const docsExigidos = await docExigidoRepo.createMany(
    requisitosExtraidos.map((r) => ({
      participacaoId,
      tipo: r.tipo as any,
      nome: r.nome,
      secaoEdital: r.secaoEdital,
      obrigatorio: r.obrigatorio,
      validadeDias: r.validadeDias ?? null,
      autenticacaoExigida: r.autenticacaoExigida,
      referenciaEdital: r.referenciaEdital,
    }))
  );

  const prazosExtraidos = prazosExtractor.extrairPrazos(textoEdital);
  await prazosRepo.upsert(participacaoId, {
    dataAbertura: prazosExtraidos.dataAbertura ?? null,
    dataSessao: prazosExtraidos.dataSessao ?? null,
    prazoImpugnacao: prazosExtraidos.prazoImpugnacao ?? null,
    prazoEsclarecimento: prazosExtraidos.prazoEsclarecimento ?? null,
    prazoRecurso: prazosExtraidos.prazoRecurso ?? null,
  });

  const conformidadeItems = await conformidadeService.verificarConformidade(
    empresaId,
    docsExigidos,
    prazosExtraidos.dataSessao
  );

  await conformidadeRepo.createMany(
    conformidadeItems.map((c) => ({
      participacaoId,
      empresaId,
      documentoExigidoId: c.documentoExigidoId,
      empresaDocumentoId: c.empresaDocumentoId,
      status: c.status,
      observacao: c.observacao,
    }))
  );

  const conformidadesDB = await conformidadeRepo.findByParticipacaoId(participacaoId);

  const checklist = participacaoPreparator.gerarChecklist(
    docsExigidos,
    conformidadesDB as any
  );

  const novoStatus = checklist.aptoParaParticipar ? "APTA" : "PENDENTE_DOC";

  await participacaoRepo.update(participacaoId, {
    status: novoStatus,
    documentosOk: checklist.aptoParaParticipar,
    checklist: checklist as any,
    percentualConformidade: checklist.percentualConformidade,
  });

  console.log(
    `[Participacao] Análise concluída: ${novoStatus} — ${checklist.totalOk}/${checklist.totalExigidos} docs OK (${checklist.percentualConformidade}%)`
  );
}

export async function reprocessarDocumentos(id: string) {
  const participacao = await participacaoRepo.findById(id);
  if (!participacao) throw new Error("Participação não encontrada");

  console.log(`[Participacao] Reprocessando documentos para participação ${id}`);

  await conformidadeRepo.deleteByParticipacaoId(id);

  const docsExigidos = await docExigidoRepo.findByParticipacaoId(id);
  if (docsExigidos.length === 0) {
    throw new Error("Nenhum documento exigido encontrado. A análise do edital ainda não foi feita.");
  }

  const prazos = await prazosRepo.findByParticipacaoId(id);

  const conformidadeItems = await conformidadeService.verificarConformidade(
    participacao.empresaId,
    docsExigidos,
    prazos?.dataSessao
  );

  await conformidadeRepo.createMany(
    conformidadeItems.map((c) => ({
      participacaoId: id,
      empresaId: participacao.empresaId,
      documentoExigidoId: c.documentoExigidoId,
      empresaDocumentoId: c.empresaDocumentoId,
      status: c.status,
      observacao: c.observacao,
    }))
  );

  const conformidadesDB = await conformidadeRepo.findByParticipacaoId(id);
  const checklist = participacaoPreparator.gerarChecklist(
    docsExigidos,
    conformidadesDB as any
  );

  const novoStatus = checklist.aptoParaParticipar ? "APTA" : "PENDENTE_DOC";

  await participacaoRepo.update(id, {
    status: novoStatus,
    documentosOk: checklist.aptoParaParticipar,
    checklist: checklist as any,
    percentualConformidade: checklist.percentualConformidade,
  });

  console.log(`[Participacao] Reprocessamento concluído: ${novoStatus}`);

  return participacaoRepo.findById(id);
}

export async function obterDetalhe(id: string) {
  const participacao = await participacaoRepo.findById(id);
  if (!participacao) throw new Error("Participação não encontrada");
  return participacao;
}

export async function atualizar(
  id: string,
  dados: {
    status?: string;
    valorProposta?: number;
    observacoes?: string;
  }
) {
  const participacao = await participacaoRepo.findById(id);
  if (!participacao) throw new Error("Participação não encontrada");

  if (dados.status && !STATUS_VALIDOS.has(dados.status)) {
    throw new Error(
      `Status inválido. Valores aceitos: ${[...STATUS_VALIDOS].join(", ")}`
    );
  }

  const updateData: Record<string, unknown> = {};
  if (dados.status !== undefined) updateData.status = dados.status;
  if (dados.valorProposta !== undefined) updateData.valorProposta = dados.valorProposta;
  if (dados.observacoes !== undefined) updateData.observacoes = dados.observacoes;

  return participacaoRepo.update(id, updateData);
}

export async function remover(id: string) {
  const participacao = await participacaoRepo.findById(id);
  if (!participacao) throw new Error("Participação não encontrada");
  await participacaoRepo.deleteById(id);
}

export async function listar(filtros: participacaoRepo.ParticipacaoFiltros) {
  return participacaoRepo.findWithFilters(filtros);
}
