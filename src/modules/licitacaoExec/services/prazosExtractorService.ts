import { PRAZO_PATTERNS, parseDataBrasileira } from "../utils/editalRegex.js";
import type { PrazosExtraidos } from "../types/index.js";

function buscarDataEmPatterns(
  texto: string,
  patterns: RegExp[]
): Date | null {
  for (const pattern of patterns) {
    const match = pattern.exec(texto);
    if (match && match[1]) {
      const data = parseDataBrasileira(match[1]);
      if (data) return data;
    }
  }
  return null;
}

export function extrairPrazos(texto: string): PrazosExtraidos {
  console.log("[PrazosExtractor] Extraindo prazos do edital...");

  const prazos: PrazosExtraidos = {};

  prazos.prazoImpugnacao = buscarDataEmPatterns(
    texto,
    PRAZO_PATTERNS.impugnacao
  ) ?? undefined;

  prazos.prazoEsclarecimento = buscarDataEmPatterns(
    texto,
    PRAZO_PATTERNS.esclarecimento
  ) ?? undefined;

  prazos.dataSessao = buscarDataEmPatterns(
    texto,
    PRAZO_PATTERNS.sessao
  ) ?? undefined;

  prazos.dataAbertura = buscarDataEmPatterns(
    texto,
    PRAZO_PATTERNS.abertura
  ) ?? undefined;

  prazos.prazoRecurso = buscarDataEmPatterns(
    texto,
    PRAZO_PATTERNS.recurso
  ) ?? undefined;

  if (!prazos.dataAbertura && prazos.dataSessao) {
    prazos.dataAbertura = prazos.dataSessao;
  }

  const encontrados = Object.entries(prazos)
    .filter(([, v]) => v !== undefined)
    .map(([k]) => k);

  console.log(
    `[PrazosExtractor] Prazos encontrados: ${encontrados.join(", ") || "nenhum"}`
  );

  return prazos;
}
