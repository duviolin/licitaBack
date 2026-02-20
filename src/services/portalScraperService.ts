import puppeteer, { type Browser, type Page, type HTTPResponse } from "puppeteer";
import * as llm from "./llmService.js";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";

const NAVEGACAO_TIMEOUT = 45_000;
const ESPERA_CONTEUDO = 5_000;

let browserInstance: Browser | null = null;

export interface ProgressoEvento {
  etapa: string;
  mensagem: string;
  tipo: "info" | "sucesso" | "erro" | "detalhe";
}

export type OnProgresso = (evento: ProgressoEvento) => void;

async function getBrowser(onProgresso?: OnProgresso): Promise<Browser> {
  if (browserInstance?.connected) return browserInstance;
  onProgresso?.({ etapa: "navegador", mensagem: "Iniciando navegador Chrome...", tipo: "info" });
  browserInstance = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ],
  });
  onProgresso?.({ etapa: "navegador", mensagem: "Navegador pronto", tipo: "sucesso" });
  return browserInstance;
}

export async function fecharBrowser(): Promise<void> {
  if (browserInstance?.connected) {
    await browserInstance.close();
    browserInstance = null;
  }
}

export interface DocumentoEncontrado {
  nomeArquivo: string;
  tipoInformado: string;
  urlDownload: string;
  dataPublicacao: string;
}

interface ScraperResult {
  pdfBuffer: Buffer;
  fonteUrl: string;
  metodo: string;
  todosDocumentos: DocumentoEncontrado[];
}

interface PncpArquivoScraper {
  sequencialDocumento: number;
  url?: string;
  uri?: string;
  titulo?: string;
  tipoDocumentoDescricao?: string;
}

function parsePncpUrl(url: string): { cnpj: string; ano: string; seq: string } | null {
  const appMatch = url.match(/pncp\.gov\.br\/app\/editais\/(\d{14})\/(\d{4})\/(\d+)/);
  if (appMatch) {
    return { cnpj: appMatch[1], ano: appMatch[2], seq: appMatch[3] };
  }
  const apiMatch = url.match(/orgaos\/(\d{14})\/compras\/(\d+?)(\d{4})(?:\/|$)/);
  if (apiMatch) {
    return { cnpj: apiMatch[1], seq: apiMatch[2], ano: apiMatch[3] };
  }
  return null;
}

export async function buscarEditalNoPortal(
  portalUrl: string,
  onProgresso?: OnProgresso
): Promise<ScraperResult> {
  const emit = onProgresso ?? (() => {});

  emit({ etapa: "inicio", mensagem: `URL recebida: ${portalUrl}`, tipo: "info" });

  const browser = await getBrowser(onProgresso);
  const page = await browser.newPage();

  try {
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    );
    await page.setViewport({ width: 1280, height: 900 });

    const isPncp = portalUrl.includes("pncp.gov.br");
    const parsed = isPncp ? parsePncpUrl(portalUrl) : null;

    if (parsed) {
      emit({ etapa: "portal", mensagem: `PNCP detectado — CNPJ: ${parsed.cnpj}, Ano: ${parsed.ano}, Seq: ${parsed.seq}`, tipo: "detalhe" });
      return await scraperPncp(page, portalUrl, parsed, emit);
    }

    if (isPncp) {
      emit({ etapa: "portal", mensagem: "URL PNCP mas formato não reconhecido — usando modo genérico", tipo: "detalhe" });
    } else {
      emit({ etapa: "portal", mensagem: `Portal externo — usando modo visual`, tipo: "detalhe" });
    }
    return await scraperGenerico(page, portalUrl, emit);
  } finally {
    await page.close();
  }
}

// ---------------------------------------------------------------------------
// PNCP Scraper (5 estratégias via API)
// ---------------------------------------------------------------------------

async function scraperPncp(
  page: Page,
  url: string,
  parsed: { cnpj: string; ano: string; seq: string },
  emit: OnProgresso
): Promise<ScraperResult> {
  const todosDocumentos: DocumentoEncontrado[] = [];

  function registrarDocs(arquivos: PncpArquivoScraper[]) {
    for (const a of arquivos) {
      const nomeRaw = a.titulo || `Arquivo #${a.sequencialDocumento}`;
      const nomeLimpo = limparNomeDocumento(nomeRaw);
      const normNovo = normalizarParaComparacao(nomeLimpo);
      if (normNovo.length < 3) continue;
      const jaExiste = todosDocumentos.some((d) => {
        const normExist = normalizarParaComparacao(d.nomeArquivo);
        return normExist === normNovo || normExist.includes(normNovo) || normNovo.includes(normExist);
      });
      if (!jaExiste) {
        todosDocumentos.push({
          nomeArquivo: nomeLimpo,
          tipoInformado: a.tipoDocumentoDescricao || "",
          urlDownload: resolverUrlArquivo(a, parsed),
          dataPublicacao: "",
        });
      }
    }
  }

  // Estratégia 1: API direta
  emit({ etapa: "api", mensagem: "Tentativa 1: Chamando API de arquivos PNCP...", tipo: "info" });
  const apiUrl = `https://pncp.gov.br/api/pncp/v1/orgaos/${parsed.cnpj}/compras/${parsed.seq}${parsed.ano}/arquivos`;

  try {
    const arquivos = await chamarApiDireta<PncpArquivoScraper[]>(apiUrl);
    if (arquivos && arquivos.length > 0) {
      emit({ etapa: "api", mensagem: `API retornou ${arquivos.length} arquivo(s)`, tipo: "sucesso" });
      arquivos.forEach((a, i) => {
        emit({ etapa: "api", mensagem: `  ${i + 1}. ${a.titulo || a.tipoDocumentoDescricao || `Arquivo #${a.sequencialDocumento}`}`, tipo: "detalhe" });
      });
      registrarDocs(arquivos);

      const melhor = await encontrarMelhorArquivo(arquivos, emit);
      if (melhor) {
        const pdfUrl = resolverUrlArquivo(melhor, parsed);
        emit({ etapa: "selecao", mensagem: `Selecionado: "${melhor.titulo || melhor.tipoDocumentoDescricao}"`, tipo: "sucesso" });
        const pdfBuffer = await baixarPdfDireto(pdfUrl, emit);
        return { pdfBuffer, fonteUrl: pdfUrl, metodo: "pncp-api-direta", todosDocumentos };
      }
    } else {
      emit({ etapa: "api", mensagem: "API retornou lista vazia", tipo: "detalhe" });
    }
  } catch (err) {
    emit({ etapa: "api", mensagem: `Falha na API direta: ${err instanceof Error ? err.message : err}`, tipo: "erro" });
  }

  // Estratégia 2: API alternativa
  emit({ etapa: "api2", mensagem: "Tentativa 2: API alternativa (consulta/v1)...", tipo: "info" });
  const apiUrl2 = `https://pncp.gov.br/api/consulta/v1/orgaos/${parsed.cnpj}/compras/${parsed.seq}${parsed.ano}/arquivos`;
  try {
    const arquivos2 = await chamarApiDireta<PncpArquivoScraper[]>(apiUrl2);
    if (arquivos2 && arquivos2.length > 0) {
      emit({ etapa: "api2", mensagem: `API retornou ${arquivos2.length} arquivo(s)`, tipo: "sucesso" });
      registrarDocs(arquivos2);
      const melhor = await encontrarMelhorArquivo(arquivos2, emit);
      if (melhor) {
        const pdfUrl = resolverUrlArquivo(melhor, parsed);
        emit({ etapa: "selecao", mensagem: `Selecionado: "${melhor.titulo || melhor.tipoDocumentoDescricao}"`, tipo: "sucesso" });
        const pdfBuffer = await baixarPdfDireto(pdfUrl, emit);
        return { pdfBuffer, fonteUrl: pdfUrl, metodo: "pncp-api-consulta", todosDocumentos };
      }
    }
  } catch (err) {
    emit({ etapa: "api2", mensagem: `Falha: ${err instanceof Error ? err.message : err}`, tipo: "erro" });
  }

  // Estratégia 3: Download direto /arquivos/1
  emit({ etapa: "direto", mensagem: "Tentativa 3: Download direto primeiro arquivo...", tipo: "info" });
  const diretaUrl = `https://pncp.gov.br/api/pncp/v1/orgaos/${parsed.cnpj}/compras/${parsed.seq}${parsed.ano}/arquivos/1`;
  try {
    const pdfBuffer = await baixarPdfDireto(diretaUrl, emit);
    return { pdfBuffer, fonteUrl: diretaUrl, metodo: "pncp-arquivo-direto", todosDocumentos };
  } catch (err) {
    emit({ etapa: "direto", mensagem: `Falha: ${err instanceof Error ? err.message : err}`, tipo: "erro" });
  }

  // Estratégia 4: Navegar na SPA e interceptar
  emit({ etapa: "navegacao", mensagem: "Tentativa 4: Navegando na página SPA...", tipo: "info" });
  const pncpPageUrl = `https://pncp.gov.br/app/editais/${parsed.cnpj}/${parsed.ano}/${parsed.seq}`;
  const arquivosCapturados: PncpArquivoScraper[] = [];

  page.on("response", async (response: HTTPResponse) => {
    try {
      const reqUrl = response.url();
      if (reqUrl.includes("/arquivos") && response.ok()) {
        const contentType = response.headers()["content-type"] || "";
        if (contentType.includes("json")) {
          const data = await response.json();
          if (Array.isArray(data)) {
            arquivosCapturados.push(...data);
            emit({ etapa: "interceptacao", mensagem: `Interceptou ${data.length} arquivo(s) da API`, tipo: "sucesso" });
          }
        }
      }
    } catch { /* não é JSON */ }
  });

  await page.goto(pncpPageUrl, { waitUntil: "networkidle2", timeout: NAVEGACAO_TIMEOUT });
  await delay(ESPERA_CONTEUDO);

  if (arquivosCapturados.length > 0) {
    registrarDocs(arquivosCapturados);
    const melhor = await encontrarMelhorArquivo(arquivosCapturados, emit);
    if (melhor) {
      const pdfUrl = resolverUrlArquivo(melhor, parsed);
      emit({ etapa: "selecao", mensagem: `Interceptado: "${melhor.titulo || melhor.tipoDocumentoDescricao}"`, tipo: "sucesso" });
      const pdfBuffer = await baixarPdfComBrowser(page, pdfUrl, emit);
      return { pdfBuffer, fonteUrl: pdfUrl, metodo: "pncp-intercept-spa", todosDocumentos };
    }
  }

  // Estratégia 5: Ler conteúdo visual da página e clicar
  emit({ etapa: "visual", mensagem: "Tentativa 5: Lendo conteúdo visual da página...", tipo: "info" });
  return await scraperVisual(page, pncpPageUrl, emit, todosDocumentos);
}

// ---------------------------------------------------------------------------
// Scraper Genérico — NOVA ABORDAGEM: lê conteúdo visual + clica em botões
// ---------------------------------------------------------------------------

async function scraperGenerico(page: Page, url: string, emit: OnProgresso): Promise<ScraperResult> {
  emit({ etapa: "navegacao", mensagem: `Navegando para ${new URL(url).hostname}...`, tipo: "info" });
  await page.goto(url, { waitUntil: "networkidle2", timeout: NAVEGACAO_TIMEOUT });
  emit({ etapa: "navegacao", mensagem: "Página carregada — aguardando conteúdo dinâmico...", tipo: "info" });
  await delay(ESPERA_CONTEUDO);

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await delay(2000);
  await page.evaluate(() => window.scrollTo(0, 0));
  await delay(1000);

  emit({ etapa: "visual", mensagem: "Lendo conteúdo visual da página...", tipo: "info" });
  return await scraperVisual(page, url, emit, []);
}

// ---------------------------------------------------------------------------
// scraperVisual — Lê a página como um humano faria
// ---------------------------------------------------------------------------

interface DocumentoVisual {
  indice: number;
  nome: string;
  tipo: string;
  selectorBotao: string;
  textoCompleto: string;
}

async function scraperVisual(page: Page, baseUrl: string, emit: OnProgresso, todosDocumentos: DocumentoEncontrado[]): Promise<ScraperResult> {
  // 1. Extrair todo o conteúdo visível da página
  const pageData = await page.evaluate(() => {
    const title = document.title || "";
    const url = window.location.href;
    const bodyText = document.body?.innerText?.slice(0, 2000) || "";

    // Procurar TODOS os elementos clicáveis (links + botões) na página
    const clickables: Array<{
      tag: string;
      text: string;
      href: string;
      classes: string;
      parentText: string;
      index: number;
      isVisible: boolean;
    }> = [];

    const allElements = document.querySelectorAll("a, button, [role='button'], [onclick], .btn, [class*='download'], [class*='baixar']");
    let idx = 0;

    for (const el of Array.from(allElements)) {
      const rect = el.getBoundingClientRect();
      const isVisible = rect.width > 0 && rect.height > 0;
      const text = (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 150);
      const href = el.getAttribute("href") || "";
      const parentRow = el.closest("tr, .row, [class*='item'], [class*='card'], [class*='list']");
      const parentText = parentRow
        ? (parentRow.textContent || "").trim().replace(/\s+/g, " ").slice(0, 200)
        : (el.parentElement?.textContent || "").trim().replace(/\s+/g, " ").slice(0, 200);
      const classes = el.className?.toString?.() || "";

      clickables.push({
        tag: el.tagName.toLowerCase(),
        text,
        href,
        classes: classes.slice(0, 100),
        parentText,
        index: idx++,
        isVisible,
      });
    }

    // Procurar tabelas com documentos
    const tables: Array<{ headers: string[]; rows: string[][] }> = [];
    for (const table of Array.from(document.querySelectorAll("table"))) {
      const headers = Array.from(table.querySelectorAll("th")).map(
        (th) => (th.textContent || "").trim()
      );
      const rows: string[][] = [];
      for (const tr of Array.from(table.querySelectorAll("tbody tr, tr")).slice(0, 20)) {
        const cells = Array.from(tr.querySelectorAll("td, th")).map(
          (td) => (td.textContent || "").trim().replace(/\s+/g, " ").slice(0, 100)
        );
        if (cells.length > 0 && cells.some((c) => c.length > 0)) {
          rows.push(cells);
        }
      }
      if (rows.length > 0) {
        tables.push({ headers, rows });
      }
    }

    return { title, url, bodyText, clickables, tables };
  });

  // 2. Log detalhado: conteúdo da página
  emit({ etapa: "pagina", mensagem: `Título: "${pageData.title}"`, tipo: "detalhe" });
  emit({ etapa: "pagina", mensagem: `URL: ${pageData.url}`, tipo: "detalhe" });

  const preview = pageData.bodyText.replace(/\n+/g, " ").slice(0, 200);
  emit({ etapa: "pagina", mensagem: `Conteúdo: "${preview}..."`, tipo: "detalhe" });

  // 3. Log: tabelas encontradas
  if (pageData.tables.length > 0) {
    for (let t = 0; t < pageData.tables.length; t++) {
      const table = pageData.tables[t];
      emit({ etapa: "tabela", mensagem: `Tabela ${t + 1}: ${table.headers.join(" | ") || "(sem cabeçalho)"}`, tipo: "info" });
      table.rows.forEach((row, i) => {
        emit({ etapa: "tabela", mensagem: `  ${i + 1}. ${row.join(" | ")}`, tipo: "detalhe" });
      });
    }
  } else {
    emit({ etapa: "tabela", mensagem: "Nenhuma tabela encontrada na página", tipo: "detalhe" });
  }

  // 4. Log: elementos clicáveis relevantes (botões de download, links)
  const visibleClickables = pageData.clickables.filter((c) => c.isVisible);
  const downloadRelated = visibleClickables.filter((c) => {
    const lc = (c.text + " " + c.href + " " + c.classes + " " + c.parentText).toLowerCase();
    return lc.includes("download") || lc.includes("baixar") || lc.includes("edital")
      || lc.includes("arquivo") || lc.includes("pdf") || lc.includes("documento")
      || lc.includes("anexo");
  });

  emit({ etapa: "botoes", mensagem: `${visibleClickables.length} elementos clicáveis visíveis, ${downloadRelated.length} relacionados a documentos`, tipo: "info" });
  downloadRelated.slice(0, 15).forEach((c, i) => {
    const href = c.href ? ` → ${c.href.slice(0, 60)}` : "";
    emit({ etapa: "botoes", mensagem: `  ${i + 1}. <${c.tag}> "${c.text.slice(0, 60)}"${href}`, tipo: "detalhe" });
    if (c.parentText && c.parentText !== c.text) {
      emit({ etapa: "botoes", mensagem: `     contexto: "${c.parentText.slice(0, 80)}"`, tipo: "detalhe" });
    }
  });

  // 5. Montar lista de documentos detectados para IA decidir
  const documentosDetectados = montarListaDocumentos(pageData, emit);

  if (documentosDetectados.length === 0) {
    emit({ etapa: "fallback", mensagem: "Sem documentos detectados visualmente. Tentando links diretos...", tipo: "info" });
    const linkData = await extrairPageData(page);
    return await extrairPdfPorLinks(page, baseUrl, linkData, emit, todosDocumentos);
  }

  // Registrar documentos visuais (com deduplicação)
  for (const d of documentosDetectados) {
    const nomeLimpo = limparNomeDocumento(d.nome);
    const normNovo = normalizarParaComparacao(nomeLimpo);
    if (normNovo.length < 3) continue;
    const jaExiste = todosDocumentos.some((existing) => {
      const normExist = normalizarParaComparacao(existing.nomeArquivo);
      return normExist === normNovo || normExist.includes(normNovo) || normNovo.includes(normExist);
    });
    if (!jaExiste) {
      todosDocumentos.push({
        nomeArquivo: nomeLimpo,
        tipoInformado: d.tipo,
        urlDownload: "",
        dataPublicacao: "",
      });
    }
  }

  // 6. Usar IA para escolher o melhor documento
  let escolhido: DocumentoVisual;

  if (llm.isLLMDisponivel() && documentosDetectados.length > 1) {
    emit({ etapa: "llm", mensagem: `Enviando ${documentosDetectados.length} documentos para IA identificar o edital...`, tipo: "info" });

    const linksParaIA = documentosDetectados.map((d, i) => ({
      indice: i,
      texto: `${d.nome} (${d.tipo})`.trim(),
      href: d.textoCompleto,
    }));

    const resultado = await llm.selecionarMelhorLink(linksParaIA);
    if (resultado && documentosDetectados[resultado.indiceEscolhido]) {
      escolhido = documentosDetectados[resultado.indiceEscolhido];
      emit({
        etapa: "llm",
        mensagem: `IA escolheu: "${escolhido.nome}" (confiança: ${resultado.confianca})`,
        tipo: "sucesso",
      });
      emit({ etapa: "llm", mensagem: `Justificativa: ${resultado.justificativa}`, tipo: "detalhe" });
    } else {
      escolhido = escolherPorKeywords(documentosDetectados);
      emit({ etapa: "llm", mensagem: "IA não respondeu, usando keywords", tipo: "detalhe" });
    }
  } else if (documentosDetectados.length === 1) {
    escolhido = documentosDetectados[0];
    emit({ etapa: "selecao", mensagem: `Único documento encontrado: "${escolhido.nome}"`, tipo: "info" });
  } else {
    escolhido = escolherPorKeywords(documentosDetectados);
  }

  emit({ etapa: "selecao", mensagem: `Clicando em: "${escolhido.nome}"`, tipo: "sucesso" });

  // 7. Clicar no botão e capturar o download
  return await clicarEBaixar(page, escolhido, baseUrl, emit, todosDocumentos);
}

// ---------------------------------------------------------------------------
// Monta lista de documentos a partir do conteúdo visual da página
// ---------------------------------------------------------------------------

function limparNomeDocumento(raw: string): string {
  let nome = raw.trim();
  // Remover textos de ação de download
  nome = nome.replace(/\b(baixar|download|clique aqui|ver|abrir|salvar)\s*(arquivo|documento|pdf)?\b/gi, "");
  // Remover datas soltas tipo "01/02/2025" ou "2025-01-02" quando são o nome inteiro
  nome = nome.replace(/^\s*\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\s*$/g, "");
  // Remover datas no meio do texto (manter o resto)
  nome = nome.replace(/\s*\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\s*/g, " ");
  // Remover extensões e lixo
  nome = nome.replace(/\.(pdf|doc|docx|xls|xlsx|zip|rar)\b/gi, "");
  // Remover pipes, barras e excesso de espaço
  nome = nome.replace(/\s*\|\s*/g, " ").replace(/\s{2,}/g, " ").trim();
  // Se ficou vazio, retornar algo
  return nome || raw.trim();
}

function normalizarParaComparacao(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function jaExisteDocumento(
  docs: DocumentoVisual[],
  novoNome: string
): boolean {
  const norm = normalizarParaComparacao(novoNome);
  if (norm.length < 3) return true; // nome vazio/lixo
  return docs.some((d) => {
    const existente = normalizarParaComparacao(d.nome);
    return existente === norm || existente.includes(norm) || norm.includes(existente);
  });
}

function montarListaDocumentos(
  pageData: {
    tables: Array<{ headers: string[]; rows: string[][] }>;
    clickables: Array<{
      tag: string; text: string; href: string; classes: string;
      parentText: string; index: number; isVisible: boolean;
    }>;
  },
  emit: OnProgresso
): DocumentoVisual[] {
  const docs: DocumentoVisual[] = [];
  let idx = 0;

  // Documentos em tabelas
  for (const table of pageData.tables) {
    for (const row of table.rows) {
      const rowText = row.join(" ").toLowerCase();
      if (rowText.includes("edital") || rowText.includes("pdf") || rowText.includes("documento")
        || rowText.includes("anexo") || rowText.includes("arquivo") || rowText.includes("termo")
        || rowText.includes("baixar") || rowText.includes("download")) {

        // Pegar a primeira célula que não seja "Baixar" ou uma data pura
        let nome = "";
        for (const cell of row) {
          const cellClean = cell.trim();
          if (!cellClean) continue;
          const cellLC = cellClean.toLowerCase();
          if (cellLC === "baixar" || cellLC === "download" || cellLC === "baixar arquivo") continue;
          if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test(cellClean)) continue;
          if (/^\d+(\.\d+)?\s*(kb|mb|gb|bytes?)$/i.test(cellClean)) continue;
          nome = cellClean;
          break;
        }
        if (!nome) nome = row[0] || "";
        nome = limparNomeDocumento(nome);

        const tipo = row.length > 1 ? limparNomeDocumento(row[1]) : "";

        if (jaExisteDocumento(docs, nome)) continue;

        const downloadBtn = pageData.clickables.find((c) => {
          if (!c.isVisible) return false;
          const cText = c.text.toLowerCase();
          const cParent = c.parentText.toLowerCase();
          const nomeLC = nome.toLowerCase().slice(0, 30);
          return (cText.includes("baixar") || cText.includes("download"))
            && (cParent.includes(nomeLC) || cParent.includes(row.join(" ").toLowerCase().slice(0, 30)));
        });

        if (downloadBtn) {
          docs.push({
            indice: idx++,
            nome: nome.trim(),
            tipo: tipo.trim(),
            selectorBotao: `[data-scraper-idx="${downloadBtn.index}"]`,
            textoCompleto: row.join(" | "),
          });
        }
      }
    }
  }

  // Fallback: botões com contexto
  if (docs.length === 0) {
    const downloadBtns = pageData.clickables.filter((c) => {
      if (!c.isVisible) return false;
      const t = (c.text + " " + c.classes).toLowerCase();
      return t.includes("baixar") || t.includes("download") || t.includes("edital");
    });

    for (const btn of downloadBtns) {
      let nome = btn.parentText || btn.text;
      nome = limparNomeDocumento(nome);
      if (jaExisteDocumento(docs, nome)) continue;

      docs.push({
        indice: idx++,
        nome: nome.slice(0, 100),
        tipo: "",
        selectorBotao: `[data-scraper-idx="${btn.index}"]`,
        textoCompleto: `${btn.text} | contexto: ${btn.parentText}`,
      });
    }
  }

  if (docs.length > 0) {
    emit({ etapa: "docs", mensagem: `${docs.length} documento(s) detectado(s) na página:`, tipo: "sucesso" });
    docs.forEach((d) => {
      emit({ etapa: "docs", mensagem: `  ${d.indice + 1}. "${d.nome}" (${d.tipo || "sem tipo"})`, tipo: "detalhe" });
    });
  }

  return docs;
}

function escolherPorKeywords(docs: DocumentoVisual[]): DocumentoVisual {
  const scored = docs.map((d) => {
    const text = `${d.nome} ${d.tipo}`.toLowerCase();
    let score = 0;
    if (text.includes("edital") && text.includes("anexo")) score += 15;
    if (text.includes("edital")) score += 10;
    if (text.includes("consolidado") || text.includes("retificado")) score += 5;
    if (text.includes("ata")) score -= 10;
    if (text.includes("resultado")) score -= 10;
    if (text.includes("impugna")) score -= 5;
    if (text.includes("orcamento") || text.includes("orçamento")) score -= 3;
    if (text.includes("etp") || text.includes("estudo")) score -= 3;
    return { doc: d, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0].doc;
}

// ---------------------------------------------------------------------------
// Clicar no botão de download e capturar o PDF
// ---------------------------------------------------------------------------

async function clicarEBaixar(
  page: Page,
  doc: DocumentoVisual,
  baseUrl: string,
  emit: OnProgresso,
  todosDocumentos: DocumentoEncontrado[]
): Promise<ScraperResult> {
  // Marcar todos os elementos clicáveis com um atributo para poder selecionar
  await page.evaluate(() => {
    const allElements = document.querySelectorAll("a, button, [role='button'], [onclick], .btn, [class*='download'], [class*='baixar']");
    let idx = 0;
    for (const el of Array.from(allElements)) {
      el.setAttribute("data-scraper-idx", String(idx++));
    }
  });

  // Preparar interceptação de downloads
  const downloadDir = path.join(os.tmpdir(), `scraper-${Date.now()}`);
  fs.mkdirSync(downloadDir, { recursive: true });

  const client = await page.createCDPSession();
  await client.send("Page.setDownloadBehavior", {
    behavior: "allow",
    downloadPath: downloadDir,
  });

  // Interceptar respostas de rede que sejam PDF
  let pdfCaptured: Buffer | null = null;
  let pdfUrl = "";

  const responseHandler = async (response: HTTPResponse) => {
    try {
      if (pdfCaptured) return;
      const ct = response.headers()["content-type"] || "";
      const respUrl = response.url();
      const disp = response.headers()["content-disposition"] || "";

      if (
        (ct.includes("pdf") || ct.includes("octet-stream") || disp.includes(".pdf"))
        && response.ok()
      ) {
        emit({ etapa: "interceptacao", mensagem: `Interceptou resposta PDF: ${respUrl.slice(0, 80)}`, tipo: "sucesso" });
        const buffer = await response.buffer();
        if (buffer.length > 500) {
          pdfCaptured = buffer;
          pdfUrl = respUrl;
        }
      }
    } catch {
      // response may be disposed
    }
  };

  page.on("response", responseHandler);

  // Tentar encontrar e clicar o botão
  emit({ etapa: "click", mensagem: `Clicando no botão de download...`, tipo: "info" });

  try {
    const btnSelector = doc.selectorBotao;
    const btnEl = await page.$(btnSelector);

    if (btnEl) {
      await btnEl.click();
      emit({ etapa: "click", mensagem: "Clique realizado — aguardando download...", tipo: "info" });
    } else {
      // Fallback: tentar encontrar por texto
      emit({ etapa: "click", mensagem: "Botão não encontrado por selector, tentando por texto...", tipo: "detalhe" });
      const clicked = await tentarClicarPorTexto(page, doc.nome, emit);
      if (!clicked) {
        throw new Error("Não foi possível encontrar o botão de download");
      }
    }

    // Aguardar PDF (interceção de rede ou arquivo salvo)
    for (let i = 0; i < 15; i++) {
      if (pdfCaptured) break;
      await delay(1000);

      // Verificar se um arquivo apareceu no diretório de download
      if (!pdfCaptured) {
        const files = fs.readdirSync(downloadDir);
        const pdfFile = files.find((f) => f.endsWith(".pdf") || f.endsWith(".tmp") || !f.includes(".crdownload"));
        if (pdfFile && !pdfFile.endsWith(".crdownload")) {
          const filePath = path.join(downloadDir, pdfFile);
          const stats = fs.statSync(filePath);
          if (stats.size > 500) {
            emit({ etapa: "download", mensagem: `Arquivo salvo: ${pdfFile}`, tipo: "sucesso" });
            pdfCaptured = fs.readFileSync(filePath);
            pdfUrl = baseUrl;
            break;
          }
        }
      }

      if (i === 5) {
        emit({ etapa: "download", mensagem: "Ainda aguardando download...", tipo: "detalhe" });
      }
    }

    page.off("response", responseHandler);

    if (pdfCaptured) {
      const sizeMB = (pdfCaptured.length / 1024 / 1024).toFixed(2);
      emit({ etapa: "download", mensagem: `PDF capturado! (${sizeMB} MB, ${pdfCaptured.length.toLocaleString()} bytes)`, tipo: "sucesso" });

      // Limpar temp
      try { fs.rmSync(downloadDir, { recursive: true }); } catch { /* ignore */ }

      return { pdfBuffer: pdfCaptured, fonteUrl: pdfUrl || baseUrl, metodo: "visual-click", todosDocumentos };
    }

    // Não interceptou — talvez o link abriu uma nova aba ou redirect
    emit({ etapa: "download", mensagem: "Download não interceptado via rede — tentando popup/nova aba...", tipo: "detalhe" });

    // Verificar se abriu nova aba
    const pages = await page.browser().pages();
    if (pages.length > 1) {
      const lastPage = pages[pages.length - 1];
      const lastUrl = lastPage.url();
      emit({ etapa: "download", mensagem: `Nova aba detectada: ${lastUrl.slice(0, 80)}`, tipo: "info" });

      if (lastUrl.includes(".pdf") || lastUrl.includes("download") || lastUrl.includes("arquivo")) {
        emit({ etapa: "download", mensagem: "Baixando da nova aba...", tipo: "info" });
        const buffer = await baixarPdfComBrowser(lastPage, lastUrl, emit);
        await lastPage.close();
        try { fs.rmSync(downloadDir, { recursive: true }); } catch { /* ignore */ }
        return { pdfBuffer: buffer, fonteUrl: lastUrl, metodo: "visual-click-newtab", todosDocumentos };
      }
    }

    try { fs.rmSync(downloadDir, { recursive: true }); } catch { /* ignore */ }
    throw new Error("Não foi possível capturar o PDF após o clique");

  } catch (err) {
    page.off("response", responseHandler);
    try { fs.rmSync(downloadDir, { recursive: true }); } catch { /* ignore */ }

    emit({ etapa: "click", mensagem: `Falha no clique: ${err instanceof Error ? err.message : err}`, tipo: "erro" });

    // Último fallback: tentar links diretos
    emit({ etapa: "fallback", mensagem: "Tentando extrair links diretos da página...", tipo: "info" });
    const pageData = await extrairPageData(page);
    return await extrairPdfPorLinks(page, baseUrl, pageData, emit, todosDocumentos);
  }
}

async function tentarClicarPorTexto(page: Page, nomeDoc: string, emit: OnProgresso): Promise<boolean> {
  const primeiraPalavra = nomeDoc.split(/[\s_-]/)[0].toLowerCase();

  // Tentar achar um botão "Baixar" / "Download" perto do nome do documento
  const clicked = await page.evaluate((keyword: string) => {
    const buttons = document.querySelectorAll("a, button, [role='button']");
    for (const btn of Array.from(buttons)) {
      const text = (btn.textContent || "").toLowerCase();
      const parent = btn.closest("tr, .row, [class*='item'], [class*='card']");
      const parentText = (parent?.textContent || "").toLowerCase();

      if ((text.includes("baixar") || text.includes("download")) && parentText.includes(keyword)) {
        (btn as HTMLElement).click();
        return true;
      }
    }
    // Tentar achar link que tenha o nome do arquivo
    for (const a of Array.from(document.querySelectorAll("a"))) {
      const href = a.getAttribute("href") || "";
      if (href.toLowerCase().includes(keyword) && (href.includes(".pdf") || href.includes("download"))) {
        (a as HTMLElement).click();
        return true;
      }
    }
    return false;
  }, primeiraPalavra);

  if (clicked) {
    emit({ etapa: "click", mensagem: `Clique via texto "${primeiraPalavra}" — aguardando download...`, tipo: "info" });
  }
  return clicked;
}

// ---------------------------------------------------------------------------
// Fallback: extração por links diretos (abordagem anterior)
// ---------------------------------------------------------------------------

async function extrairPageData(page: Page) {
  return await page.evaluate(() => {
    const anchors = Array.from(document.querySelectorAll("a[href]"));
    const todosLinks: Array<{ href: string; text: string; source: string }> = [];
    for (const a of anchors) {
      const href = a.getAttribute("href") || "";
      const text = (a.textContent || "").trim().replace(/\s+/g, " ").slice(0, 120);
      if (href && href !== "#" && !href.startsWith("javascript:")) {
        todosLinks.push({ href, text, source: "anchor" });
      }
    }
    return { todosLinks };
  });
}

async function extrairPdfPorLinks(
  page: Page,
  baseUrl: string,
  pageData: { todosLinks: Array<{ href: string; text: string; source: string }> },
  emit: OnProgresso,
  todosDocumentos: DocumentoEncontrado[] = []
): Promise<ScraperResult> {
  emit({ etapa: "links", mensagem: `Analisando ${pageData.todosLinks.length} links diretos...`, tipo: "info" });

  const pdfLinks = pageData.todosLinks
    .map((l) => {
      const href = l.href.toLowerCase();
      const text = l.text.toLowerCase();
      let score = 0;
      if (href.endsWith(".pdf")) score += 5;
      if (href.includes("edital")) score += 6;
      if (href.includes("download")) score += 3;
      if (href.includes("/arquivos/")) score += 4;
      if (text.includes("edital")) score += 10;
      if (text.includes("download") || text.includes("baixar")) score += 4;
      if (text.includes("pdf")) score += 3;
      if (text.includes("ata ")) score -= 5;
      if (text.includes("resultado")) score -= 5;
      if (score > 0 || href.endsWith(".pdf")) {
        return { ...l, score: Math.max(score, 1) };
      }
      return null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.score - a.score);

  pageData.todosLinks.slice(0, 20).forEach((l, i) => {
    emit({ etapa: "links", mensagem: `  ${i + 1}. "${l.text.slice(0, 50)}" → ${l.href.slice(0, 70)}`, tipo: "detalhe" });
  });

  if (pdfLinks.length === 0) {
    emit({ etapa: "erro", mensagem: "Nenhum link de PDF encontrado na página", tipo: "erro" });
    throw new Error("Robô não encontrou nenhum link de edital. Use link manual ou upload.");
  }

  emit({ etapa: "links", mensagem: `${pdfLinks.length} link(s) candidato(s):`, tipo: "info" });
  pdfLinks.forEach((l, i) => {
    emit({ etapa: "links", mensagem: `  ${i + 1}. [score=${l.score}] "${l.text.slice(0, 50)}" → ${l.href.slice(0, 70)}`, tipo: "detalhe" });
  });

  let melhor = pdfLinks[0];

  if (llm.isLLMDisponivel() && pageData.todosLinks.length > 1) {
    const linksParaIA = pageData.todosLinks.slice(0, 40).map((l, i) => ({
      indice: i,
      texto: l.text.slice(0, 100),
      href: l.href,
    }));
    emit({ etapa: "llm", mensagem: `Consultando IA com ${linksParaIA.length} links...`, tipo: "info" });
    const resultado = await llm.selecionarMelhorLink(linksParaIA);
    if (resultado) {
      const escolhido = pageData.todosLinks[resultado.indiceEscolhido];
      if (escolhido) {
        emit({ etapa: "llm", mensagem: `IA escolheu: "${escolhido.text.slice(0, 50)}" (${resultado.confianca})`, tipo: "sucesso" });
        melhor = { ...escolhido, score: 100 };
      }
    }
  }

  const fullUrl = melhor.href.startsWith("http")
    ? melhor.href
    : new URL(melhor.href, baseUrl).toString();

  emit({ etapa: "download", mensagem: `Baixando: ${fullUrl.slice(0, 80)}`, tipo: "info" });
  const pdfBuffer = await baixarPdfComBrowser(page, fullUrl, emit);
  return { pdfBuffer, fonteUrl: fullUrl, metodo: "links-diretos", todosDocumentos };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function chamarApiDireta<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
  return response.json() as Promise<T>;
}

async function baixarPdfDireto(url: string, emit: OnProgresso): Promise<Buffer> {
  const response = await fetch(url, {
    headers: {
      Accept: "application/pdf,application/octet-stream,*/*",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
    redirect: "follow",
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  if (buffer.length < 500) throw new Error(`Arquivo muito pequeno (${buffer.length} bytes)`);

  const sizeMB = (buffer.length / 1024 / 1024).toFixed(2);
  emit({ etapa: "download", mensagem: `PDF baixado (${sizeMB} MB, ${buffer.length.toLocaleString()} bytes)`, tipo: "sucesso" });
  return buffer;
}

function resolverUrlArquivo(
  arquivo: PncpArquivoScraper,
  parsed: { cnpj: string; ano: string; seq: string }
): string {
  if (arquivo.url) return arquivo.url;
  if (arquivo.uri) return `https://pncp.gov.br/api/pncp/v1${arquivo.uri}`;
  return `https://pncp.gov.br/api/pncp/v1/orgaos/${parsed.cnpj}/compras/${parsed.seq}${parsed.ano}/arquivos/${arquivo.sequencialDocumento}`;
}

async function encontrarMelhorArquivo(
  arquivos: PncpArquivoScraper[],
  emit?: OnProgresso
): Promise<PncpArquivoScraper | null> {
  if (arquivos.length === 0) return null;

  if (llm.isLLMDisponivel() && arquivos.length > 1) {
    emit?.({ etapa: "llm", mensagem: "Consultando IA para identificar o edital...", tipo: "info" });
    const resultado = await llm.selecionarEdital(
      arquivos.map((a, i) => ({
        indice: i,
        titulo: a.titulo,
        tipoDocumento: a.tipoDocumentoDescricao,
        url: a.url || a.uri,
      }))
    );
    if (resultado) {
      const escolhido = arquivos[resultado.indiceEscolhido];
      if (escolhido) {
        emit?.({
          etapa: "llm",
          mensagem: `IA escolheu [${resultado.indiceEscolhido}] "${escolhido.titulo || escolhido.tipoDocumentoDescricao}" (${resultado.confianca}) — ${resultado.justificativa}`,
          tipo: "sucesso",
        });
        return escolhido;
      }
    }
    emit?.({ etapa: "llm", mensagem: "IA não respondeu, usando keywords", tipo: "detalhe" });
  }

  const edital = arquivos.find(
    (a) =>
      a.tipoDocumentoDescricao?.toLowerCase().includes("edital") ||
      a.titulo?.toLowerCase().includes("edital")
  );
  return edital || arquivos[0] || null;
}

async function baixarPdfComBrowser(page: Page, url: string, emit: OnProgresso): Promise<Buffer> {
  const response = await page.evaluate(async (pdfUrl: string) => {
    const res = await fetch(pdfUrl, {
      headers: { Accept: "application/pdf,*/*" },
      credentials: "include",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = await res.arrayBuffer();
    return Array.from(new Uint8Array(buf));
  }, url);

  const buffer = Buffer.from(response);

  if (buffer.length < 500) {
    emit({ etapa: "download", mensagem: `Arquivo muito pequeno (${buffer.length} bytes)`, tipo: "erro" });
    throw new Error(`PDF muito pequeno (${buffer.length} bytes)`);
  }

  const sizeMB = (buffer.length / 1024 / 1024).toFixed(2);
  emit({ etapa: "download", mensagem: `PDF baixado (${sizeMB} MB, ${buffer.length.toLocaleString()} bytes)`, tipo: "sucesso" });
  return buffer;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
