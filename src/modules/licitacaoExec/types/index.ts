export interface IniciarAnaliseParams {
  licitacaoId: string;
  editalUrl: string;
  portalLink?: string;
  empresaId: string;
}

export interface ChecklistItem {
  documento: string;
  tipo: string;
  status: "OK" | "AUSENTE" | "VENCIDO" | "INCOMPATIVEL";
  obrigatorio: boolean;
  observacao: string;
}

export interface Checklist {
  items: ChecklistItem[];
  totalExigidos: number;
  totalOk: number;
  totalPendentes: number;
  percentualConformidade: number;
  aptoParaParticipar: boolean;
}

export interface DocumentoExigidoExtraido {
  tipo: string;
  nome: string;
  secaoEdital: string;
  obrigatorio: boolean;
  validadeDias?: number;
  autenticacaoExigida: boolean;
  referenciaEdital: string;
}

export interface PrazosExtraidos {
  dataAbertura?: Date;
  dataSessao?: Date;
  prazoImpugnacao?: Date;
  prazoEsclarecimento?: Date;
  prazoRecurso?: Date;
}

export interface PortalCredenciais {
  usuario: string;
  senha: string;
  portal: "BLL" | "BNC" | "COMPRASNET" | "OUTRO";
}

export interface PortalEnvioResult {
  sucesso: boolean;
  mensagem: string;
  protocolo?: string;
}
