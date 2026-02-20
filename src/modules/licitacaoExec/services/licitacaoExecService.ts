import * as licitacaoExecRepo from "../repositories/licitacaoExecRepository.js";
import * as docExigidoRepo from "../repositories/documentoExigidoRepository.js";
import * as conformidadeRepo from "../repositories/conformidadeRepository.js";
import * as prazosRepo from "../repositories/prazosRepository.js";
import * as participacaoPreparadaRepo from "../repositories/participacaoPreparadaRepository.js";

import * as editalParser from "./editalParserService.js";
import * as requisitosExtractor from "./requisitosExtractorService.js";
import * as prazosExtractor from "./prazosExtractorService.js";
import * as conformidadeService from "./conformidadeService.js";
import * as participacaoPreparator from "./participacaoPreparatorService.js";

import * as empresaRepo from "../../../repositories/empresaRepository.js";
import * as licitacaoRepo from "../../../repositories/licitacaoRepository.js";

import type { IniciarAnaliseParams } from "../types/index.js";

export async function iniciarAnalise(params: IniciarAnaliseParams) {
  const { licitacaoId, editalUrl, portalLink, empresaId } = params;

  const empresa = await empresaRepo.findById(empresaId);
  if (!empresa) throw new Error("Empresa não encontrada");

  const licitacao = await licitacaoRepo.findById(licitacaoId);
  if (!licitacao) throw new Error("Licitação não encontrada");

  const existente = await licitacaoExecRepo.findByLicitacaoAndEmpresa(
    licitacaoId,
    empresaId
  );
  if (existente) {
    throw new Error(
      "Análise já iniciada para esta licitação e empresa. Use o endpoint de reprocessamento."
    );
  }

  console.log(
    `[LicitacaoExec] Iniciando análise da licitação ${licitacao.pncpId} para empresa ${empresa.razaoSocial}`
  );

  // 1. Processar edital (baixar + extrair texto)
  let textoEdital: string;
  try {
    textoEdital = await editalParser.processarEdital(editalUrl);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Erro ao processar edital: ${msg}`);
  }

  // 2. Criar registro LicitacaoExec
  const execRecord = await licitacaoExecRepo.create({
    licitacaoId,
    empresaId,
    editalUrl,
    editalTexto: textoEdital,
    portalLink: portalLink ?? "",
    status: "ANALISE",
  });

  try {
    // 3. Extrair requisitos de habilitação
    const requisitosExtraidos =
      requisitosExtractor.extrairRequisitos(textoEdital);

    const docsExigidos = await docExigidoRepo.createMany(
      requisitosExtraidos.map((r) => ({
        licitacaoExecId: execRecord.id,
        tipo: r.tipo as any,
        nome: r.nome,
        secaoEdital: r.secaoEdital,
        obrigatorio: r.obrigatorio,
        validadeDias: r.validadeDias ?? null,
        autenticacaoExigida: r.autenticacaoExigida,
        referenciaEdital: r.referenciaEdital,
      }))
    );

    // 4. Extrair prazos
    const prazosExtraidos = prazosExtractor.extrairPrazos(textoEdital);
    const prazos = await prazosRepo.upsert(execRecord.id, {
      dataAbertura: prazosExtraidos.dataAbertura ?? null,
      dataSessao: prazosExtraidos.dataSessao ?? null,
      prazoImpugnacao: prazosExtraidos.prazoImpugnacao ?? null,
      prazoEsclarecimento: prazosExtraidos.prazoEsclarecimento ?? null,
      prazoRecurso: prazosExtraidos.prazoRecurso ?? null,
    });

    // 5. Verificar conformidade documental
    const conformidadeItems = await conformidadeService.verificarConformidade(
      empresaId,
      docsExigidos,
      prazosExtraidos.dataSessao
    );

    await conformidadeRepo.createMany(
      conformidadeItems.map((c) => ({
        licitacaoExecId: execRecord.id,
        empresaId,
        documentoExigidoId: c.documentoExigidoId,
        empresaDocumentoId: c.empresaDocumentoId,
        status: c.status,
        observacao: c.observacao,
      }))
    );

    // 6. Gerar checklist e preparar participação
    const conformidadesDB = await conformidadeRepo.findByLicitacaoExecId(
      execRecord.id
    );

    const checklist = participacaoPreparator.gerarChecklist(
      docsExigidos,
      conformidadesDB as any
    );

    const statusFinal = participacaoPreparator.determinarStatus(checklist);

    await participacaoPreparadaRepo.upsert(execRecord.id, empresaId, {
      documentosOk: checklist.aptoParaParticipar,
      checklist: checklist as any,
      prontoParaEnvio: checklist.aptoParaParticipar,
    });

    // 7. Atualizar status final
    await licitacaoExecRepo.updateStatus(execRecord.id, statusFinal);

    console.log(
      `[LicitacaoExec] Análise concluída: ${statusFinal} — ${checklist.totalOk}/${checklist.totalExigidos} documentos OK`
    );

    return obterVisaoGeral(execRecord.id);
  } catch (err) {
    await licitacaoExecRepo.updateStatus(execRecord.id, "ANALISE");
    throw err;
  }
}

export async function obterVisaoGeral(id: string) {
  const exec = await licitacaoExecRepo.findById(id);
  if (!exec) throw new Error("Análise de licitação não encontrada");
  return exec;
}

export async function obterDocumentosExigidos(id: string) {
  const exec = await licitacaoExecRepo.findById(id);
  if (!exec) throw new Error("Análise de licitação não encontrada");
  return docExigidoRepo.findByLicitacaoExecId(id);
}

export async function obterConformidade(id: string) {
  const exec = await licitacaoExecRepo.findById(id);
  if (!exec) throw new Error("Análise de licitação não encontrada");
  return conformidadeRepo.findByLicitacaoExecId(id);
}

export async function obterPrazos(id: string) {
  const exec = await licitacaoExecRepo.findById(id);
  if (!exec) throw new Error("Análise de licitação não encontrada");
  return prazosRepo.findByLicitacaoExecId(id);
}

export async function obterChecklist(id: string) {
  const exec = await licitacaoExecRepo.findById(id);
  if (!exec) throw new Error("Análise de licitação não encontrada");

  const participacao = await participacaoPreparadaRepo.findByLicitacaoExecId(id);
  if (!participacao) {
    throw new Error("Checklist ainda não foi gerado para esta análise");
  }
  return participacao;
}

export async function reprocessarDocumentos(id: string) {
  const exec = await licitacaoExecRepo.findById(id);
  if (!exec) throw new Error("Análise de licitação não encontrada");

  console.log(`[LicitacaoExec] Reprocessando documentos para exec ${id}`);

  await conformidadeRepo.deleteByLicitacaoExecId(id);

  const docsExigidos = await docExigidoRepo.findByLicitacaoExecId(id);

  const prazos = await prazosRepo.findByLicitacaoExecId(id);

  const conformidadeItems = await conformidadeService.verificarConformidade(
    exec.empresaId,
    docsExigidos,
    prazos?.dataSessao
  );

  await conformidadeRepo.createMany(
    conformidadeItems.map((c) => ({
      licitacaoExecId: id,
      empresaId: exec.empresaId,
      documentoExigidoId: c.documentoExigidoId,
      empresaDocumentoId: c.empresaDocumentoId,
      status: c.status,
      observacao: c.observacao,
    }))
  );

  const conformidadesDB = await conformidadeRepo.findByLicitacaoExecId(id);

  const checklist = participacaoPreparator.gerarChecklist(
    docsExigidos,
    conformidadesDB as any
  );

  const statusFinal = participacaoPreparator.determinarStatus(checklist);

  await participacaoPreparadaRepo.upsert(id, exec.empresaId, {
    documentosOk: checklist.aptoParaParticipar,
    checklist: checklist as any,
    prontoParaEnvio: checklist.aptoParaParticipar,
  });

  await licitacaoExecRepo.updateStatus(id, statusFinal);

  console.log(
    `[LicitacaoExec] Reprocessamento concluído: ${statusFinal}`
  );

  return obterVisaoGeral(id);
}

export async function listar(empresaId?: string) {
  return licitacaoExecRepo.findAll(empresaId);
}
