import {
  SECOES,
  DOCUMENTO_PATTERNS,
  identificarSecao,
  extrairTrechoContexto,
  type DocumentoPattern,
} from "../utils/editalRegex.js";
import type { DocumentoExigidoExtraido } from "../types/index.js";

interface SecaoTexto {
  nome: string;
  texto: string;
  inicio: number;
  fim: number;
}

export function identificarSecoesHabilitacao(texto: string): SecaoTexto[] {
  const secoes: SecaoTexto[] = [];
  const linhas = texto.split("\n");
  let secaoAtual: SecaoTexto | null = null;
  let posicaoAtual = 0;

  for (const linha of linhas) {
    const secaoId = identificarSecao(linha);

    if (secaoId !== "OUTRO" && linha.trim().length < 200) {
      if (secaoAtual) {
        secaoAtual.fim = posicaoAtual;
        secoes.push(secaoAtual);
      }
      secaoAtual = {
        nome: secaoId,
        texto: "",
        inicio: posicaoAtual,
        fim: 0,
      };
    }

    if (secaoAtual) {
      secaoAtual.texto += linha + "\n";
    }

    posicaoAtual += linha.length + 1;
  }

  if (secaoAtual) {
    secaoAtual.fim = posicaoAtual;
    secoes.push(secaoAtual);
  }

  return secoes;
}

function matchDocumentoNoTexto(
  texto: string,
  pattern: DocumentoPattern,
  secaoNome: string,
  textoCompleto: string,
  offsetSecao: number
): DocumentoExigidoExtraido | null {
  for (const regex of pattern.patterns) {
    const match = regex.exec(texto);
    if (match) {
      const posAbsoluta = offsetSecao + (match.index ?? 0);
      const referencia = extrairTrechoContexto(textoCompleto, posAbsoluta, 300);

      return {
        tipo: pattern.tipo,
        nome: gerarNomeDocumento(pattern.tipo),
        secaoEdital: secaoNome,
        obrigatorio: !texto
          .substring(
            Math.max(0, (match.index ?? 0) - 100),
            (match.index ?? 0) + match[0].length + 100
          )
          .match(/quando\s+(?:exig[ií]vel|aplic[áa]vel)|se\s+houver|opcional/i),
        validadeDias: pattern.validadeDias,
        autenticacaoExigida: pattern.autenticacaoExigida ?? false,
        referenciaEdital: referencia,
      };
    }
  }
  return null;
}

export function extrairDocumentos(
  textoCompleto: string,
  secoes: SecaoTexto[]
): DocumentoExigidoExtraido[] {
  const documentos: DocumentoExigidoExtraido[] = [];
  const tiposEncontrados = new Set<string>();

  for (const secao of secoes) {
    for (const pattern of DOCUMENTO_PATTERNS) {
      if (tiposEncontrados.has(pattern.tipo)) continue;

      const doc = matchDocumentoNoTexto(
        secao.texto,
        pattern,
        secao.nome,
        textoCompleto,
        secao.inicio
      );

      if (doc) {
        documentos.push(doc);
        tiposEncontrados.add(pattern.tipo);
      }
    }
  }

  if (secoes.length === 0) {
    for (const pattern of DOCUMENTO_PATTERNS) {
      if (tiposEncontrados.has(pattern.tipo)) continue;

      const doc = matchDocumentoNoTexto(
        textoCompleto,
        pattern,
        "HABILITACAO_GERAL",
        textoCompleto,
        0
      );

      if (doc) {
        documentos.push(doc);
        tiposEncontrados.add(pattern.tipo);
      }
    }
  }

  return documentos;
}

export function extrairRequisitos(texto: string): DocumentoExigidoExtraido[] {
  const secoes = identificarSecoesHabilitacao(texto);
  console.log(
    `[RequisitosExtractor] Seções encontradas: ${secoes.map((s) => s.nome).join(", ") || "nenhuma (busca global)"}`
  );

  const documentos = extrairDocumentos(texto, secoes);
  console.log(
    `[RequisitosExtractor] Documentos identificados: ${documentos.length}`
  );

  return documentos;
}

function gerarNomeDocumento(tipo: string): string {
  const nomes: Record<string, string> = {
    CND_FEDERAL: "Certidão Negativa de Débitos Federais",
    CND_ESTADUAL: "Certidão Negativa de Débitos Estaduais",
    CND_MUNICIPAL: "Certidão Negativa de Débitos Municipais",
    CND_TRABALHISTA: "Certidão Negativa de Débitos Trabalhistas (CNDT)",
    FGTS: "Certificado de Regularidade do FGTS (CRF)",
    BALANCO_PATRIMONIAL: "Balanço Patrimonial e Demonstrações Contábeis",
    ATESTADO_TECNICO: "Atestado de Capacidade Técnica",
    CONTRATO_SOCIAL: "Contrato Social / Ato Constitutivo",
    ALVARA: "Alvará de Funcionamento",
    CERTIDAO_FALENCIA: "Certidão Negativa de Falência e Recuperação Judicial",
    SICAF: "Registro no SICAF",
    CNPJ_CARTAO: "Comprovante de Inscrição no CNPJ",
    PROCURACAO: "Procuração / Credenciamento",
    DECLARACAO_ME_EPP: "Declaração de ME/EPP",
    DECLARACAO_INEXISTENCIA_FATO:
      "Declaração de Inexistência de Fato Impeditivo",
    DECLARACAO_MENOR: "Declaração de Não Emprego de Menores",
    REGISTRO_CONSELHO: "Registro em Conselho Profissional",
    OUTRO: "Documento Não Classificado",
  };
  return nomes[tipo] ?? tipo;
}
