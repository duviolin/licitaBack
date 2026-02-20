import * as empresaDocRepo from "../repositories/empresaDocumentoRepository.js";
import * as llmService from "../../../services/llmService.js";
import type { ConformidadeStatus, DocumentoExigido } from "../../../generated/prisma/client.js";

interface ConformidadeItem {
  documentoExigidoId: string;
  empresaDocumentoId: string | null;
  status: ConformidadeStatus;
  observacao: string;
  sugestao: string;
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
        sugestao: "",
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
        sugestao: "",
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
          sugestao: "",
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
        sugestao: "",
      });
      continue;
    }

    resultados.push({
      documentoExigidoId: exigido.id,
      empresaDocumentoId: docMaisRecente.id,
      status: "OK",
      observacao: "",
      sugestao: "",
    });
  }

  // --- Fase IA 2.1: Matching semântico para documentos AUSENTES ---
  if (llmService.isLLMDisponivel()) {
    const ausentes = resultados.filter((r) => r.status === "AUSENTE");
    if (ausentes.length > 0 && docsEmpresa.length > 0) {
      const idsJaUsados = new Set(
        resultados.filter((r) => r.empresaDocumentoId).map((r) => r.empresaDocumentoId!)
      );
      const docsDisponiveis = docsEmpresa.filter((d) => !idsJaUsados.has(d.id));

      if (docsDisponiveis.length > 0) {
        console.log(`[Conformidade] Tentando matching semântico para ${ausentes.length} doc(s) ausente(s)...`);
        const docsExigidosSemMatch: llmService.DocExigidoParaMatching[] = ausentes.map((a) => {
          const exigido = documentosExigidos.find((d) => d.id === a.documentoExigidoId)!;
          return {
            id: exigido.id,
            tipo: exigido.tipo,
            nome: exigido.nome,
            secaoEdital: exigido.secaoEdital,
          };
        });

        const docsEmpresaFormatados: llmService.DocEmpresaParaMatching[] = docsDisponiveis.map((d) => ({
          id: d.id,
          tipo: d.tipo,
          nome: d.nome,
          status: d.status,
          validade: d.validade ? d.validade.toISOString().split("T")[0] : null,
        }));

        const matches = await llmService.matchSemanticoDocumentos(docsEmpresaFormatados, docsExigidosSemMatch);

        for (const match of matches) {
          const fullExigidoId = ausentes.find(
            (a) => documentosExigidos.find((d) => d.id === a.documentoExigidoId)?.id.startsWith(match.documentoExigidoId)
          )?.documentoExigidoId;

          if (!match.empresaDocumentoId?.trim()) continue;

          const fullEmpresaId = docsDisponiveis.find(
            (d) => d.id.startsWith(match.empresaDocumentoId!)
          )?.id;

          if (!fullExigidoId || !fullEmpresaId) continue;

          const idx = resultados.findIndex((r) => r.documentoExigidoId === fullExigidoId);
          if (idx === -1) continue;

          const docEmpresa = docsDisponiveis.find((d) => d.id === fullEmpresaId);
          if (!docEmpresa) continue;

          if (docEmpresa.status === "VENCIDO" || (docEmpresa.validade && new Date(docEmpresa.validade) < dataReferencia)) {
            resultados[idx] = {
              documentoExigidoId: fullExigidoId,
              empresaDocumentoId: fullEmpresaId,
              status: "VENCIDO",
              observacao: `Match semântico (IA, ${match.confianca}): ${match.justificativa}. Porém o documento está vencido.`,
              sugestao: "",
            };
          } else {
            resultados[idx] = {
              documentoExigidoId: fullExigidoId,
              empresaDocumentoId: fullEmpresaId,
              status: "OK",
              observacao: `Match semântico (IA, ${match.confianca}): ${match.justificativa}`,
              sugestao: "",
            };
          }

          console.log(`[Conformidade] Match semântico: ${fullExigidoId.slice(0, 8)} ↔ ${fullEmpresaId.slice(0, 8)} (${match.confianca})`);
        }
      }
    }
  }

  // --- Fase IA 2.2: Sugestões de ação para documentos pendentes ---
  if (llmService.isLLMDisponivel()) {
    const naoOk = resultados.filter((r) => r.status !== "OK");
    if (naoOk.length > 0) {
      console.log(`[Conformidade] Gerando sugestões para ${naoOk.length} doc(s) pendente(s)...`);
      const itensParaSugestao = naoOk.map((r) => {
        const exigido = documentosExigidos.find((d) => d.id === r.documentoExigidoId);
        return {
          documentoExigidoId: r.documentoExigidoId,
          nomeDocumento: exigido?.nome ?? "Documento",
          tipoDocumento: exigido?.tipo ?? "OUTRO",
          status: r.status,
          observacao: r.observacao,
        };
      });

      const sugestoes = await llmService.gerarSugestoesConformidade(itensParaSugestao);

      for (const sug of sugestoes) {
        const idx = resultados.findIndex((r) => r.documentoExigidoId === sug.documentoExigidoId);
        if (idx !== -1) {
          resultados[idx].sugestao = sug.sugestao;
        }
      }
    }
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
