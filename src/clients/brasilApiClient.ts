import { env } from "../config/env.js";

export interface BrasilApiCnpjResponse {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string;
  situacao_cadastral: number;
  descricao_situacao_cadastral: string;
  uf: string;
  municipio: string;
  porte: string;
  capital_social: number;
  cnae_fiscal: number;
  cnae_fiscal_descricao: string;
  cnaes_secundarios: Array<{ codigo: number; descricao: string }>;
}

export async function consultarCnpj(cnpj: string): Promise<BrasilApiCnpjResponse> {
  const url = `${env.BRASILAPI_BASE_URL}/cnpj/v1/${cnpj}`;

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        "Accept": "application/json",
        "User-Agent": "licitacoes-mvp/1.0",
      },
    });
  } catch (err) {
    console.error("[BrasilAPI] Erro de rede:", err);
    throw new Error("Erro ao consultar BrasilAPI");
  }

  if (response.ok) {
    return (await response.json()) as BrasilApiCnpjResponse;
  }

  console.error(`[BrasilAPI] Status ${response.status} para CNPJ ${cnpj}`);

  switch (response.status) {
    case 400:
      throw new Error("CNPJ inválido");
    case 404:
      throw new Error("CNPJ não encontrado na Receita Federal");
    case 429:
      throw new Error("Limite de consultas excedido, tente em alguns segundos");
    default:
      throw new Error(`Erro ao consultar BrasilAPI (status ${response.status})`);
  }
}
