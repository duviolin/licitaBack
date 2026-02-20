import puppeteer, { type Browser, type Page, type HTTPResponse } from "puppeteer";

const NAVEGACAO_TIMEOUT = 30_000;
const ESPERA_CONTEUDO = 8_000;

let browserInstance: Browser | null = null;

export interface ProgressoEvento {
  etapa: string;
  mensagem: string;
  tipo: "info" | "sucesso" | "erro" | "detalhe";
}

export type OnProgresso = (evento: ProgressoEvento) => void;

async function getBrowser(onProgresso?: OnProgresso): Promise<Browser> {
  if (browserInstance?.connected) return browserInstance;
  onProgresso?.({ etapa: "navegador", mensagem: "Iniciando navegador...", tipo: "info" });
  browserInstance = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--single-process",
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

interface ScraperResult {
  pdfBuffer: Buffer;
  fonteUrl: string;
  metodo: string;
}

export async function buscarEditalNoPortal(
  portalUrl: string,
  onProgresso?: OnProgresso
): Promise<ScraperResult> {
  const emit = onProgresso ?? (() => {});

  emit({ etapa: "inicio", mensagem: `Iniciando busca em: ${portalUrl}`, tipo: "info" });

  const browser = await getBrowser(onProgresso);
  const page = await browser.newPage();

  try {
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );
    await page.setViewport({ width: 1280, height: 800 });

    const isPncp = portalUrl.includes("pncp.gov.br");

    if (isPncp) {
      emit({ etapa: "portal", mensagem: "Portal PNCP detectado — usando modo especializado", tipo: "detalhe" });
      return await scraperPncp(page, portalUrl, emit);
    }
    emit({ etapa: "portal", mensagem: "Portal desconhecido — usando modo genérico", tipo: "detalhe" });
    return await scraperGenerico(page, portalUrl, emit);
  } finally {
    await page.close();
  }
}

async function scraperPncp(page: Page, url: string, emit: OnProgresso): Promise<ScraperResult> {
  const arquivosCapturados: Array<{
    sequencialDocumento: number;
    url?: string;
    uri?: string;
    titulo?: string;
    tipoDocumentoDescricao?: string;
  }> = [];

  page.on("response", async (response: HTTPResponse) => {
    try {
      const reqUrl = response.url();
      if (reqUrl.includes("/arquivos") && !reqUrl.includes("/arquivos/") && response.ok()) {
        const data = await response.json();
        if (Array.isArray(data)) {
          arquivosCapturados.push(...data);
          emit({
            etapa: "interceptacao",
            mensagem: `API interceptada: ${data.length} arquivo(s) encontrado(s)`,
            tipo: "sucesso",
          });
          data.forEach((a: any, i: number) => {
            emit({
              etapa: "interceptacao",
              mensagem: `  ${i + 1}. ${a.titulo || a.tipoDocumentoDescricao || "Arquivo " + a.sequencialDocumento}`,
              tipo: "detalhe",
            });
          });
        }
      }
    } catch {
      // response não é JSON
    }
  });

  emit({ etapa: "navegacao", mensagem: `Navegando para ${new URL(url).hostname}...`, tipo: "info" });
  await page.goto(url, { waitUntil: "networkidle2", timeout: NAVEGACAO_TIMEOUT });
  emit({ etapa: "navegacao", mensagem: "Página carregada — aguardando conteúdo dinâmico...", tipo: "info" });
  await delay(ESPERA_CONTEUDO);

  if (arquivosCapturados.length > 0) {
    const editalArquivo = encontrarMelhorArquivo(arquivosCapturados);
    if (editalArquivo) {
      const nome = editalArquivo.titulo || editalArquivo.tipoDocumentoDescricao || "Arquivo";
      emit({ etapa: "selecao", mensagem: `Selecionado: "${nome}"`, tipo: "sucesso" });

      const pdfUrl = editalArquivo.url ||
        (editalArquivo.uri ? `https://pncp.gov.br/api/consulta/v1${editalArquivo.uri}` : null);
      if (pdfUrl) {
        emit({ etapa: "download", mensagem: `Baixando PDF de: ${pdfUrl.slice(0, 80)}...`, tipo: "info" });
        const pdfBuffer = await baixarPdfComBrowser(page, pdfUrl, emit);
        return { pdfBuffer, fonteUrl: pdfUrl, metodo: "pncp-api-intercept" };
      }
    }
  }

  emit({ etapa: "fallback", mensagem: "API não retornou arquivos — buscando links na página...", tipo: "info" });
  return await extrairPdfDaPagina(page, url, emit);
}

async function scraperGenerico(page: Page, url: string, emit: OnProgresso): Promise<ScraperResult> {
  emit({ etapa: "navegacao", mensagem: `Navegando para ${new URL(url).hostname}...`, tipo: "info" });
  await page.goto(url, { waitUntil: "networkidle2", timeout: NAVEGACAO_TIMEOUT });
  emit({ etapa: "navegacao", mensagem: "Página carregada — aguardando conteúdo...", tipo: "info" });
  await delay(ESPERA_CONTEUDO);

  emit({ etapa: "busca", mensagem: "Varrendo página em busca de links de PDF...", tipo: "info" });
  return await extrairPdfDaPagina(page, url, emit);
}

async function extrairPdfDaPagina(page: Page, baseUrl: string, emit: OnProgresso): Promise<ScraperResult> {
  emit({ etapa: "busca", mensagem: "Analisando todos os links e botões da página...", tipo: "info" });

  const links = await page.evaluate(() => {
    const anchors = Array.from(document.querySelectorAll("a[href]"));
    const buttons = Array.from(document.querySelectorAll("button, [role='button'], [onclick]"));

    const pdfLinks: Array<{ href: string; text: string; score: number }> = [];

    for (const a of anchors) {
      const href = a.getAttribute("href") || "";
      const text = (a.textContent || "").toLowerCase().trim();
      let score = 0;

      if (href.toLowerCase().endsWith(".pdf")) score += 5;
      if (href.includes("/arquivos/")) score += 3;
      if (text.includes("edital")) score += 10;
      if (text.includes("download")) score += 3;
      if (text.includes("baixar")) score += 3;
      if (text.includes("anexo")) score += 1;
      if (text.includes("ata")) score -= 2;
      if (text.includes("resultado")) score -= 2;

      if (score > 0) {
        pdfLinks.push({ href, text, score });
      }
    }

    for (const btn of buttons) {
      const text = (btn.textContent || "").toLowerCase().trim();
      const onclick = btn.getAttribute("onclick") || "";

      if (text.includes("edital") || text.includes("download") || text.includes("baixar")) {
        const urlMatch = onclick.match(/(https?:\/\/[^\s'"]+\.pdf)/i);
        if (urlMatch) {
          pdfLinks.push({ href: urlMatch[1], text, score: 8 });
        }
      }
    }

    return pdfLinks.sort((a, b) => b.score - a.score);
  });

  if (links.length === 0) {
    emit({ etapa: "erro", mensagem: "Nenhum link de edital encontrado na página", tipo: "erro" });
    throw new Error("Robô não encontrou nenhum link de edital na página");
  }

  emit({ etapa: "busca", mensagem: `Encontrou ${links.length} link(s) candidato(s)`, tipo: "sucesso" });
  links.slice(0, 3).forEach((l, i) => {
    emit({
      etapa: "busca",
      mensagem: `  ${i + 1}. [score=${l.score}] "${l.text.slice(0, 60)}"`,
      tipo: "detalhe",
    });
  });

  const melhor = links[0];
  const fullUrl = melhor.href.startsWith("http")
    ? melhor.href
    : new URL(melhor.href, baseUrl).toString();

  emit({ etapa: "selecao", mensagem: `Melhor candidato: "${melhor.text.slice(0, 60)}"`, tipo: "sucesso" });
  emit({ etapa: "download", mensagem: `Baixando PDF...`, tipo: "info" });

  const pdfBuffer = await baixarPdfComBrowser(page, fullUrl, emit);
  return { pdfBuffer, fonteUrl: fullUrl, metodo: "pagina-scraping" };
}

function encontrarMelhorArquivo(
  arquivos: Array<{
    sequencialDocumento: number;
    url?: string;
    uri?: string;
    titulo?: string;
    tipoDocumentoDescricao?: string;
  }>
) {
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
    emit({ etapa: "download", mensagem: `Arquivo muito pequeno (${buffer.length} bytes) — provavelmente inválido`, tipo: "erro" });
    throw new Error(`PDF muito pequeno (${buffer.length} bytes), provavelmente não é um PDF válido`);
  }

  const sizeMB = (buffer.length / 1024 / 1024).toFixed(2);
  emit({ etapa: "download", mensagem: `PDF baixado com sucesso (${sizeMB} MB)`, tipo: "sucesso" });
  return buffer;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
