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
  | 'PROPOSTA_ENVIADA'
  | 'EM_DISPUTA'
  | 'GANHO'
  | 'PERDIDO';

export interface Participacao {
  id: string;
  empresaId: string;
  licitacaoId: string;
  dataParticipacao: string;
  valorProposta: number | null;
  status: ParticipacaoStatus;
  observacoes: string;
  createdAt: string;
  updatedAt: string;
  empresa?: Empresa;
  licitacao?: Licitacao;
}
