import { encontrarPalavrasOriginais } from "./text.js";

const PESO_TEXTUAL = 0.60;
const PESO_GEOGRAFICO = 0.25;
const PESO_VALOR = 0.15;

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function calcularScoreTextual(
  stemsEmpresa: string[],
  stemsObjeto: string[]
): { score: number; stemsMatch: string[] } {
  if (stemsEmpresa.length === 0 || stemsObjeto.length === 0) {
    return { score: 0, stemsMatch: [] };
  }

  const setEmpresa = new Set(stemsEmpresa);
  const setObjeto = new Set(stemsObjeto);

  const intersecao = [...setEmpresa].filter((s) => setObjeto.has(s));

  if (intersecao.length === 0) {
    return { score: 0, stemsMatch: [] };
  }

  const score =
    (intersecao.length / setEmpresa.size) * 0.6 +
    (intersecao.length / setObjeto.size) * 0.4;

  return {
    score: round3(Math.min(score, 1)),
    stemsMatch: intersecao,
  };
}

function calcularScoreGeografico(
  ufEmpresa: string,
  ufsInteresse: string[],
  ufLicitacao: string
): number {
  if (ufsInteresse.length > 0) {
    return ufsInteresse.includes(ufLicitacao) ? 1.0 : 0.0;
  }
  return ufLicitacao === ufEmpresa ? 1.0 : 0.3;
}

function calcularScoreValor(
  valorMinimo: number | null,
  valorMaximo: number | null,
  valorEstimado: number | null
): number {
  if (valorEstimado === null || valorEstimado === undefined) return 0.5;
  if (valorMinimo === null && valorMaximo === null) return 1.0;

  const min = valorMinimo ?? 0;
  const max = valorMaximo ?? Infinity;

  if (valorEstimado >= min && valorEstimado <= max) return 1.0;

  const faixa = max === Infinity ? min || 1 : max - min;
  if (faixa <= 0) return 0.5;

  let distancia: number;
  if (valorEstimado < min) {
    distancia = min - valorEstimado;
  } else {
    distancia = valorEstimado - max;
  }

  const decaimento = Math.max(0, 1 - distancia / faixa);
  return round3(decaimento);
}

export interface ScoreResult {
  score: number;
  scoreTextual: number;
  scoreGeografico: number;
  scoreValor: number;
  palavrasMatch: string[];
}

export function calcularScoreComposto(params: {
  stemsEmpresa: string[];
  stemsObjeto: string[];
  textoObjeto: string;
  ufEmpresa: string;
  ufsInteresse: string[];
  ufLicitacao: string;
  valorMinimo: number | null;
  valorMaximo: number | null;
  valorEstimado: number | null;
}): ScoreResult {
  const textual = calcularScoreTextual(params.stemsEmpresa, params.stemsObjeto);
  const geo = calcularScoreGeografico(
    params.ufEmpresa,
    params.ufsInteresse,
    params.ufLicitacao
  );
  const valor = calcularScoreValor(
    params.valorMinimo,
    params.valorMaximo,
    params.valorEstimado
  );

  const scoreTotal = round3(
    textual.score * PESO_TEXTUAL + geo * PESO_GEOGRAFICO + valor * PESO_VALOR
  );

  const palavrasMatch = encontrarPalavrasOriginais(
    params.textoObjeto,
    textual.stemsMatch
  );

  return {
    score: scoreTotal,
    scoreTextual: textual.score,
    scoreGeografico: geo,
    scoreValor: valor,
    palavrasMatch,
  };
}
