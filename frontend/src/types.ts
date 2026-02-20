export interface Empresa {
  id: string;
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  cnaePrincipal: string;
  cnaePrincipalDescricao: string;
  cnaesSecundarios: Array<{ codigo: number; descricao: string }>;
  uf: string;
  municipio: string;
  situacaoCadastral: string;
  stemsCnae: string[];
  palavrasChave: string[];
  stemsChave: string[];
  ufsInteresse: string[];
  modalidadesInteresse: string[];
  valorMinimo: number | null;
  valorMaximo: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface Licitacao {
  id: string;
  pncpId: string;
  orgao: string;
  objeto: string;
  modalidade: string;
  valorEstimado: number | null;
  uf: string;
  municipioIbge: string;
  esfera: string;
  dataPublicacao: string;
  dataAbertura: string | null;
  dataEncerramento: string | null;
  situacao: string;
  portal: string;
  linkPortal: string;
  linkEdital: string;
  stemsObjeto: string[];
  createdAt: string;
  updatedAt: string;
  matches?: LicitacaoMatch[];
}

export type MatchStatus = 'NOVO' | 'FAVORITO' | 'DESCARTADO';

export interface LicitacaoMatch {
  id: string;
  empresaId: string;
  licitacaoId: string;
  score: number;
  scoreTextual: number;
  scoreGeografico: number;
  scoreValor: number;
  palavrasMatch: string[];
  status: MatchStatus;
  createdAt: string;
  empresa?: Empresa;
  licitacao?: Licitacao;
}

export type ParticipacaoStatus =
  | 'ANALISANDO'
  | 'PENDENTE_DOC'
  | 'APTA'
  | 'ENVIADA'
  | 'EM_DISPUTA'
  | 'GANHA'
  | 'PERDIDA';

export type ConformidadeStatus = 'OK' | 'AUSENTE' | 'VENCIDO' | 'INCOMPATIVEL';

export type DocumentoTipo =
  | 'CND_FEDERAL' | 'CND_ESTADUAL' | 'CND_MUNICIPAL' | 'CND_TRABALHISTA'
  | 'FGTS' | 'BALANCO_PATRIMONIAL' | 'ATESTADO_TECNICO' | 'CONTRATO_SOCIAL'
  | 'ALVARA' | 'CERTIDAO_FALENCIA' | 'SICAF' | 'CNPJ_CARTAO'
  | 'PROCURACAO' | 'DECLARACAO_ME_EPP' | 'DECLARACAO_INEXISTENCIA_FATO'
  | 'DECLARACAO_MENOR' | 'REGISTRO_CONSELHO' | 'OUTRO';

export type DocumentoStatusType = 'VALIDO' | 'VENCIDO' | 'AUSENTE';

export interface EmpresaDocumento {
  id: string;
  empresaId: string;
  tipo: DocumentoTipo;
  nome: string;
  arquivoUrl: string;
  validade: string | null;
  emissor: string;
  status: DocumentoStatusType;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentoExigido {
  id: string;
  participacaoId: string;
  tipo: string;
  nome: string;
  secaoEdital: string;
  obrigatorio: boolean;
  validadeDias: number | null;
  autenticacaoExigida: boolean;
  referenciaEdital: string;
  createdAt: string;
}

export interface ConformidadeDocumento {
  id: string;
  participacaoId: string;
  empresaId: string;
  documentoExigidoId: string;
  empresaDocumentoId: string | null;
  status: ConformidadeStatus;
  observacao: string;
  createdAt: string;
  documentoExigido?: DocumentoExigido;
  empresaDocumento?: EmpresaDocumento;
}

export interface PrazosEdital {
  id: string;
  participacaoId: string;
  dataAbertura: string | null;
  dataSessao: string | null;
  prazoImpugnacao: string | null;
  prazoEsclarecimento: string | null;
  prazoRecurso: string | null;
  createdAt: string;
}

export interface ChecklistItem {
  documento: string;
  tipo: string;
  status: ConformidadeStatus;
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

export interface Participacao {
  id: string;
  empresaId: string;
  licitacaoId: string;
  dataParticipacao: string;
  valorProposta: number | null;
  status: ParticipacaoStatus;
  observacoes: string;
  editalUrl: string;
  editalTexto: string | null;
  portalLink: string;
  documentosOk: boolean;
  checklist: Checklist | null;
  percentualConformidade: number;
  createdAt: string;
  updatedAt: string;
  empresa?: Empresa;
  licitacao?: Licitacao;
  documentosExigidos?: DocumentoExigido[];
  conformidades?: ConformidadeDocumento[];
  prazos?: PrazosEdital;
}
