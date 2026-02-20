import { env } from "../config/env.js";

export interface PncpContratacaoResponse {
  numeroControlePNCP: string;
  numeroCompra: string;
  objetoCompra: string;

  orgaoEntidade: {
    cnpj: string;
    razaoSocial: string;
    esferaId: string;
    poderId: string;
  };

  unidadeOrgao: {
    ufNome: string;
    ufSigla: string;
    municipioNome: string;
    codigoUnidade: string;
    nomeUnidade: string;
    codigoIbge: string;
  };

  modalidadeId: number;
  modalidadeNome: string;

  valorTotalEstimado: number | null;
  valorTotalHomologado: number | null;

  dataPublicacaoPncp: string;
  dataInclusao: string;
  dataAtualizacao: string;
  dataAberturaProposta: string | null;
  dataEncerramentoProposta: string | null;

  situacaoCompraId: number;
  situacaoCompraNome: string;

  linkSistemaOrigem: string | null;
  linkProcesso: string | null;

  srp: boolean;
  informacaoComplementar: string | null;
  amparoLegal: { descricao: string; nome: string } | null;
}

interface PncpEnvelope {
  data: PncpContratacaoResponse[];
  totalRegistros: number;
  totalPaginas: number;
  numeroPagina: number;
  paginasRestantes: number;
  empty: boolean;
}

export interface PncpFiltros {
  dataInicial: string;
  dataFinal: string;
  uf?: string;
  codigoModalidade?: number;
  paginas?: number;
  apenasPropostasAbertas?: boolean;
}

// Modalidades PNCP: 1-Leilão Eletrônico, 2-Diálogo Competitivo, 3-Concurso,
// 4-Concorrência Eletrônica, 5-Concorrência Presencial, 6-Pregão Eletrônico,
// 7-Pregão Presencial, 8-Dispensa, 9-Inexigibilidade, 10-Manifestação,
// 11-Pré-qualificação, 12-Credenciamento, 13-Leilão Presencial
const TODAS_MODALIDADES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 4000];

async function fetchComRetry(url: string, tentativa = 0): Promise<Response> {
  const response = await fetch(url, {
    headers: {
      "Accept": "*/*",
      "User-Agent": "licitacoes-mvp/1.0",
    },
  });

  if (response.ok) return response;

  if ([422, 500, 504].includes(response.status) && tentativa < MAX_RETRIES) {
    const delay = RETRY_DELAYS[tentativa] ?? 4000;
    console.log(`[PNCP] Retry ${tentativa + 1}/${MAX_RETRIES} após status ${response.status}, aguardando ${delay}ms...`);
    await new Promise((r) => setTimeout(r, delay));
    return fetchComRetry(url, tentativa + 1);
  }

  if (response.status === 400) {
    throw new Error("Parâmetros inválidos para PNCP");
  }

  throw new Error(`Erro ao consultar PNCP (status ${response.status})`);
}

async function buscarPorModalidade(
  filtros: PncpFiltros,
  codigoModalidade: number,
  maxPaginas: number
): Promise<PncpContratacaoResponse[]> {
  const endpoint = filtros.apenasPropostasAbertas
    ? "contratacoes/proposta"
    : "contratacoes/publicacao";

  const baseUrl = `${env.PNCP_BASE_URL}/${endpoint}`;
  const tamanhoPagina = 50;
  const items: PncpContratacaoResponse[] = [];
  let pagina = 1;
  let totalPaginas = 1;

  while (pagina <= Math.min(totalPaginas, maxPaginas)) {
    const params = new URLSearchParams({
      dataInicial: filtros.dataInicial,
      dataFinal: filtros.dataFinal,
      pagina: String(pagina),
      tamanhoPagina: String(tamanhoPagina),
      codigoModalidadeContratacao: String(codigoModalidade),
    });

    if (filtros.uf) params.set("uf", filtros.uf);

    const url = `${baseUrl}?${params.toString()}`;
    console.log(`[PNCP] Modalidade ${codigoModalidade}, página ${pagina}...`);

    let response: Response;
    try {
      response = await fetchComRetry(url);
    } catch (err) {
      if (pagina === 1) {
        console.warn(`[PNCP] Modalidade ${codigoModalidade} falhou:`, (err as Error).message);
        return items;
      }
      console.warn(`[PNCP] Erro na página ${pagina}, parando:`, (err as Error).message);
      break;
    }

    const envelope = (await response.json()) as PncpEnvelope;

    if (envelope.empty || !envelope.data || envelope.data.length === 0) {
      break;
    }

    items.push(...envelope.data);
    totalPaginas = envelope.totalPaginas;

    console.log(
      `[PNCP] Página ${pagina}/${totalPaginas}: ${envelope.data.length} itens (acumulado modalidade: ${items.length})`
    );

    pagina++;
  }

  return items;
}

export async function buscarContratacoes(
  filtros: PncpFiltros
): Promise<PncpContratacaoResponse[]> {
  const maxPaginas = filtros.paginas ?? 999;

  if (filtros.codigoModalidade) {
    return buscarPorModalidade(filtros, filtros.codigoModalidade, maxPaginas);
  }

  // Sem modalidade especificada: buscar as mais relevantes (6=Pregão Eletrônico, 4=Concorrência, 8=Dispensa)
  const modalidadesPrioritarias = [6, 4, 8];
  const allItems: PncpContratacaoResponse[] = [];

  for (const mod of modalidadesPrioritarias) {
    const items = await buscarPorModalidade(filtros, mod, maxPaginas);
    allItems.push(...items);
    console.log(`[PNCP] Modalidade ${mod}: ${items.length} itens. Total acumulado: ${allItems.length}`);
  }

  return allItems;
}
