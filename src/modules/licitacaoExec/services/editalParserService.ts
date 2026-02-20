import { createRequire } from "node:module";
import { limparTextoEdital } from "../utils/editalRegex.js";

const require = createRequire(import.meta.url);
const { PDFParse } = require("pdf-parse") as {
  PDFParse: new (opts: { data: Buffer | Uint8Array }) => {
    getText(): Promise<{ text: string; total: number }>;
    destroy(): void;
  };
};

export async function baixarPDF(url: string): Promise<Buffer> {
  console.log(`[EditalParser] Baixando PDF: ${url}`);

  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      Accept: "application/pdf,*/*",
    },
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(
      `Erro ao baixar edital: HTTP ${response.status} - ${response.statusText}`
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (buffer.length < 100) {
    throw new Error("PDF baixado parece estar vazio ou corrompido");
  }

  console.log(`[EditalParser] PDF baixado: ${buffer.length} bytes`);
  return buffer;
}

export async function extrairTexto(pdfBuffer: Buffer): Promise<string> {
  console.log("[EditalParser] Extraindo texto do PDF...");

  const parser = new PDFParse({ data: pdfBuffer });
  const result = await parser.getText();
  parser.destroy();

  if (!result.text || result.text.trim().length === 0) {
    throw new Error(
      "Não foi possível extrair texto do PDF. O documento pode ser uma imagem escaneada."
    );
  }

  console.log(
    `[EditalParser] Texto extraído: ${result.text.length} caracteres, ${result.total} páginas`
  );
  return result.text;
}

export function limparTexto(textoRaw: string): string {
  return limparTextoEdital(textoRaw);
}

export async function processarEdital(url: string): Promise<string> {
  const pdfBuffer = await baixarPDF(url);
  const textoRaw = await extrairTexto(pdfBuffer);
  return limparTexto(textoRaw);
}
