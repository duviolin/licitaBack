declare module "@nlpjs/lang-pt" {
  export class NormalizerPt {
    normalize(text: string): string;
  }
  export class TokenizerPt {
    tokenize(text: string): string[];
  }
  export class StopwordsPt {
    removeStopwords(tokens: string[]): string[];
  }
  export class StemmerPt {
    stemWord(word: string): string;
  }
}
