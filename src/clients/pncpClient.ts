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

export interface PncpProgresso {
  fase: "buscando";
  modalidade: string;
  pagina: number;
  totalPaginas: number;
  itensAcumulados: number;
}

export interface CancelSignal {
  cancelled: boolean;
}

const MODALIDADES_NOMES: Record<number, string> = {
  1: "Leilão Eletrônico", 2: "Diálogo Competitivo", 3: "Concurso",
  4: "Concorrência Eletrônica", 5: "Concorrência Presencial", 6: "Pregão Eletrônico",
  7: "Pregão Presencial", 8: "Dispensa", 9: "Inexigibilidade", 10: "Manifestação",
  11: "Pré-qualificação", 12: "Credenciamento", 13: "Leilão Presencial",
};

export function construirUrlEdital(cnpjOrgao: string, anoCompra: string, sequencialCompra: string): string {
  const seq = sequencialCompra.replace(/\D/g, "");
  return `${env.PNCP_BASE_URL}/orgaos/${cnpjOrgao}/compras/${seq}${anoCompra}/arquivos/1`;
}

export function construirUrlPaginaPncp(cnpjOrgao: string, anoCompra: string, sequencialCompra: string): string {
  const seq = sequencialCompra.replace(/\D/g, "");
  return `https://pncp.gov.br/app/editais/${cnpjOrgao}/${anoCompra}/${seq}`;
}

export function parsePncpId(numeroControlePNCP: string): { cnpj: string; ano: string; sequencial: string } | null {
  const parts = numeroControlePNCP.split("-");
  if (parts.length < 3) return null;
  const cnpj = parts[0];
  const rest = parts.slice(2).join("-");
  const slashIdx = rest.indexOf("/");
  if (slashIdx === -1) return null;
  return {
    cnpj,
    sequencial: rest.slice(0, slashIdx),
    ano: rest.slice(slashIdx + 1),
  };
}

export interface PncpArquivo {
  sequencialDocumento: number;
  uri: string;
  url: string;
  titulo: string;
  tipoDocumentoId: number;
  tipoDocumentoDescricao: string;
}

export async function buscarArquivosCompra(
  cnpjOrgao: string,
  anoCompra: string,
  sequencialCompra: string
): Promise<PncpArquivo[]> {
  const seq = sequencialCompra.replace(/\D/g, "");
  const url = `${env.PNCP_BASE_URL}/orgaos/${cnpjOrgao}/compras/${seq}${anoCompra}/arquivos`;
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "licitacoes-mvp/1.0" },
    });
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export function encontrarEditalPdf(arquivos: PncpArquivo[]): string | null {
  const edital = arquivos.find((a) =>
    a.tipoDocumentoDescricao?.toLowerCase().includes("edital") ||
    a.titulo?.toLowerCase().includes("edital")
  );
  if (edital?.url) return edital.url;
  if (edital?.uri) return `${env.PNCP_BASE_URL}${edital.uri}`;
  if (arquivos.length > 0) {
    const first = arquivos[0];
    if (first.url) return first.url;
    if (first.uri) return `${env.PNCP_BASE_URL}${first.uri}`;
  }
  return null;
}

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
  maxPaginas: number,
  onProgress?: (p: PncpProgresso) => void,
  signal?: CancelSignal,
  acumuladoGlobal = 0,
): Promise<PncpContratacaoResponse[]> {
  const endpoint = filtros.apenasPropostasAbertas
    ? "contratacoes/proposta"
    : "contratacoes/publicacao";

  const baseUrl = `${env.PNCP_BASE_URL}/${endpoint}`;
  const tamanhoPagina = 50;
  const items: PncpContratacaoResponse[] = [];
  let pagina = 1;
  let totalPaginas = 1;
  const nomeModalidade = MODALIDADES_NOMES[codigoModalidade] || `Modalidade ${codigoModalidade}`;

  while (pagina <= Math.min(totalPaginas, maxPaginas)) {
    if (signal?.cancelled) break;

    const params = new URLSearchParams({
      dataInicial: filtros.dataInicial,
      dataFinal: filtros.dataFinal,
      pagina: String(pagina),
      tamanhoPagina: String(tamanhoPagina),
      codigoModalidadeContratacao: String(codigoModalidade),
    });

    if (filtros.uf) params.set("uf", filtros.uf);

    const url = `${baseUrl}?${params.toString()}`;

    onProgress?.({
      fase: "buscando",
      modalidade: nomeModalidade,
      pagina,
      totalPaginas,
      itensAcumulados: acumuladoGlobal + items.length,
    });

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
      `[PNCP] Página ${pagina}/${totalPaginas}: ${envelope.data.length} itens (acumulado: ${acumuladoGlobal + items.length})`
    );

    pagina++;
  }

  return items;
}

export async function buscarContratacoes(
  filtros: PncpFiltros,
  onProgress?: (p: PncpProgresso) => void,
  signal?: CancelSignal,
): Promise<PncpContratacaoResponse[]> {
  const maxPaginas = filtros.paginas ?? 999;

  if (filtros.codigoModalidade) {
    return buscarPorModalidade(filtros, filtros.codigoModalidade, maxPaginas, onProgress, signal);
  }

  const modalidadesPrioritarias = [6, 4, 8];
  const allItems: PncpContratacaoResponse[] = [];

  for (const mod of modalidadesPrioritarias) {
    if (signal?.cancelled) break;
    const items = await buscarPorModalidade(filtros, mod, maxPaginas, onProgress, signal, allItems.length);
    allItems.push(...items);
    console.log(`[PNCP] Modalidade ${mod}: ${items.length} itens. Total: ${allItems.length}`);
  }

  return allItems;
}
