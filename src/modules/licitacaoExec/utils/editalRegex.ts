export const SECOES = {
  habilitacao: /(?:da\s+)?habilita[çc][ãa]o/i,
  habJuridica: /habilita[çc][ãa]o\s+jur[íi]dica/i,
  regFiscal: /regularidade\s+fiscal(?:\s+e\s+trabalhista)?/i,
  qualTecnica: /qualifica[çc][ãa]o\s+t[ée]cnica/i,
  qualEconomica:
    /qualifica[çc][ãa]o\s+econ[ôo]mico[\s-]*financeira/i,
};

export interface DocumentoPattern {
  tipo: string;
  patterns: RegExp[];
  validadeDias?: number;
  autenticacaoExigida?: boolean;
}

export const DOCUMENTO_PATTERNS: DocumentoPattern[] = [
  {
    tipo: "CND_FEDERAL",
    patterns: [
      /certid[ãa]o\s+(?:negativa|positiva\s+com\s+efeito).*?(?:d[ée]bitos?\s+)?federa/i,
      /certid[ãa]o\s+conjunta.*?(?:PGFN|RFB|receita\s+federal)/i,
      /CND\s+federal/i,
      /d[ée]bitos?\s+relativos\s+(?:a|aos)\s+tributos?\s+federa/i,
    ],
    validadeDias: 180,
  },
  {
    tipo: "CND_ESTADUAL",
    patterns: [
      /certid[ãa]o\s+(?:negativa|positiva).*?(?:estadual|fazenda\s+estadual)/i,
      /tributos?\s+estadua/i,
      /d[ée]bitos?\s+(?:com\s+a\s+)?fazenda\s+estadual/i,
    ],
    validadeDias: 180,
  },
  {
    tipo: "CND_MUNICIPAL",
    patterns: [
      /certid[ãa]o\s+(?:negativa|positiva).*?(?:municipal|fazenda\s+municipal)/i,
      /tributos?\s+municipa/i,
      /ISS/i,
      /d[ée]bitos?\s+(?:com\s+a\s+)?fazenda\s+municipal/i,
    ],
    validadeDias: 180,
  },
  {
    tipo: "CND_TRABALHISTA",
    patterns: [
      /certid[ãa]o\s+negativa\s+de\s+d[ée]bitos?\s+trabalhist/i,
      /CNDT/i,
      /TST/i,
      /d[ée]bitos?\s+trabalhist/i,
    ],
    validadeDias: 180,
  },
  {
    tipo: "FGTS",
    patterns: [
      /certificado\s+de\s+regularidade.*?FGTS/i,
      /CRF.*?FGTS/i,
      /FGTS.*?(?:regularidade|certificado|CRF)/i,
      /regularidade.*?fundo\s+de\s+garantia/i,
    ],
    validadeDias: 30,
  },
  {
    tipo: "BALANCO_PATRIMONIAL",
    patterns: [
      /balan[çc]o\s+patrimonial/i,
      /demonstra[çc][õo]es\s+cont[áa]beis/i,
      /demonstra[çc][õo]es\s+financeiras/i,
      /[íi]ndices?\s+(?:de\s+)?liquidez/i,
    ],
    autenticacaoExigida: true,
  },
  {
    tipo: "ATESTADO_TECNICO",
    patterns: [
      /atestado\s+(?:de\s+)?capacidade\s+t[ée]cnica/i,
      /atestado.*?t[ée]cnic/i,
      /comprova[çc][ãa]o\s+(?:de\s+)?(?:aptid[ãa]o|capacidade)\s+t[ée]cnica/i,
      /CAT.*?CREA/i,
    ],
  },
  {
    tipo: "CONTRATO_SOCIAL",
    patterns: [
      /contrato\s+social/i,
      /ato\s+constitutivo/i,
      /estatuto\s+(?:social|em\s+vigor)/i,
      /registro\s+(?:comercial|na\s+junta)/i,
      /altera[çc][õo]es?\s+(?:contratuais?|posteriores?)/i,
    ],
  },
  {
    tipo: "ALVARA",
    patterns: [
      /alvar[áa]\s+(?:de\s+)?funcionamento/i,
      /alvar[áa]\s+(?:de\s+)?localiza[çc][ãa]o/i,
      /licen[çc]a\s+(?:de\s+)?funcionamento/i,
    ],
  },
  {
    tipo: "CERTIDAO_FALENCIA",
    patterns: [
      /certid[ãa]o.*?fal[êe]ncia/i,
      /certid[ãa]o.*?recupera[çc][ãa]o\s+judicial/i,
      /certid[ãa]o.*?concordata/i,
      /fal[êe]ncia.*?certid[ãa]o/i,
    ],
    validadeDias: 90,
  },
  {
    tipo: "SICAF",
    patterns: [/SICAF/i, /sistema\s+(?:de\s+)?cadastr.*?fornecedor/i],
  },
  {
    tipo: "CNPJ_CARTAO",
    patterns: [
      /cart[ãa]o\s+(?:do\s+)?CNPJ/i,
      /comprovante\s+(?:de\s+)?inscri[çc][ãa]o.*?CNPJ/i,
      /prova\s+de\s+inscri[çc][ãa]o.*?(?:cadastro\s+nacional|CNPJ)/i,
    ],
  },
  {
    tipo: "PROCURACAO",
    patterns: [
      /procura[çc][ãa]o/i,
      /instrumento\s+(?:de\s+)?mandato/i,
      /credenciamento/i,
    ],
  },
  {
    tipo: "DECLARACAO_ME_EPP",
    patterns: [
      /declara[çc][ãa]o.*?micro\s*empresa/i,
      /declara[çc][ãa]o.*?(?:ME|EPP)/i,
      /declara[çc][ãa]o.*?pequeno\s+porte/i,
      /enquadramento.*?(?:ME|EPP|micro|pequeno\s+porte)/i,
    ],
  },
  {
    tipo: "DECLARACAO_INEXISTENCIA_FATO",
    patterns: [
      /declara[çc][ãa]o.*?inexist[êe]ncia.*?fato\s+impeditivo/i,
      /declara[çc][ãa]o.*?idoneidade/i,
      /fato\s+(?:superveniente\s+)?impeditivo/i,
    ],
  },
  {
    tipo: "DECLARACAO_MENOR",
    patterns: [
      /declara[çc][ãa]o.*?(?:trabalho\s+(?:de\s+)?)?menores?/i,
      /declara[çc][ãa]o.*?n[ãa]o\s+emprega.*?menor/i,
      /art(?:igo)?\.?\s*7.*?(?:XXXIII|CF)/i,
    ],
  },
  {
    tipo: "REGISTRO_CONSELHO",
    patterns: [
      /CREA/i,
      /CAU/i,
      /CRA/i,
      /CRC/i,
      /OAB/i,
      /registro.*?conselho\s+(?:regional|profissional)/i,
      /inscri[çc][ãa]o.*?(?:conselho|entidade\s+profissional)/i,
    ],
  },
];

export const DATA_NUMERICA =
  /(\d{1,2})\s*[/\-.]\s*(\d{1,2})\s*[/\-.]\s*(\d{2,4})/g;

const MESES: Record<string, number> = {
  janeiro: 1, fevereiro: 2, "mar\u00e7o": 3, marco: 3, abril: 4,
  maio: 5, junho: 6, julho: 7, agosto: 8, setembro: 9,
  outubro: 10, novembro: 11, dezembro: 12,
};

export const DATA_EXTENSO =
  /(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})/gi;

export const PRAZO_PATTERNS = {
  impugnacao: [
    /impugna[çc][ãa]o.*?(?:at[ée]\s+)?(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4})/i,
    /impugna[çc][ãa]o.*?(\d{1,2}\s+de\s+\w+\s+de\s+\d{4})/i,
    /(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}).*?impugna[çc][ãa]o/i,
  ],
  esclarecimento: [
    /esclarecimento.*?(?:at[ée]\s+)?(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4})/i,
    /esclarecimento.*?(\d{1,2}\s+de\s+\w+\s+de\s+\d{4})/i,
    /(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}).*?esclarecimento/i,
  ],
  sessao: [
    /sess[ãa]o\s+p[úu]blica.*?(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4})/i,
    /sess[ãa]o.*?(\d{1,2}\s+de\s+\w+\s+de\s+\d{4})/i,
    /(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}).*?sess[ãa]o/i,
  ],
  abertura: [
    /abertura.*?(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4})/i,
    /abertura.*?(\d{1,2}\s+de\s+\w+\s+de\s+\d{4})/i,
    /(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}).*?abertura/i,
  ],
  recurso: [
    /recurso.*?(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4})/i,
    /recurso.*?(\d{1,2}\s+de\s+\w+\s+de\s+\d{4})/i,
    /prazo.*?recurs.*?(\d+)\s*(?:dias?\s+)?([úu]teis|corridos)?/i,
  ],
};

export function parseDataBrasileira(texto: string): Date | null {
  const numMatch = texto.match(
    /(\d{1,2})\s*[/\-.]\s*(\d{1,2})\s*[/\-.]\s*(\d{2,4})/
  );
  if (numMatch) {
    const dia = parseInt(numMatch[1], 10);
    const mes = parseInt(numMatch[2], 10) - 1;
    let ano = parseInt(numMatch[3], 10);
    if (ano < 100) ano += 2000;
    const date = new Date(ano, mes, dia);
    if (!isNaN(date.getTime())) return date;
  }

  const extMatch = texto.match(/(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})/i);
  if (extMatch) {
    const dia = parseInt(extMatch[1], 10);
    const mesNome = extMatch[2].toLowerCase();
    const ano = parseInt(extMatch[3], 10);
    const mes = MESES[mesNome];
    if (mes) {
      const date = new Date(ano, mes - 1, dia);
      if (!isNaN(date.getTime())) return date;
    }
  }

  return null;
}

export function extrairTrechoContexto(
  texto: string,
  posicao: number,
  raio: number = 200
): string {
  const inicio = Math.max(0, posicao - raio);
  const fim = Math.min(texto.length, posicao + raio);
  let trecho = texto.substring(inicio, fim).trim();
  if (inicio > 0) trecho = "..." + trecho;
  if (fim < texto.length) trecho = trecho + "...";
  return trecho;
}

export function limparTextoEdital(texto: string): string {
  return texto
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\s{2,}/g, " ")
    .replace(/[^\S\n]+/g, " ")
    .trim();
}

export function identificarSecao(texto: string): string {
  if (SECOES.habJuridica.test(texto)) return "HABILITACAO_JURIDICA";
  if (SECOES.regFiscal.test(texto)) return "REGULARIDADE_FISCAL";
  if (SECOES.qualTecnica.test(texto)) return "QUALIFICACAO_TECNICA";
  if (SECOES.qualEconomica.test(texto)) return "QUALIFICACAO_ECONOMICA";
  if (SECOES.habilitacao.test(texto)) return "HABILITACAO_GERAL";
  return "OUTRO";
}
