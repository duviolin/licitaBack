import * as participacaoRepo from "../repositories/participacaoRepository.js";
import * as empresaRepo from "../repositories/empresaRepository.js";
import * as licitacaoRepo from "../repositories/licitacaoRepository.js";
import * as docExigidoRepo from "../modules/licitacaoExec/repositories/documentoExigidoRepository.js";
import * as conformidadeRepo from "../modules/licitacaoExec/repositories/conformidadeRepository.js";
import * as prazosRepo from "../modules/licitacaoExec/repositories/prazosRepository.js";

import type { DocumentoTipo } from "../generated/prisma/client.js";
import { parsePncpId, buscarArquivosCompra, encontrarEditalPdf } from "../clients/pncpClient.js";
import * as editalParser from "../modules/licitacaoExec/services/editalParserService.js";
import * as requisitosExtractor from "../modules/licitacaoExec/services/requisitosExtractorService.js";
import * as prazosExtractor from "../modules/licitacaoExec/services/prazosExtractorService.js";
import * as conformidadeService from "../modules/licitacaoExec/services/conformidadeService.js";
import * as participacaoPreparator from "../modules/licitacaoExec/services/participacaoPreparatorService.js";

import { buscarEditalNoPortal, type OnProgresso, type DocumentoEncontrado } from "./portalScraperService.js";
import * as llmService from "./llmService.js";
import * as docProcessoRepo from "../repositories/documentoProcessoRepository.js";
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

  const participacao = await participacaoRepo.create({
    empresaId: params.empresaId,
    licitacaoId: params.licitacaoId,
    valorProposta: params.valorProposta ?? null,
    observacoes: params.observacoes ?? "",
    editalUrl: "",
    portalLink: params.portalLink || licitacao.linkPortal || "",
  });

  return participacaoRepo.findById(participacao.id);
}

async function executarPipelineAnalise(
  participacaoId: string,
  empresaId: string,
  textoEdital: string,
  emit?: OnProgresso
) {
  let usouLLM = false;

  emit?.({ etapa: "texto", mensagem: `Texto extraído: ${textoEdital.length.toLocaleString()} caracteres`, tipo: "sucesso" });
  await participacaoRepo.update(participacaoId, { editalTexto: textoEdital });

  // --- 1. Requisitos (LLM first, regex fallback) ---
  emit?.({ etapa: "requisitos", mensagem: "Identificando documentos exigidos no edital...", tipo: "info" });

  let requisitosExtraidos;
  if (llmService.isLLMDisponivel()) {
    emit?.({ etapa: "requisitos", mensagem: "Usando IA para análise inteligente de requisitos...", tipo: "detalhe" });
    const llmResult = await llmService.extrairRequisitosViaLLM(textoEdital);
    if (llmResult && llmResult.documentos.length > 0) {
      requisitosExtraidos = llmResult.documentos;
      usouLLM = true;
      emit?.({ etapa: "requisitos", mensagem: `IA encontrou ${requisitosExtraidos.length} documento(s) exigido(s)`, tipo: "sucesso" });
    } else {
      emit?.({ etapa: "requisitos", mensagem: "IA não retornou resultados, usando extração por regex...", tipo: "detalhe" });
      requisitosExtraidos = requisitosExtractor.extrairRequisitos(textoEdital);
    }
  } else {
    requisitosExtraidos = requisitosExtractor.extrairRequisitos(textoEdital);
  }

  emit?.({ etapa: "requisitos", mensagem: `${requisitosExtraidos.length} documento(s) exigido(s) encontrado(s)${usouLLM ? " (via IA)" : " (via regex)"}`, tipo: "sucesso" });

  const docsExigidos = await docExigidoRepo.createMany(
    requisitosExtraidos.map((r) => ({
      participacaoId,
      tipo: r.tipo as DocumentoTipo,
      nome: r.nome,
      secaoEdital: r.secaoEdital,
      obrigatorio: r.obrigatorio,
      validadeDias: r.validadeDias ?? null,
      autenticacaoExigida: r.autenticacaoExigida,
      referenciaEdital: r.referenciaEdital,
    }))
  );

  // --- 2. Prazos (LLM first, regex fallback) ---
  emit?.({ etapa: "prazos", mensagem: "Extraindo prazos e datas do edital...", tipo: "info" });

  let prazosExtraidos;
  let prazosViaLLM = false;
  if (llmService.isLLMDisponivel()) {
    emit?.({ etapa: "prazos", mensagem: "Usando IA para interpretar prazos e datas...", tipo: "detalhe" });
    const llmPrazos = await llmService.extrairPrazosViaLLM(textoEdital);
    if (llmPrazos) {
      const temAlgum = Object.values(llmPrazos.prazos).some((v) => v !== undefined);
      if (temAlgum) {
        prazosExtraidos = llmPrazos.prazos;
        prazosViaLLM = true;
        usouLLM = true;
      }
    }
    if (!prazosViaLLM) {
      emit?.({ etapa: "prazos", mensagem: "IA não encontrou prazos, usando regex...", tipo: "detalhe" });
      prazosExtraidos = prazosExtractor.extrairPrazos(textoEdital);
    }
  } else {
    prazosExtraidos = prazosExtractor.extrairPrazos(textoEdital);
  }

  const prazosEncontrados = [
    prazosExtraidos!.dataAbertura && "Abertura",
    prazosExtraidos!.dataSessao && "Sessão",
    prazosExtraidos!.prazoImpugnacao && "Impugnação",
    prazosExtraidos!.prazoEsclarecimento && "Esclarecimento",
    prazosExtraidos!.prazoRecurso && "Recurso",
  ].filter(Boolean);
  emit?.({
    etapa: "prazos",
    mensagem: prazosEncontrados.length > 0
      ? `Prazos encontrados${prazosViaLLM ? " (via IA)" : ""}: ${prazosEncontrados.join(", ")}`
      : "Nenhum prazo identificado",
    tipo: prazosEncontrados.length > 0 ? "sucesso" : "detalhe",
  });

  await prazosRepo.upsert(participacaoId, {
    dataAbertura: prazosExtraidos!.dataAbertura ?? null,
    dataSessao: prazosExtraidos!.dataSessao ?? null,
    prazoImpugnacao: prazosExtraidos!.prazoImpugnacao ?? null,
    prazoEsclarecimento: prazosExtraidos!.prazoEsclarecimento ?? null,
    prazoRecurso: prazosExtraidos!.prazoRecurso ?? null,
  });

  // --- 3. Resumo executivo via LLM ---
  let resumoEdital = null;
  if (llmService.isLLMDisponivel()) {
    emit?.({ etapa: "resumo", mensagem: "Gerando resumo executivo do edital com IA...", tipo: "info" });
    const resumoResult = await llmService.gerarResumoEdital(textoEdital);
    if (resumoResult) {
      resumoEdital = resumoResult;
      usouLLM = true;
      emit?.({ etapa: "resumo", mensagem: "Resumo executivo gerado com sucesso", tipo: "sucesso" });
    } else {
      emit?.({ etapa: "resumo", mensagem: "Não foi possível gerar resumo", tipo: "detalhe" });
    }
  }

  await participacaoRepo.update(participacaoId, {
    resumoEdital: resumoEdital as any,
    usouLLM,
  });

  // --- 4. Conformidade (com matching semântico + sugestões via IA) ---
  emit?.({ etapa: "conformidade", mensagem: "Verificando documentos da empresa vs. exigidos...", tipo: "info" });
  if (llmService.isLLMDisponivel()) {
    emit?.({ etapa: "conformidade", mensagem: "Usando IA para matching semântico e sugestões...", tipo: "detalhe" });
  }
  const conformidadeItems = await conformidadeService.verificarConformidade(
    empresaId,
    docsExigidos,
    prazosExtraidos!.dataSessao
  );

  await conformidadeRepo.createMany(
    conformidadeItems.map((c) => ({
      participacaoId,
      empresaId,
      documentoExigidoId: c.documentoExigidoId,
      empresaDocumentoId: c.empresaDocumentoId,
      status: c.status,
      observacao: c.observacao,
      sugestao: c.sugestao,
    }))
  );

  const ok = conformidadeItems.filter((c) => c.status === "OK").length;
  const comSugestao = conformidadeItems.filter((c) => c.sugestao).length;
  emit?.({
    etapa: "conformidade",
    mensagem: `${ok}/${conformidadeItems.length} documentos em conformidade${comSugestao > 0 ? ` — ${comSugestao} sugestão(ões) gerada(s)` : ""}`,
    tipo: ok === conformidadeItems.length ? "sucesso" : "info",
  });

  // --- 5. Checklist ---
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

  // --- 6. Análise de Risco (Fase IA 4.1) ---
  let analiseRisco = null;
  let scoreRecomendacao: number | null = null;
  let rascunhoProposta: string | null = null;

  if (llmService.isLLMDisponivel()) {
    emit?.({ etapa: "risco", mensagem: "Analisando riscos do edital com IA...", tipo: "info" });
    analiseRisco = await llmService.analisarRiscoEdital(textoEdital);
    if (analiseRisco) {
      usouLLM = true;
      emit?.({
        etapa: "risco",
        mensagem: `Risco: ${analiseRisco.nivelRisco.toUpperCase()} (${analiseRisco.scoreRisco}/100) — ${analiseRisco.riscos.length} risco(s) identificado(s)`,
        tipo: analiseRisco.nivelRisco === "critico" || analiseRisco.nivelRisco === "alto" ? "erro" : "sucesso",
      });
    }

    // --- 7. Score de Recomendação (Fase IA 4.2) ---
    emit?.({ etapa: "recomendacao", mensagem: "Gerando recomendação de participação...", tipo: "info" });
    const empresa = await empresaRepo.findById(empresaId);
    const perfilEmpresa = empresa
      ? `${empresa.razaoSocial} — CNAE: ${empresa.cnaePrincipalDescricao} — UF: ${empresa.uf} — Palavras-chave: ${empresa.palavrasChave.join(", ") || "nenhuma"}`
      : "Perfil não disponível";

    const recomendacao = await llmService.gerarRecomendacao(
      textoEdital,
      perfilEmpresa,
      checklist.percentualConformidade,
      analiseRisco?.scoreRisco ?? 50
    );
    if (recomendacao) {
      scoreRecomendacao = recomendacao.score;
      emit?.({
        etapa: "recomendacao",
        mensagem: `Recomendação: ${recomendacao.recomendacao.toUpperCase()} (${recomendacao.score}/100) — ${recomendacao.justificativa}`,
        tipo: recomendacao.recomendacao === "evitar" ? "erro" : "sucesso",
      });
    }

    // --- 8. Rascunho de Proposta (Fase IA 4.3) ---
    emit?.({ etapa: "proposta", mensagem: "Gerando rascunho de proposta...", tipo: "info" });
    rascunhoProposta = await llmService.gerarRascunhoProposta(textoEdital, perfilEmpresa);
    if (rascunhoProposta) {
      emit?.({ etapa: "proposta", mensagem: "Rascunho de proposta gerado com sucesso", tipo: "sucesso" });
    }

    await participacaoRepo.update(participacaoId, {
      analiseRisco: analiseRisco as any,
      scoreRecomendacao,
      rascunhoProposta,
      usouLLM,
    });
  }

  const metodo = usouLLM ? " (com IA)" : " (regex)";
  emit?.({
    etapa: "concluido",
    mensagem: `Análise concluída${metodo}! ${checklist.totalOk}/${checklist.totalExigidos} docs OK — ${checklist.percentualConformidade}% conformidade — Status: ${novoStatus}`,
    tipo: "sucesso",
  });

  console.log(
    `[Participacao] Análise concluída${metodo}: ${novoStatus} — ${checklist.totalOk}/${checklist.totalExigidos} docs OK (${checklist.percentualConformidade}%)`
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
      sugestao: c.sugestao,
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
  await docProcessoRepo.deleteByParticipacaoId(id);
  await participacaoRepo.update(id, {
    editalTexto: null,
    status: "ANALISANDO",
    documentosOk: false,
    checklist: null as any,
    percentualConformidade: 0,
    resumoEdital: null as any,
    usouLLM: false,
    analiseRisco: null as any,
    scoreRecomendacao: null,
    rascunhoProposta: null,
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

export async function analisarDocumentosUpload(
  id: string,
  arquivos: Array<{ buffer: Buffer; nomeArquivo: string }>
) {
  const participacao = await participacaoRepo.findById(id);
  if (!participacao) throw new Error("Participação não encontrada");

  const jaTemAnalise = !!participacao.editalTexto;
  console.log(`[Participacao] Upload manual de ${arquivos.length} documento(s) para participação ${id} (incremental: ${jaTemAnalise})`);

  // Classificar os novos arquivos via LLM
  const docsParaClassificar = arquivos.map((a, i) => ({
    indice: i,
    nomeArquivo: a.nomeArquivo,
  }));

  let classificacoes: Awaited<ReturnType<typeof llmService.classificarDocumentosProcesso>> = [];
  if (llmService.isLLMDisponivel()) {
    classificacoes = await llmService.classificarDocumentosProcesso(docsParaClassificar);
  }

  // Salvar metadados dos novos documentos (sem apagar os existentes)
  const docsParaSalvar = arquivos.map((a, i) => {
    const classif = classificacoes.find((c) => c.indice === i);
    return {
      participacaoId: id,
      nomeArquivo: a.nomeArquivo,
      tipo: (classif?.tipo || "OUTRO") as any,
      classificacaoIA: classif?.tipo || "",
      urlDownload: "",
      resumo: classif?.resumo || "",
      relevancia: classif?.relevancia || "normal",
      analisado: true,
      tamanhoBytes: a.buffer.length,
    };
  });
  await docProcessoRepo.createMany(docsParaSalvar);

  // Extrair texto dos novos PDFs
  const novosTextos: string[] = [];
  for (const arq of arquivos) {
    try {
      const textoRaw = await editalParser.extrairTexto(arq.buffer);
      const texto = editalParser.limparTexto(textoRaw);
      if (texto.length > 50) novosTextos.push(texto);
    } catch (err) {
      console.warn(`[Participacao] Falha ao extrair texto de "${arq.nomeArquivo}":`, err);
    }
  }

  if (novosTextos.length === 0) {
    throw new Error("Nenhum dos arquivos enviados contém texto extraível");
  }

  // Re-analisar tudo: texto existente + novos documentos
  const separador = "\n\n=== DOCUMENTO COMPLEMENTAR ===\n\n";
  let textoCompleto: string;

  if (jaTemAnalise && participacao.editalTexto) {
    textoCompleto = participacao.editalTexto + separador + novosTextos.join(separador);
  } else {
    textoCompleto = novosTextos.join(separador);
  }

  // Limpar análise anterior (requisitos, conformidade) mas manter documentosProcesso
  await conformidadeRepo.deleteByParticipacaoId(id);
  await docExigidoRepo.deleteByParticipacaoId(id);
  await participacaoRepo.update(id, {
    status: "ANALISANDO",
    documentosOk: false,
    checklist: null as any,
    percentualConformidade: 0,
    resumoEdital: null as any,
    usouLLM: false,
    editalUrl: participacao.editalUrl || `upload://${arquivos.length}-documentos`,
  });

  await executarPipelineAnalise(id, participacao.empresaId, textoCompleto);

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

  // --- Classificar e salvar TODOS os documentos do processo ---
  if (resultado.todosDocumentos.length > 0) {
    emit?.({ etapa: "documentos", mensagem: `${resultado.todosDocumentos.length} documento(s) encontrado(s) no processo`, tipo: "info" });
    await classificarESalvarDocumentos(id, resultado.todosDocumentos, emit);
  }

  // --- Extrair texto do edital principal ---
  emit?.({ etapa: "leitura", mensagem: "Extraindo texto do edital principal...", tipo: "info" });
  const textoRaw = await editalParser.extrairTexto(resultado.pdfBuffer);
  const textoEdital = editalParser.limparTexto(textoRaw);

  // --- Baixar e analisar documentos complementares ---
  const textosComplementares = await baixarEAnalisarDocumentosComplementares(id, emit);

  // Mergear textos de retificações no edital para a análise final
  let textoCompleto = textoEdital;
  if (textosComplementares.length > 0) {
    emit?.({ etapa: "merge", mensagem: `Integrando ${textosComplementares.length} documento(s) complementar(es) na análise...`, tipo: "info" });
    const separador = "\n\n=== DOCUMENTO COMPLEMENTAR ===\n\n";
    textoCompleto = textoEdital + separador + textosComplementares.join(separador);
  }

  await executarPipelineAnalise(id, participacao.empresaId, textoCompleto, emit);

  return participacaoRepo.findById(id);
}

async function classificarESalvarDocumentos(
  participacaoId: string,
  documentos: DocumentoEncontrado[],
  emit?: OnProgresso
) {
  if (llmService.isLLMDisponivel()) {
    emit?.({ etapa: "documentos", mensagem: "Classificando documentos com IA...", tipo: "detalhe" });

    const paraClassificar = documentos.map((d, i) => ({
      indice: i,
      nomeArquivo: d.nomeArquivo,
      tipoInformado: d.tipoInformado,
      dataPublicacao: d.dataPublicacao,
    }));

    const classificacoes = await llmService.classificarDocumentosProcesso(paraClassificar);

    const docsParaSalvar = documentos.map((d, i) => {
      const classif = classificacoes.find((c) => c.indice === i);
      return {
        participacaoId,
        nomeArquivo: d.nomeArquivo,
        tipo: (classif?.tipo || "OUTRO") as any,
        classificacaoIA: classif?.tipo || "",
        urlDownload: d.urlDownload,
        dataPublicacao: d.dataPublicacao,
        resumo: classif?.resumo || "",
        relevancia: classif?.relevancia || "normal",
      };
    });

    await docProcessoRepo.createMany(docsParaSalvar);

    const criticos = docsParaSalvar.filter((d) => d.relevancia === "critica" && d.tipo !== "EDITAL");
    if (criticos.length > 0) {
      emit?.({
        etapa: "alerta",
        mensagem: `⚠ ATENÇÃO: ${criticos.length} documento(s) CRÍTICO(s) encontrado(s): ${criticos.map((c) => `"${c.nomeArquivo}" (${c.tipo})`).join(", ")}`,
        tipo: "erro",
      });
      emit?.({
        etapa: "alerta",
        mensagem: "Retificações podem alterar requisitos do edital! Verifique antes de prosseguir.",
        tipo: "erro",
      });
    }

    docsParaSalvar.forEach((d) => {
      const icon = d.relevancia === "critica" ? "🔴" : d.relevancia === "alta" ? "🟡" : "⚪";
      emit?.({ etapa: "documentos", mensagem: `  ${icon} ${d.nomeArquivo} → ${d.tipo} (${d.relevancia})`, tipo: "detalhe" });
    });

    emit?.({ etapa: "documentos", mensagem: `${docsParaSalvar.length} documento(s) classificado(s) e salvos`, tipo: "sucesso" });
  } else {
    const docsParaSalvar = documentos.map((d) => ({
      participacaoId,
      nomeArquivo: d.nomeArquivo,
      tipo: "OUTRO" as any,
      urlDownload: d.urlDownload,
      dataPublicacao: d.dataPublicacao,
    }));
    await docProcessoRepo.createMany(docsParaSalvar);
    emit?.({ etapa: "documentos", mensagem: `${docsParaSalvar.length} documento(s) salvo(s) (sem classificação IA)`, tipo: "detalhe" });
  }
}

const TIPOS_PARA_ANALISAR = new Set(["RETIFICACAO", "ESCLARECIMENTO", "IMPUGNACAO", "TERMO_REFERENCIA"]);

async function baixarEAnalisarDocumentosComplementares(
  participacaoId: string,
  emit?: OnProgresso
): Promise<string[]> {
  const docs = await docProcessoRepo.findByParticipacaoId(participacaoId);
  const complementares = docs.filter(
    (d) => TIPOS_PARA_ANALISAR.has(d.tipo) && d.urlDownload && !d.analisado
  );

  if (complementares.length === 0) return [];

  emit?.({ etapa: "complementares", mensagem: `Baixando e analisando ${complementares.length} documento(s) complementar(es)...`, tipo: "info" });

  const textosExtraidos: string[] = [];

  for (const doc of complementares) {
    try {
      emit?.({ etapa: "complementares", mensagem: `Baixando: ${doc.nomeArquivo}...`, tipo: "detalhe" });

      const response = await fetch(doc.urlDownload, {
        headers: {
          Accept: "application/pdf,application/octet-stream,*/*",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
        redirect: "follow",
      });

      if (!response.ok) {
        emit?.({ etapa: "complementares", mensagem: `Falha ao baixar "${doc.nomeArquivo}": HTTP ${response.status}`, tipo: "erro" });
        continue;
      }

      const arrayBuffer = await response.arrayBuffer();
      const pdfBuffer = Buffer.from(arrayBuffer);

      if (pdfBuffer.length < 200) {
        emit?.({ etapa: "complementares", mensagem: `"${doc.nomeArquivo}" muito pequeno (${pdfBuffer.length} bytes), ignorando`, tipo: "detalhe" });
        continue;
      }

      const sizeMB = (pdfBuffer.length / 1024 / 1024).toFixed(2);
      emit?.({ etapa: "complementares", mensagem: `"${doc.nomeArquivo}" baixado (${sizeMB} MB)`, tipo: "sucesso" });

      // Extrair texto
      const textoRaw = await editalParser.extrairTexto(pdfBuffer);
      const texto = editalParser.limparTexto(textoRaw);

      if (texto.length < 50) {
        emit?.({ etapa: "complementares", mensagem: `"${doc.nomeArquivo}" sem texto extraível`, tipo: "detalhe" });
        continue;
      }

      textosExtraidos.push(texto);

      // Análise de impacto via LLM
      let analiseImpacto = null;
      if (llmService.isLLMDisponivel()) {
        emit?.({ etapa: "complementares", mensagem: `Analisando impacto de "${doc.nomeArquivo}" com IA...`, tipo: "detalhe" });
        analiseImpacto = await llmService.analisarDocumentoComplementar(texto, doc.tipo, doc.nomeArquivo);

        if (analiseImpacto) {
          emit?.({ etapa: "complementares", mensagem: `"${doc.nomeArquivo}": ${analiseImpacto.resumoConteudo}`, tipo: "sucesso" });

          if (analiseImpacto.alteracoes.length > 0) {
            analiseImpacto.alteracoes.forEach((alt) => {
              emit?.({ etapa: "complementares", mensagem: `  → ${alt}`, tipo: "detalhe" });
            });
          }

          if (analiseImpacto.impactoRequisitos) {
            emit?.({ etapa: "alerta", mensagem: `⚠ "${doc.nomeArquivo}" ALTERA requisitos de habilitação!`, tipo: "erro" });
          }
          if (analiseImpacto.impactoPrazos) {
            emit?.({ etapa: "alerta", mensagem: `⚠ "${doc.nomeArquivo}" ALTERA prazos/datas!`, tipo: "erro" });
          }
        }
      }

      // Salvar resultado
      await docProcessoRepo.update(doc.id, {
        analisado: true,
        tamanhoBytes: pdfBuffer.length,
        resumo: analiseImpacto?.resumoConteudo || `Texto extraído (${texto.length} caracteres)`,
        analiseImpacto: analiseImpacto as any,
      });
    } catch (err) {
      emit?.({ etapa: "complementares", mensagem: `Erro ao processar "${doc.nomeArquivo}": ${err instanceof Error ? err.message : err}`, tipo: "erro" });
    }
  }

  emit?.({ etapa: "complementares", mensagem: `${textosExtraidos.length} documento(s) complementar(es) analisado(s)`, tipo: "sucesso" });
  return textosExtraidos;
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
