import OpenAI from "openai";
import { env } from "../config/env.js";
import type { DocumentoExigidoExtraido, PrazosExtraidos } from "../modules/licitacaoExec/types/index.js";

let clientInstance: OpenAI | null = null;

function getClient(): OpenAI | null {
  if (!env.hasOpenAI()) return null;
  if (!clientInstance) {
    clientInstance = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  }
  return clientInstance;
}

export function isLLMDisponivel(): boolean {
  return env.hasOpenAI();
}

const TIPOS_VALIDOS = [
  "CND_FEDERAL", "CND_ESTADUAL", "CND_MUNICIPAL", "CND_TRABALHISTA",
  "FGTS", "BALANCO_PATRIMONIAL", "ATESTADO_TECNICO", "CONTRATO_SOCIAL",
  "ALVARA", "CERTIDAO_FALENCIA", "SICAF", "CNPJ_CARTAO", "PROCURACAO",
  "DECLARACAO_ME_EPP", "DECLARACAO_INEXISTENCIA_FATO", "DECLARACAO_MENOR",
  "REGISTRO_CONSELHO", "OUTRO",
];

// ---------------------------------------------------------------------------
// Seleção de edital (já existente)
// ---------------------------------------------------------------------------

interface ArquivoParaClassificar {
  indice: number;
  titulo?: string;
  tipoDocumento?: string;
  url?: string;
}

interface ResultadoSelecao {
  indiceEscolhido: number;
  confianca: "alta" | "media" | "baixa";
  justificativa: string;
}

export async function selecionarEdital(
  arquivos: ArquivoParaClassificar[],
  contexto?: string
): Promise<ResultadoSelecao | null> {
  const client = getClient();
  if (!client) return null;

  const listaFormatada = arquivos
    .map((a) => `[${a.indice}] Título: "${a.titulo || "sem título"}" | Tipo: "${a.tipoDocumento || "não informado"}" | URL: ${a.url || "N/A"}`)
    .join("\n");

  const prompt = `Você é um especialista em licitações públicas brasileiras.

Abaixo está uma lista de arquivos anexados a uma licitação no Portal Nacional de Contratações Públicas (PNCP).

Sua tarefa: identificar qual arquivo é o **Edital** principal da licitação (o documento que descreve o objeto, requisitos de habilitação, prazos, etc.).

${contexto ? `Contexto da licitação: ${contexto}\n` : ""}
Arquivos disponíveis:
${listaFormatada}

Responda APENAS em JSON válido no formato:
{
  "indice": <número do arquivo escolhido>,
  "confianca": "alta" | "media" | "baixa",
  "justificativa": "<explicação curta>"
}

Regras:
- O edital geralmente tem "edital" no título ou tipo, mas nem sempre.
- Pode estar descrito como "Termo de Referência", "Minuta", "Aviso de Licitação" — nesses casos, prefira o documento mais completo.
- Se houver "Edital consolidado" ou "Edital retificado", prefira esses.
- Se não houver nenhum candidato claro, escolha o primeiro arquivo e diga confiança "baixa".
- Atas, resultados, impugnações e recursos NÃO são editais.`;

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 200,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content);
    return {
      indiceEscolhido: parsed.indice ?? 0,
      confianca: parsed.confianca ?? "baixa",
      justificativa: parsed.justificativa ?? "",
    };
  } catch (err) {
    console.warn("[LLM] selecionarEdital erro:", err instanceof Error ? err.message : err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Seleção de melhor link (já existente)
// ---------------------------------------------------------------------------

interface LinkParaClassificar {
  indice: number;
  texto: string;
  href: string;
}

export async function selecionarMelhorLink(
  links: LinkParaClassificar[],
  contexto?: string
): Promise<ResultadoSelecao | null> {
  const client = getClient();
  if (!client) return null;

  const listaFormatada = links
    .map((l) => `[${l.indice}] Texto: "${l.texto}" | URL: ${l.href}`)
    .join("\n");

  const prompt = `Você é um especialista em licitações públicas brasileiras.

Abaixo estão links encontrados em uma página web de uma licitação pública.

Sua tarefa: identificar qual link é o **download do Edital** (PDF do documento principal da licitação).

${contexto ? `Contexto: ${contexto}\n` : ""}
Links encontrados:
${listaFormatada}

Responda APENAS em JSON válido:
{
  "indice": <número do link escolhido>,
  "confianca": "alta" | "media" | "baixa",
  "justificativa": "<explicação curta>"
}

Regras:
- Prefira links com "edital" no texto ou que apontem para .pdf
- Links de "ata", "resultado", "recurso", "impugnação" NÃO são editais
- Se houver "edital retificado" ou "consolidado", prefira
- Se nenhum link parecer ser o edital, escolha o mais provável e diga confiança "baixa"`;

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 200,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content);
    return {
      indiceEscolhido: parsed.indice ?? 0,
      confianca: parsed.confianca ?? "baixa",
      justificativa: parsed.justificativa ?? "",
    };
  } catch (err) {
    console.warn("[LLM] selecionarMelhorLink erro:", err instanceof Error ? err.message : err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Fase IA 1.1 — Extração de requisitos/documentos via LLM
// ---------------------------------------------------------------------------

export interface RequisitosLLMResult {
  documentos: DocumentoExigidoExtraido[];
  usouLLM: boolean;
}

function truncarTexto(texto: string, maxChars = 28000): string {
  if (texto.length <= maxChars) return texto;
  const metade = Math.floor(maxChars / 2);
  return texto.slice(0, metade) + "\n\n[...texto truncado...]\n\n" + texto.slice(-metade);
}

export async function extrairRequisitosViaLLM(
  textoEdital: string
): Promise<RequisitosLLMResult | null> {
  const client = getClient();
  if (!client) return null;

  const textoTruncado = truncarTexto(textoEdital);

  const prompt = `Você é um especialista em licitações públicas brasileiras.

Analise o texto do edital abaixo e extraia TODOS os documentos de habilitação exigidos dos licitantes.

Para cada documento, forneça:
- "tipo": uma das categorias: ${TIPOS_VALIDOS.join(", ")}. Use "OUTRO" se não se encaixar.
- "nome": nome legível do documento
- "secaoEdital": seção do edital onde aparece (ex: "HABILITAÇÃO JURÍDICA", "REGULARIDADE FISCAL")
- "obrigatorio": true/false — false se o edital diz "quando exigível", "se houver", "opcional"
- "validadeDias": número de dias de validade (ex: 180 para CNDs). null se não especificado
- "autenticacaoExigida": true se o edital exige autenticação/reconhecimento de firma
- "referenciaEdital": trecho curto do edital (até 200 chars) que menciona o documento

Responda APENAS em JSON válido:
{
  "documentos": [
    {
      "tipo": "...",
      "nome": "...",
      "secaoEdital": "...",
      "obrigatorio": true,
      "validadeDias": null,
      "autenticacaoExigida": false,
      "referenciaEdital": "..."
    }
  ]
}

Regras:
- Inclua todos os documentos mencionados como requisito de habilitação
- Certidões negativas de débitos (federal, estadual, municipal, trabalhista, FGTS, falência)
- Documentos jurídicos (contrato social, procuração, CNPJ)
- Documentos técnicos (atestados, registros em conselho)
- Declarações (ME/EPP, menor, inexistência fato impeditivo)
- Documentos financeiros (balanço patrimonial)
- SICAF se mencionado
- NÃO inclua documentos da proposta comercial, apenas de habilitação
- NÃO invente documentos que não estejam no edital

Texto do edital:
${textoTruncado}`;

  try {
    console.log("[LLM] Extraindo requisitos/documentos via LLM...");
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 4000,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content);
    const docs: DocumentoExigidoExtraido[] = (parsed.documentos ?? []).map(
      (d: any) => ({
        tipo: TIPOS_VALIDOS.includes(d.tipo) ? d.tipo : "OUTRO",
        nome: d.nome ?? "Documento",
        secaoEdital: d.secaoEdital ?? "",
        obrigatorio: d.obrigatorio !== false,
        validadeDias: typeof d.validadeDias === "number" ? d.validadeDias : undefined,
        autenticacaoExigida: d.autenticacaoExigida === true,
        referenciaEdital: (d.referenciaEdital ?? "").slice(0, 500),
      })
    );

    console.log(`[LLM] Requisitos extraídos: ${docs.length} documento(s)`);
    return { documentos: docs, usouLLM: true };
  } catch (err) {
    console.warn("[LLM] extrairRequisitosViaLLM erro:", err instanceof Error ? err.message : err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Fase IA 1.2 — Extração de prazos e datas via LLM
// ---------------------------------------------------------------------------

export interface PrazosLLMResult {
  prazos: PrazosExtraidos;
  usouLLM: boolean;
}

export async function extrairPrazosViaLLM(
  textoEdital: string
): Promise<PrazosLLMResult | null> {
  const client = getClient();
  if (!client) return null;

  const textoTruncado = truncarTexto(textoEdital);

  const prompt = `Você é um especialista em licitações públicas brasileiras.

Analise o texto do edital abaixo e extraia os prazos e datas relevantes.

Extraia as seguintes datas (formato ISO 8601, ex: "2025-03-15T10:00:00"):
- "dataAbertura": data de abertura das propostas ou início do pregão
- "dataSessao": data/hora da sessão pública
- "prazoImpugnacao": data limite para impugnação do edital
- "prazoEsclarecimento": data limite para pedidos de esclarecimento
- "prazoRecurso": data limite para recursos

Regras para interpretar datas:
- Datas em formato "dd/mm/aaaa" ou "dd de mês de aaaa" devem ser convertidas para ISO 8601
- Se houver horário (ex: "às 09h00"), inclua no ISO
- Prazos relativos como "até 3 dias úteis antes da abertura" devem ser calculados se a data de abertura for conhecida
- "Às vésperas" = 1 dia antes
- Se uma data não for encontrada, use null

Responda APENAS em JSON válido:
{
  "dataAbertura": "2025-03-15T10:00:00",
  "dataSessao": "2025-03-15T10:00:00",
  "prazoImpugnacao": "2025-03-12T23:59:00",
  "prazoEsclarecimento": "2025-03-10T23:59:00",
  "prazoRecurso": null
}

Texto do edital:
${textoTruncado}`;

  try {
    console.log("[LLM] Extraindo prazos/datas via LLM...");
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 500,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content);

    const toDate = (v: unknown): Date | undefined => {
      if (!v || typeof v !== "string") return undefined;
      const d = new Date(v);
      return isNaN(d.getTime()) ? undefined : d;
    };

    const prazos: PrazosExtraidos = {
      dataAbertura: toDate(parsed.dataAbertura),
      dataSessao: toDate(parsed.dataSessao),
      prazoImpugnacao: toDate(parsed.prazoImpugnacao),
      prazoEsclarecimento: toDate(parsed.prazoEsclarecimento),
      prazoRecurso: toDate(parsed.prazoRecurso),
    };

    const encontrados = Object.entries(prazos).filter(([, v]) => v).map(([k]) => k);
    console.log(`[LLM] Prazos extraídos: ${encontrados.join(", ") || "nenhum"}`);

    return { prazos, usouLLM: true };
  } catch (err) {
    console.warn("[LLM] extrairPrazosViaLLM erro:", err instanceof Error ? err.message : err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Fase IA 1.3 — Resumo executivo do edital
// ---------------------------------------------------------------------------

export interface ResumoEditalResult {
  resumo: string;
  objeto: string;
  modalidade: string;
  valorEstimado: string | null;
  criterioJulgamento: string;
}

export async function gerarResumoEdital(
  textoEdital: string
): Promise<ResumoEditalResult | null> {
  const client = getClient();
  if (!client) return null;

  const textoTruncado = truncarTexto(textoEdital);

  const prompt = `Você é um especialista em licitações públicas brasileiras.

Analise o texto do edital abaixo e gere um resumo executivo conciso.

Responda APENAS em JSON válido:
{
  "resumo": "<resumo executivo em 3-5 frases, claro e objetivo, destacando o que é a licitação, quem está contratando, principais requisitos>",
  "objeto": "<descrição curta do objeto da licitação>",
  "modalidade": "<modalidade: Pregão Eletrônico, Concorrência, Tomada de Preço, etc.>",
  "valorEstimado": "<valor estimado se mencionado, ex: 'R$ 1.500.000,00', ou null>",
  "criterioJulgamento": "<critério: menor preço, técnica e preço, maior desconto, etc.>"
}

Regras:
- Seja objetivo e preciso
- O resumo deve ajudar o empresário a decidir se quer participar
- Não invente informações que não estejam no texto

Texto do edital:
${textoTruncado}`;

  try {
    console.log("[LLM] Gerando resumo executivo do edital...");
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      max_tokens: 1000,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content);

    console.log("[LLM] Resumo gerado com sucesso");
    return {
      resumo: parsed.resumo ?? "",
      objeto: parsed.objeto ?? "",
      modalidade: parsed.modalidade ?? "",
      valorEstimado: parsed.valorEstimado ?? null,
      criterioJulgamento: parsed.criterioJulgamento ?? "",
    };
  } catch (err) {
    console.warn("[LLM] gerarResumoEdital erro:", err instanceof Error ? err.message : err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Fase IA 2.1 — Matching semântico documento empresa ↔ documento exigido
// ---------------------------------------------------------------------------

export interface DocEmpresaParaMatching {
  id: string;
  tipo: string;
  nome: string;
  status: string;
  validade: string | null;
}

export interface DocExigidoParaMatching {
  id: string;
  tipo: string;
  nome: string;
  secaoEdital: string;
}

export interface MatchSemantico {
  documentoExigidoId: string;
  empresaDocumentoId: string | null;
  confianca: "alta" | "media" | "baixa";
  justificativa: string;
}

export async function matchSemanticoDocumentos(
  docsEmpresa: DocEmpresaParaMatching[],
  docsExigidosSemMatch: DocExigidoParaMatching[]
): Promise<MatchSemantico[]> {
  const client = getClient();
  if (!client || docsExigidosSemMatch.length === 0 || docsEmpresa.length === 0) return [];

  const listaEmpresa = docsEmpresa
    .map((d) => `[${d.id.slice(0, 8)}] Tipo: "${d.tipo}" | Nome: "${d.nome}" | Status: ${d.status} | Validade: ${d.validade ?? "N/A"}`)
    .join("\n");

  const listaExigidos = docsExigidosSemMatch
    .map((d) => `[${d.id.slice(0, 8)}] Tipo exigido: "${d.tipo}" | Nome: "${d.nome}" | Seção: "${d.secaoEdital}"`)
    .join("\n");

  const prompt = `Você é um especialista em documentação de licitações públicas brasileiras.

A empresa possui os seguintes documentos cadastrados:
${listaEmpresa}

Os seguintes documentos exigidos pelo edital NÃO foram encontrados pelo matching automático por tipo:
${listaExigidos}

Sua tarefa: verificar se algum documento da empresa pode atender a algum documento exigido, mesmo que os tipos/nomes sejam diferentes.

Exemplos de matches semânticos válidos:
- "Certidão Conjunta de Débitos Federais" pode atender "CND_FEDERAL"
- "Comprovante FGTS - CRF" pode atender "FGTS"
- "Ato Constitutivo" pode atender "CONTRATO_SOCIAL"
- "Inscrição Estadual" pode atender "CND_ESTADUAL" (NÃO, são coisas diferentes)

Responda APENAS em JSON válido:
{
  "matches": [
    {
      "documentoExigidoId": "<id do doc exigido, 8 chars>",
      "empresaDocumentoId": "<id do doc empresa, 8 chars>",
      "confianca": "alta" | "media" | "baixa",
      "justificativa": "<explicação curta>"
    }
  ]
}

Regras:
- Só faça match se realmente forem o mesmo tipo de documento
- Se não houver match possível, retorne "matches": []
- Um documento da empresa só pode ser usado para um exigido
- Prefira matches de alta confiança`;

  try {
    console.log(`[LLM] Matching semântico: ${docsExigidosSemMatch.length} exigido(s) sem match vs ${docsEmpresa.length} doc(s) empresa`);
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 1500,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return [];

    const parsed = JSON.parse(content);
    const matches: MatchSemantico[] = (parsed.matches ?? []).map((m: any) => ({
      documentoExigidoId: m.documentoExigidoId ?? "",
      empresaDocumentoId: m.empresaDocumentoId ?? null,
      confianca: ["alta", "media", "baixa"].includes(m.confianca) ? m.confianca : "baixa",
      justificativa: m.justificativa ?? "",
    }));

    console.log(`[LLM] Matches semânticos encontrados: ${matches.length}`);
    return matches;
  } catch (err) {
    console.warn("[LLM] matchSemanticoDocumentos erro:", err instanceof Error ? err.message : err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Fase IA 2.2 — Sugestões de ação para documentos pendentes
// ---------------------------------------------------------------------------

export interface SugestaoDocumento {
  documentoExigidoId: string;
  sugestao: string;
}

export async function gerarSugestoesConformidade(
  itensNaoOk: Array<{
    documentoExigidoId: string;
    nomeDocumento: string;
    tipoDocumento: string;
    status: string;
    observacao: string;
  }>
): Promise<SugestaoDocumento[]> {
  const client = getClient();
  if (!client || itensNaoOk.length === 0) return [];

  const lista = itensNaoOk
    .map((item, i) => `[${i}] Doc: "${item.nomeDocumento}" (${item.tipoDocumento}) | Status: ${item.status} | Obs: "${item.observacao}"`)
    .join("\n");

  const prompt = `Você é um consultor especialista em licitações públicas brasileiras, ajudando empresas a se prepararem para participar.

Os seguintes documentos de habilitação estão com problemas:
${lista}

Para cada documento, forneça uma sugestão prática e objetiva de como resolver o problema. Considere:
- Se AUSENTE: onde obter (site, órgão), prazo médio de emissão, se pode ser feito online
- Se VENCIDO: como renovar, qual o prazo, se é possível usar certidão positiva com efeito de negativa
- Se INCOMPATIVEL: o que precisa ser feito para adequar

Responda APENAS em JSON válido:
{
  "sugestoes": [
    {
      "indice": 0,
      "sugestao": "<texto prático e direto, 1-3 frases>"
    }
  ]
}

Regras:
- Seja prático e específico (mencione sites como gov.br, Receita Federal, etc.)
- Inclua prazo estimado de obtenção quando possível
- Se for certidão online, mencione que é gratuita e instantânea
- Priorize a solução mais rápida`;

  try {
    console.log(`[LLM] Gerando sugestões para ${itensNaoOk.length} documento(s) pendente(s)`);
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 2000,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return [];

    const parsed = JSON.parse(content);
    const sugestoes: SugestaoDocumento[] = (parsed.sugestoes ?? [])
      .filter((s: any) => typeof s.indice === "number" && s.indice < itensNaoOk.length)
      .map((s: any) => ({
        documentoExigidoId: itensNaoOk[s.indice].documentoExigidoId,
        sugestao: s.sugestao ?? "",
      }));

    console.log(`[LLM] Sugestões geradas: ${sugestoes.length}`);
    return sugestoes;
  } catch (err) {
    console.warn("[LLM] gerarSugestoesConformidade erro:", err instanceof Error ? err.message : err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Classificação de documentos do processo licitatório
// ---------------------------------------------------------------------------

const TIPOS_DOCUMENTO_PROCESSO = [
  "EDITAL", "RETIFICACAO", "ESCLARECIMENTO", "IMPUGNACAO",
  "TERMO_REFERENCIA", "ORCAMENTO", "ATA", "RECURSO",
  "RESULTADO", "CONTRATO", "OUTRO",
];

export interface DocProcessoParaClassificar {
  indice: number;
  nomeArquivo: string;
  tipoInformado?: string;
  dataPublicacao?: string;
}

export interface ClassificacaoDocProcesso {
  indice: number;
  tipo: string;
  resumo: string;
  relevancia: "critica" | "alta" | "normal" | "baixa";
}

export async function classificarDocumentosProcesso(
  documentos: DocProcessoParaClassificar[]
): Promise<ClassificacaoDocProcesso[]> {
  const client = getClient();
  if (!client || documentos.length === 0) return [];

  const lista = documentos
    .map((d) => `[${d.indice}] Arquivo: "${d.nomeArquivo}" | Tipo informado: "${d.tipoInformado || "N/A"}" | Data: ${d.dataPublicacao || "N/A"}`)
    .join("\n");

  const prompt = `Você é um especialista em licitações públicas brasileiras.

Classifique cada documento abaixo em uma das categorias e gere um resumo curto de 1 frase.

Categorias: ${TIPOS_DOCUMENTO_PROCESSO.join(", ")}

Definições:
- EDITAL: documento principal da licitação (edital, edital e seus anexos)
- RETIFICACAO: alterações, erratas, retificações, aditivos ao edital (CRÍTICO: muda requisitos!)
- ESCLARECIMENTO: respostas a perguntas dos licitantes, pedidos de esclarecimento
- IMPUGNACAO: impugnações ao edital e suas respostas
- TERMO_REFERENCIA: especificação técnica detalhada, projeto básico
- ORCAMENTO: planilha orçamentária, estimativa de custos, composição de preços
- ATA: ata de sessão pública, ata do pregão
- RECURSO: recursos e contrarrazões
- RESULTADO: resultado, homologação, adjudicação
- CONTRATO: minuta de contrato, contrato assinado
- OUTRO: não se encaixa em nenhuma categoria

Documentos:
${lista}

Responda APENAS em JSON válido:
{
  "classificacoes": [
    {
      "indice": 0,
      "tipo": "EDITAL",
      "resumo": "<1 frase descrevendo o documento>",
      "relevancia": "critica" | "alta" | "normal" | "baixa"
    }
  ]
}

Regras de relevância:
- "critica": EDITAL, RETIFICACAO (alteram os requisitos da licitação)
- "alta": TERMO_REFERENCIA, ESCLARECIMENTO, IMPUGNACAO (podem afetar participação)
- "normal": ORCAMENTO, ATA, CONTRATO
- "baixa": RESULTADO, RECURSO, OUTRO`;

  try {
    console.log(`[LLM] Classificando ${documentos.length} documento(s) do processo...`);
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 2000,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return [];

    const parsed = JSON.parse(content);
    const result: ClassificacaoDocProcesso[] = (parsed.classificacoes ?? []).map(
      (c: any) => ({
        indice: c.indice ?? 0,
        tipo: TIPOS_DOCUMENTO_PROCESSO.includes(c.tipo) ? c.tipo : "OUTRO",
        resumo: c.resumo ?? "",
        relevancia: ["critica", "alta", "normal", "baixa"].includes(c.relevancia)
          ? c.relevancia
          : "normal",
      })
    );

    console.log(`[LLM] Classificação concluída: ${result.map((r) => r.tipo).join(", ")}`);
    return result;
  } catch (err) {
    console.warn("[LLM] classificarDocumentosProcesso erro:", err instanceof Error ? err.message : err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Análise de impacto de documento complementar (retificação, esclarecimento, etc)
// ---------------------------------------------------------------------------

export interface AnaliseDocumentoComplementar {
  resumoConteudo: string;
  alteracoes: string[];
  impactoRequisitos: boolean;
  impactoPrazos: boolean;
  novosDocumentosExigidos: string[];
  documentosRemovidos: string[];
  prazosAlterados: string[];
}

export async function analisarDocumentoComplementar(
  textoDocumento: string,
  tipoDocumento: string,
  nomeDocumento: string,
): Promise<AnaliseDocumentoComplementar | null> {
  const client = getClient();
  if (!client) return null;

  const textoTrunc = truncarTexto(textoDocumento, 24000);

  const prompt = `Você é um especialista em licitações públicas brasileiras.

Analise o documento abaixo (tipo: ${tipoDocumento}, nome: "${nomeDocumento}") e identifique:

1. Um resumo breve (2-3 frases) do conteúdo
2. Lista de alterações em relação ao edital original (se for retificação/errata)
3. Se há impacto nos requisitos de habilitação (documentos exigidos)
4. Se há impacto em prazos/datas
5. Novos documentos que passaram a ser exigidos
6. Documentos que foram removidos/dispensados
7. Prazos que foram alterados

Documento:
${textoTrunc}

Responda APENAS em JSON válido:
{
  "resumoConteudo": "<resumo breve>",
  "alteracoes": ["<alteração 1>", "<alteração 2>"],
  "impactoRequisitos": true/false,
  "impactoPrazos": true/false,
  "novosDocumentosExigidos": ["<documento>"],
  "documentosRemovidos": ["<documento>"],
  "prazosAlterados": ["<prazo alterado>"]
}

Se o documento não altera nada do edital (ex: é só uma ata de sessão), retorne arrays vazios e false nos booleans.`;

  try {
    console.log(`[LLM] Analisando impacto de "${nomeDocumento}" (${tipoDocumento})...`);
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 2000,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content);
    return {
      resumoConteudo: parsed.resumoConteudo ?? "",
      alteracoes: Array.isArray(parsed.alteracoes) ? parsed.alteracoes : [],
      impactoRequisitos: !!parsed.impactoRequisitos,
      impactoPrazos: !!parsed.impactoPrazos,
      novosDocumentosExigidos: Array.isArray(parsed.novosDocumentosExigidos) ? parsed.novosDocumentosExigidos : [],
      documentosRemovidos: Array.isArray(parsed.documentosRemovidos) ? parsed.documentosRemovidos : [],
      prazosAlterados: Array.isArray(parsed.prazosAlterados) ? parsed.prazosAlterados : [],
    };
  } catch (err) {
    console.warn("[LLM] analisarDocumentoComplementar erro:", err instanceof Error ? err.message : err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Fase IA 4.1 — Análise de Risco do Edital
// ---------------------------------------------------------------------------

export interface AnaliseRisco {
  scoreRisco: number; // 0-100
  nivelRisco: "baixo" | "moderado" | "alto" | "critico";
  riscos: Array<{
    categoria: string;
    descricao: string;
    severidade: "baixa" | "media" | "alta";
    clausula?: string;
  }>;
  multasIdentificadas: string[];
  garantiasExigidas: string[];
  prazosRiscos: string[];
}

export async function analisarRiscoEdital(textoEdital: string): Promise<AnaliseRisco | null> {
  const client = getClient();
  if (!client) return null;

  const texto = truncarTexto(textoEdital, 26000);

  const prompt = `Você é um advogado especialista em licitações públicas brasileiras. Analise o texto do edital abaixo e identifique RISCOS para a empresa licitante.

Avalie:
1. Cláusulas punitivas (multas, penalidades, sanções)
2. Garantias exigidas (cauções, seguros)
3. Prazos de execução apertados
4. Obrigações desproporcionais
5. Exigências de qualificação técnica restritivas
6. Responsabilidades solidárias
7. Cláusulas de rescisão unilateral
8. Condições financeiras desfavoráveis (reajuste, pagamento)

Texto do edital:
${texto}

Responda APENAS em JSON válido:
{
  "scoreRisco": <0 a 100, onde 0=sem risco, 100=risco máximo>,
  "nivelRisco": "baixo" | "moderado" | "alto" | "critico",
  "riscos": [
    {
      "categoria": "<Multas|Garantias|Prazos|Qualificação|Financeiro|Execução|Jurídico>",
      "descricao": "<descrição concisa do risco>",
      "severidade": "baixa" | "media" | "alta",
      "clausula": "<referência da cláusula se identificada>"
    }
  ],
  "multasIdentificadas": ["<multa 1>", "<multa 2>"],
  "garantiasExigidas": ["<garantia 1>"],
  "prazosRiscos": ["<prazo preocupante>"]
}`;

  try {
    console.log("[LLM] Analisando riscos do edital...");
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 3000,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content);
    return {
      scoreRisco: Math.min(100, Math.max(0, parsed.scoreRisco ?? 50)),
      nivelRisco: ["baixo", "moderado", "alto", "critico"].includes(parsed.nivelRisco) ? parsed.nivelRisco : "moderado",
      riscos: Array.isArray(parsed.riscos) ? parsed.riscos : [],
      multasIdentificadas: Array.isArray(parsed.multasIdentificadas) ? parsed.multasIdentificadas : [],
      garantiasExigidas: Array.isArray(parsed.garantiasExigidas) ? parsed.garantiasExigidas : [],
      prazosRiscos: Array.isArray(parsed.prazosRiscos) ? parsed.prazosRiscos : [],
    };
  } catch (err) {
    console.warn("[LLM] analisarRiscoEdital erro:", err instanceof Error ? err.message : err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Fase IA 4.2 — Score de Recomendação
// ---------------------------------------------------------------------------

export interface Recomendacao {
  score: number; // 0-100
  recomendacao: "participar" | "avaliar" | "evitar";
  justificativa: string;
  pontosPositivos: string[];
  pontosNegativos: string[];
}

export async function gerarRecomendacao(
  textoEdital: string,
  perfilEmpresa: string,
  percentualConformidade: number,
  scoreRisco: number
): Promise<Recomendacao | null> {
  const client = getClient();
  if (!client) return null;

  const texto = truncarTexto(textoEdital, 20000);

  const prompt = `Você é um consultor estratégico de licitações brasileiras. Avalie se vale a pena esta empresa participar desta licitação.

Perfil da empresa:
${perfilEmpresa}

Conformidade documental: ${percentualConformidade}%
Score de risco do edital: ${scoreRisco}/100

Texto do edital:
${texto}

Considere:
- Aderência do objeto ao perfil da empresa
- Complexidade do objeto vs capacidade presumida
- Conformidade documental atual
- Nível de risco
- Competitividade provável

Responda APENAS em JSON válido:
{
  "score": <0 a 100, onde 0=não participar, 100=participar com certeza>,
  "recomendacao": "participar" | "avaliar" | "evitar",
  "justificativa": "<2-3 frases>",
  "pontosPositivos": ["<ponto 1>"],
  "pontosNegativos": ["<ponto 1>"]
}`;

  try {
    console.log("[LLM] Gerando recomendação de participação...");
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      max_tokens: 1500,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content);
    return {
      score: Math.min(100, Math.max(0, parsed.score ?? 50)),
      recomendacao: ["participar", "avaliar", "evitar"].includes(parsed.recomendacao) ? parsed.recomendacao : "avaliar",
      justificativa: parsed.justificativa ?? "",
      pontosPositivos: Array.isArray(parsed.pontosPositivos) ? parsed.pontosPositivos : [],
      pontosNegativos: Array.isArray(parsed.pontosNegativos) ? parsed.pontosNegativos : [],
    };
  } catch (err) {
    console.warn("[LLM] gerarRecomendacao erro:", err instanceof Error ? err.message : err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Fase IA 4.3 — Rascunho de Proposta
// ---------------------------------------------------------------------------

export async function gerarRascunhoProposta(
  textoEdital: string,
  perfilEmpresa: string,
): Promise<string | null> {
  const client = getClient();
  if (!client) return null;

  const texto = truncarTexto(textoEdital, 22000);

  const prompt = `Você é um especialista em elaboração de propostas para licitações públicas brasileiras.

Com base no edital e no perfil da empresa, gere um RASCUNHO de proposta comercial/técnica.

Perfil da empresa:
${perfilEmpresa}

Edital:
${texto}

O rascunho deve conter:
1. **Identificação** — dados da empresa (usar placeholders como [RAZÃO SOCIAL], [CNPJ], etc)
2. **Objeto** — descrição do que está sendo proposto, alinhado ao objeto do edital
3. **Qualificação Técnica** — breve destaque de capacidades relevantes
4. **Proposta de Preço** — estrutura (usar [VALOR] como placeholder)
5. **Prazo de Execução** — conforme solicitado no edital
6. **Validade da Proposta** — conforme edital
7. **Declarações** — declarações padrão de licitação

Gere em texto corrido formatado, pronto para edição. Use marcadores [COMPLETAR] onde a empresa precisa preencher informações específicas.`;

  try {
    console.log("[LLM] Gerando rascunho de proposta...");
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 4000,
    });

    return response.choices[0]?.message?.content ?? null;
  } catch (err) {
    console.warn("[LLM] gerarRascunhoProposta erro:", err instanceof Error ? err.message : err);
    return null;
  }
}
