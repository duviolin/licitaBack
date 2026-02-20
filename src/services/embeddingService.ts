import OpenAI from "openai";

const MODEL = "text-embedding-3-small";
const DIMENSIONS = 512;

let client: OpenAI | null = null;

function getClient(): OpenAI | null {
  if (client) return client;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  client = new OpenAI({ apiKey });
  return client;
}

export function isDisponivel(): boolean {
  return !!getClient();
}

export async function gerarEmbedding(texto: string): Promise<number[]> {
  const c = getClient();
  if (!c) return [];

  const input = texto.slice(0, 8000);
  const response = await c.embeddings.create({
    model: MODEL,
    input,
    dimensions: DIMENSIONS,
  });

  return response.data[0]?.embedding ?? [];
}

export async function gerarEmbeddingsBatch(textos: string[]): Promise<number[][]> {
  const c = getClient();
  if (!c) return textos.map(() => []);

  const inputs = textos.map((t) => t.slice(0, 8000));
  const response = await c.embeddings.create({
    model: MODEL,
    input: inputs,
    dimensions: DIMENSIONS,
  });

  return response.data
    .sort((a, b) => a.index - b.index)
    .map((d) => d.embedding);
}

export function similaridadeCosseno(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dotProduct / denominator;
}

export function montarTextoEmpresa(empresa: {
  razaoSocial: string;
  cnaePrincipalDescricao: string;
  cnaesSecundarios: any;
  palavrasChave: string[];
}): string {
  const partes = [
    empresa.cnaePrincipalDescricao,
    ...(Array.isArray(empresa.cnaesSecundarios)
      ? empresa.cnaesSecundarios.map((c: any) => c.descricao || c).filter(Boolean)
      : []),
    ...empresa.palavrasChave,
  ];
  return partes.join(". ");
}
