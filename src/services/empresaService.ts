import { Prisma } from "../generated/prisma/client.js";
import { consultarCnpj } from "../clients/brasilApiClient.js";
import * as empresaRepo from "../repositories/empresaRepository.js";
import * as matchRepo from "../repositories/licitacaoMatchRepository.js";
import { processarTexto, extrairStemsDeTextos } from "../utils/text.js";
import { calcularScoreComposto } from "../utils/score.js";
import * as embeddingService from "./embeddingService.js";
import prisma from "../lib/prisma.js";

export async function cadastrarPorCnpj(cnpjRaw: string) {
  const cnpj = cnpjRaw.replace(/[.\-/]/g, "");

  if (!/^\d{14}$/.test(cnpj)) {
    throw new Error("CNPJ inválido — deve conter 14 dígitos numéricos");
  }

  const existente = await empresaRepo.findByCnpj(cnpj);
  if (existente) {
    throw new Error("Empresa já cadastrada com este CNPJ");
  }

  const dados = await consultarCnpj(cnpj);

  const descricoesCnae = [
    dados.cnae_fiscal_descricao,
    ...dados.cnaes_secundarios.map((c) => c.descricao),
  ];
  const stemsCnae = extrairStemsDeTextos(descricoesCnae);

  const empresaData: any = {
    cnpj: dados.cnpj,
    razaoSocial: dados.razao_social,
    nomeFantasia: dados.nome_fantasia ?? "",
    cnaePrincipal: String(dados.cnae_fiscal),
    cnaePrincipalDescricao: dados.cnae_fiscal_descricao,
    cnaesSecundarios: dados.cnaes_secundarios as unknown as Prisma.InputJsonValue,
    uf: dados.uf ?? "",
    municipio: dados.municipio ?? "",
    situacaoCadastral: dados.descricao_situacao_cadastral ?? "",
    stemsCnae,
  };

  // Gerar embedding do perfil da empresa
  if (embeddingService.isDisponivel()) {
    const textoEmpresa = embeddingService.montarTextoEmpresa({
      razaoSocial: dados.razao_social,
      cnaePrincipalDescricao: dados.cnae_fiscal_descricao,
      cnaesSecundarios: dados.cnaes_secundarios,
      palavrasChave: [],
    });
    try {
      empresaData.embedding = await embeddingService.gerarEmbedding(textoEmpresa);
      console.log(`[Empresa] Embedding gerado (${empresaData.embedding.length} dims)`);
    } catch (err) {
      console.warn("[Empresa] Falha ao gerar embedding:", err instanceof Error ? err.message : err);
    }
  }

  const empresa = await empresaRepo.create(empresaData);

  await recalcularMatchesEmpresa(empresa.id);

  return empresa;
}

export async function atualizarPreferencias(
  id: string,
  prefs: {
    palavrasChave?: string[];
    ufsInteresse?: string[];
    modalidadesInteresse?: string[];
    valorMinimo?: number;
    valorMaximo?: number;
  }
) {
  const empresa = await empresaRepo.findById(id);
  if (!empresa) {
    throw new Error("Empresa não encontrada");
  }

  const updateData: Record<string, unknown> = {};

  if (prefs.palavrasChave !== undefined) {
    updateData.palavrasChave = prefs.palavrasChave;
    updateData.stemsChave = processarTexto(prefs.palavrasChave.join(" "));
  }
  if (prefs.ufsInteresse !== undefined) {
    updateData.ufsInteresse = prefs.ufsInteresse;
  }
  if (prefs.modalidadesInteresse !== undefined) {
    updateData.modalidadesInteresse = prefs.modalidadesInteresse;
  }
  if (prefs.valorMinimo !== undefined) {
    updateData.valorMinimo = prefs.valorMinimo;
  }
  if (prefs.valorMaximo !== undefined) {
    updateData.valorMaximo = prefs.valorMaximo;
  }

  // Regenerar embedding se palavras-chave mudaram
  if (prefs.palavrasChave !== undefined && embeddingService.isDisponivel()) {
    try {
      const textoEmpresa = embeddingService.montarTextoEmpresa({
        razaoSocial: empresa.razaoSocial,
        cnaePrincipalDescricao: empresa.cnaePrincipalDescricao,
        cnaesSecundarios: empresa.cnaesSecundarios,
        palavrasChave: prefs.palavrasChave,
      });
      updateData.embedding = await embeddingService.gerarEmbedding(textoEmpresa);
    } catch (err) {
      console.warn("[Empresa] Falha ao regenerar embedding:", err instanceof Error ? err.message : err);
    }
  }

  const atualizada = await empresaRepo.update(id, updateData);

  await recalcularMatchesEmpresa(id);

  return atualizada;
}

export async function listarEmpresas() {
  return empresaRepo.findAll();
}

export async function obterEmpresa(id: string) {
  const empresa = await empresaRepo.findById(id);
  if (!empresa) {
    throw new Error("Empresa não encontrada");
  }
  return empresa;
}

export async function obterMatches(
  empresaId: string,
  options: {
    scoreMin?: number;
    apenasAbertas?: boolean;
    status?: "NOVO" | "FAVORITO" | "DESCARTADO";
    excluirDescartados?: boolean;
    limit?: number;
  }
) {
  const empresa = await empresaRepo.findById(empresaId);
  if (!empresa) {
    throw new Error("Empresa não encontrada");
  }

  return matchRepo.findByEmpresaId(empresaId, options);
}

export async function recalcularMatchesEmpresa(empresaId: string) {
  const empresa = await empresaRepo.findById(empresaId);
  if (!empresa) return 0;

  await matchRepo.deleteByEmpresaId(empresaId);

  const stemsEmpresa = [
    ...new Set([...empresa.stemsCnae, ...empresa.stemsChave]),
  ];

  if (stemsEmpresa.length === 0 && empresa.embedding.length === 0) return 0;

  const licitacoes = await prisma.licitacao.findMany();

  const embEmpresa = empresa.embedding;

  let count = 0;
  for (const lic of licitacoes) {
    let scoreSemantico = 0;
    if (embEmpresa.length > 0 && lic.embedding.length > 0) {
      const raw = embeddingService.similaridadeCosseno(embEmpresa, lic.embedding);
      scoreSemantico = Math.max(0, raw);
    }

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
      scoreSemantico,
    });

    if (result.score > 0) {
      await matchRepo.upsert(empresaId, lic.id, {
        score: result.score,
        scoreTextual: result.scoreTextual,
        scoreSemantico: result.scoreSemantico,
        scoreGeografico: result.scoreGeografico,
        scoreValor: result.scoreValor,
        palavrasMatch: result.palavrasMatch,
      });
      count++;
    }
  }

  return count;
}
