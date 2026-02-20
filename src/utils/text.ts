import { NormalizerPt } from "@nlpjs/lang-pt";
import { TokenizerPt } from "@nlpjs/lang-pt";
import { StopwordsPt } from "@nlpjs/lang-pt";
import { StemmerPt } from "@nlpjs/lang-pt";

const normalizer = new NormalizerPt();
const tokenizer = new TokenizerPt();
const stopwords = new StopwordsPt();
const stemmer = new StemmerPt();

export function processarTexto(texto: string): string[] {
  if (!texto || texto.trim().length === 0) return [];

  const normalizado = normalizer.normalize(texto);
  const tokens: string[] = tokenizer.tokenize(normalizado);
  const semStopwords: string[] = stopwords.removeStopwords(tokens);

  const stems = semStopwords
    .filter((t: string) => t.length >= 3)
    .map((t: string) => stemmer.stemWord(t) as string);

  const unicos = [...new Set(stems)];
  unicos.sort();
  return unicos;
}

export function extrairStemsDeTextos(textos: string[]): string[] {
  const todosStems = textos.flatMap((t) => processarTexto(t));
  const unicos = [...new Set(todosStems)];
  unicos.sort();
  return unicos;
}

export function encontrarPalavrasOriginais(
  texto: string,
  stemsMatch: string[]
): string[] {
  if (!texto || stemsMatch.length === 0) return [];

  const normalizado = normalizer.normalize(texto);
  const tokens: string[] = tokenizer.tokenize(normalizado);
  const stemsSet = new Set(stemsMatch);

  const palavras: string[] = [];
  const vistas = new Set<string>();

  for (const token of tokens) {
    const stem = stemmer.stemWord(token) as string;
    if (stemsSet.has(stem) && !vistas.has(token)) {
      palavras.push(token);
      vistas.add(token);
    }
  }

  return palavras;
}
