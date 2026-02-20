import * as participacaoRepo from "../repositories/participacaoRepository.js";
import * as empresaRepo from "../repositories/empresaRepository.js";
import * as licitacaoRepo from "../repositories/licitacaoRepository.js";
import * as docExigidoRepo from "../modules/licitacaoExec/repositories/documentoExigidoRepository.js";
import * as conformidadeRepo from "../modules/licitacaoExec/repositories/conformidadeRepository.js";
import * as prazosRepo from "../modules/licitacaoExec/repositories/prazosRepository.js";

import { parsePncpId, buscarArquivosCompra, encontrarEditalPdf } from "../clients/pncpClient.js";
import * as editalParser from "../modules/licitacaoExec/services/editalParserService.js";
import * as requisitosExtractor from "../modules/licitacaoExec/services/requisitosExtractorService.js";
import * as prazosExtractor from "../modules/licitacaoExec/services/prazosExtractorService.js";
import * as conformidadeService from "../modules/licitacaoExec/services/conformidadeService.js";
import * as participacaoPreparator from "../modules/licitacaoExec/services/participacaoPreparatorService.js";

import { buscarEditalNoPortal, type OnProgresso } from "./portalScraperService.js";
import { ParticipacaoStatus } from "../generated/prisma/client.js";

const STATUS_VALIDOS = new Set<string>(Object.values(ParticipacaoStatus));

async function resolverEditalUrl(pncpId: string, _orgao?: string): Promise<string | null> {
  const parsed = parsePncpId(pncpId);
  if (!parsed) return null;

  try {
    const arquivos = await buscarArquivosCompra(parsed.cnpj, parsed.ano, parsed.sequencial);
    return encontrarEditalPdf(arquivos);
  } catch (err) {
    console.warn(`[Participacao] Falha ao buscar arquivos PNCP:`, err);
    return null;
  }
}

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

  let editalUrl = params.editalUrl || licitacao.linkEdital || "";

  if (!editalUrl && licitacao.pncpId) {
    console.log(`[Participacao] Buscando URL do edital via API PNCP para ${licitacao.pncpId}`);
    editalUrl = await resolverEditalUrl(licitacao.pncpId, licitacao.orgao) ?? "";
  }

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

async function executarPipelineAnalise(
  participacaoId: string,
  empresaId: string,
  textoEdital: string,
  emit?: OnProgresso
) {
  emit?.({ etapa: "texto", mensagem: `Texto extraído: ${textoEdital.length.toLocaleString()} caracteres`, tipo: "sucesso" });
  await participacaoRepo.update(participacaoId, { editalTexto: textoEdital });

  emit?.({ etapa: "requisitos", mensagem: "Identificando documentos exigidos no edital...", tipo: "info" });
  const requisitosExtraidos = requisitosExtractor.extrairRequisitos(textoEdital);
  emit?.({ etapa: "requisitos", mensagem: `${requisitosExtraidos.length} documento(s) exigido(s) encontrado(s)`, tipo: "sucesso" });

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

  emit?.({ etapa: "prazos", mensagem: "Extraindo prazos e datas do edital...", tipo: "info" });
  const prazosExtraidos = prazosExtractor.extrairPrazos(textoEdital);
  const prazosEncontrados = [
    prazosExtraidos.dataAbertura && "Abertura",
    prazosExtraidos.dataSessao && "Sessão",
    prazosExtraidos.prazoImpugnacao && "Impugnação",
    prazosExtraidos.prazoEsclarecimento && "Esclarecimento",
    prazosExtraidos.prazoRecurso && "Recurso",
  ].filter(Boolean);
  emit?.({
    etapa: "prazos",
    mensagem: prazosEncontrados.length > 0
      ? `Prazos encontrados: ${prazosEncontrados.join(", ")}`
      : "Nenhum prazo identificado",
    tipo: prazosEncontrados.length > 0 ? "sucesso" : "detalhe",
  });

  await prazosRepo.upsert(participacaoId, {
    dataAbertura: prazosExtraidos.dataAbertura ?? null,
    dataSessao: prazosExtraidos.dataSessao ?? null,
    prazoImpugnacao: prazosExtraidos.prazoImpugnacao ?? null,
    prazoEsclarecimento: prazosExtraidos.prazoEsclarecimento ?? null,
    prazoRecurso: prazosExtraidos.prazoRecurso ?? null,
  });

  emit?.({ etapa: "conformidade", mensagem: "Verificando documentos da empresa vs. exigidos...", tipo: "info" });
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

  const ok = conformidadeItems.filter((c) => c.status === "OK").length;
  emit?.({
    etapa: "conformidade",
    mensagem: `${ok}/${conformidadeItems.length} documentos em conformidade`,
    tipo: ok === conformidadeItems.length ? "sucesso" : "info",
  });

  emit?.({ etapa: "checklist", mensagem: "Gerando checklist final...", tipo: "info" });
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

  emit?.({
    etapa: "concluido",
    mensagem: `Análise concluída! ${checklist.totalOk}/${checklist.totalExigidos} docs OK — ${checklist.percentualConformidade}% conformidade — Status: ${novoStatus}`,
    tipo: "sucesso",
  });

  console.log(
    `[Participacao] Análise concluída: ${novoStatus} — ${checklist.totalOk}/${checklist.totalExigidos} docs OK (${checklist.percentualConformidade}%)`
  );
}

async function analisarEdital(
  participacaoId: string,
  empresaId: string,
  editalUrl: string
) {
  console.log(`[Participacao] Iniciando análise de edital (URL) para participação ${participacaoId}`);
  const textoEdital = await editalParser.processarEdital(editalUrl);
  await executarPipelineAnalise(participacaoId, empresaId, textoEdital);
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

async function limparAnaliseAnterior(id: string) {
  await conformidadeRepo.deleteByParticipacaoId(id);
  await docExigidoRepo.deleteByParticipacaoId(id);
  await participacaoRepo.update(id, {
    editalTexto: null,
    status: "ANALISANDO",
    documentosOk: false,
    checklist: null as any,
    percentualConformidade: 0,
  });
}

export async function analisarEditalManual(id: string, editalUrl: string) {
  const participacao = await participacaoRepo.findById(id);
  if (!participacao) throw new Error("Participação não encontrada");

  if (!editalUrl || typeof editalUrl !== "string" || !editalUrl.startsWith("http")) {
    throw new Error("URL do edital inválida");
  }

  await limparAnaliseAnterior(id);
  await participacaoRepo.update(id, { editalUrl });
  await analisarEdital(id, participacao.empresaId, editalUrl);

  return participacaoRepo.findById(id);
}

export async function analisarEditalUpload(id: string, pdfBuffer: Buffer, nomeArquivo: string) {
  const participacao = await participacaoRepo.findById(id);
  if (!participacao) throw new Error("Participação não encontrada");

  console.log(`[Participacao] Iniciando análise de edital (upload: ${nomeArquivo}) para participação ${id}`);

  await limparAnaliseAnterior(id);
  await participacaoRepo.update(id, { editalUrl: `upload://${nomeArquivo}` });

  const textoRaw = await editalParser.extrairTexto(pdfBuffer);
  const textoEdital = editalParser.limparTexto(textoRaw);

  await executarPipelineAnalise(id, participacao.empresaId, textoEdital);

  return participacaoRepo.findById(id);
}

export async function buscarEditalViaRobo(id: string, emit?: OnProgresso) {
  const participacao = await participacaoRepo.findById(id);
  if (!participacao) throw new Error("Participação não encontrada");

  const licitacao = participacao.licitacao
    ? participacao.licitacao
    : await licitacaoRepo.findById(participacao.licitacaoId);

  const portalUrl = participacao.portalLink
    || (licitacao as any)?.linkPortal
    || "";

  if (!portalUrl) {
    emit?.({ etapa: "erro", mensagem: "Sem link do portal para navegar", tipo: "erro" });
    throw new Error("Sem link do portal para navegar. Informe a URL manualmente ou faça upload do PDF.");
  }

  console.log(`[Participacao] Iniciando busca via robô para participação ${id} — URL: ${portalUrl}`);

  await limparAnaliseAnterior(id);
  await participacaoRepo.update(id, {
    editalUrl: "",
    observacoes: `${participacao.observacoes}\n[Robô] Buscando edital em: ${portalUrl}`.trim(),
  });

  const resultado = await buscarEditalNoPortal(portalUrl, emit);

  console.log(`[Participacao] Robô encontrou PDF via ${resultado.metodo}: ${resultado.fonteUrl} (${resultado.pdfBuffer.length} bytes)`);

  await participacaoRepo.update(id, { editalUrl: resultado.fonteUrl });

  emit?.({ etapa: "leitura", mensagem: "Extraindo texto do PDF...", tipo: "info" });
  const textoRaw = await editalParser.extrairTexto(resultado.pdfBuffer);
  const textoEdital = editalParser.limparTexto(textoRaw);

  await executarPipelineAnalise(id, participacao.empresaId, textoEdital, emit);

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
