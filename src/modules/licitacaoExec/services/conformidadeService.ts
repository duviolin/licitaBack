import * as empresaDocRepo from "../repositories/empresaDocumentoRepository.js";
import type { ConformidadeStatus, DocumentoExigido } from "../../../generated/prisma/client.js";

interface ConformidadeItem {
  documentoExigidoId: string;
  empresaDocumentoId: string | null;
  status: ConformidadeStatus;
  observacao: string;
}

export async function verificarConformidade(
  empresaId: string,
  documentosExigidos: DocumentoExigido[],
  dataSessao?: Date | null
): Promise<ConformidadeItem[]> {
  console.log(
    `[Conformidade] Verificando ${documentosExigidos.length} documentos para empresa ${empresaId}`
  );

  const docsEmpresa = await empresaDocRepo.findByEmpresaId(empresaId);
  const dataReferencia = dataSessao ?? new Date();
  const resultados: ConformidadeItem[] = [];

  for (const exigido of documentosExigidos) {
    const docsCompativeis = docsEmpresa.filter(
      (d) => d.tipo === exigido.tipo
    );

    if (docsCompativeis.length === 0) {
      resultados.push({
        documentoExigidoId: exigido.id,
        empresaDocumentoId: null,
        status: "AUSENTE",
        observacao: `Documento "${exigido.nome}" não encontrado nos documentos da empresa`,
      });
      continue;
    }

    const docMaisRecente = docsCompativeis.sort((a, b) => {
      if (!a.validade && !b.validade) return 0;
      if (!a.validade) return 1;
      if (!b.validade) return -1;
      return b.validade.getTime() - a.validade.getTime();
    })[0];

    if (docMaisRecente.status === "VENCIDO") {
      resultados.push({
        documentoExigidoId: exigido.id,
        empresaDocumentoId: docMaisRecente.id,
        status: "VENCIDO",
        observacao: `Documento "${exigido.nome}" está com status VENCIDO`,
      });
      continue;
    }

    if (docMaisRecente.validade) {
      const validade = new Date(docMaisRecente.validade);
      if (validade < dataReferencia) {
        resultados.push({
          documentoExigidoId: exigido.id,
          empresaDocumentoId: docMaisRecente.id,
          status: "VENCIDO",
          observacao: `Documento "${exigido.nome}" vence em ${validade.toLocaleDateString("pt-BR")} — anterior à data de referência ${dataReferencia.toLocaleDateString("pt-BR")}`,
        });
        continue;
      }
    }

    if (
      exigido.autenticacaoExigida &&
      docMaisRecente.arquivoUrl === ""
    ) {
      resultados.push({
        documentoExigidoId: exigido.id,
        empresaDocumentoId: docMaisRecente.id,
        status: "INCOMPATIVEL",
        observacao: `Documento "${exigido.nome}" exige autenticação/arquivo e nenhum foi anexado`,
      });
      continue;
    }

    resultados.push({
      documentoExigidoId: exigido.id,
      empresaDocumentoId: docMaisRecente.id,
      status: "OK",
      observacao: "",
    });
  }

  const resumo = {
    ok: resultados.filter((r) => r.status === "OK").length,
    ausente: resultados.filter((r) => r.status === "AUSENTE").length,
    vencido: resultados.filter((r) => r.status === "VENCIDO").length,
    incompativel: resultados.filter((r) => r.status === "INCOMPATIVEL").length,
  };

  console.log(`[Conformidade] Resultado: ${JSON.stringify(resumo)}`);
  return resultados;
}
