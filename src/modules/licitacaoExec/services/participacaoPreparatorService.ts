import type { ConformidadeStatus, DocumentoExigido, ConformidadeDocumento } from "../../../generated/prisma/client.js";
import type { Checklist, ChecklistItem } from "../types/index.js";

interface ConformidadeComRelacoes extends ConformidadeDocumento {
  documentoExigido: DocumentoExigido;
}

export function gerarChecklist(
  documentosExigidos: DocumentoExigido[],
  conformidades: ConformidadeComRelacoes[]
): Checklist {
  const conformidadeMap = new Map(
    conformidades.map((c) => [c.documentoExigidoId, c])
  );

  const items: ChecklistItem[] = documentosExigidos.map((doc) => {
    const conf = conformidadeMap.get(doc.id);
    return {
      documento: doc.nome,
      tipo: doc.tipo,
      status: (conf?.status ?? "AUSENTE") as ChecklistItem["status"],
      obrigatorio: doc.obrigatorio,
      observacao: conf?.observacao ?? "Conformidade não avaliada",
    };
  });

  const obrigatorios = items.filter((i) => i.obrigatorio);
  const totalExigidos = items.length;
  const totalOk = items.filter((i) => i.status === "OK").length;
  const totalPendentes = totalExigidos - totalOk;

  const obrigatoriosOk = obrigatorios.every((i) => i.status === "OK");

  const percentual =
    totalExigidos > 0
      ? Math.round((totalOk / totalExigidos) * 100)
      : 0;

  return {
    items,
    totalExigidos,
    totalOk,
    totalPendentes,
    percentualConformidade: percentual,
    aptoParaParticipar: obrigatoriosOk,
  };
}

export function determinarStatus(checklist: Checklist) {
  if (checklist.aptoParaParticipar) return "DOCUMENTOS_OK" as const;
  return "PENDENTE_DOC" as const;
}
