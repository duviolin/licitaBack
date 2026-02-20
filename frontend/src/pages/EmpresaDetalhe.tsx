import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Building2, MapPin, FileText, Star, Settings,
  Loader2, AlertCircle, Download, Hash,
  Handshake, Calendar, Tag, Globe, Banknote, Brain,
  ExternalLink, XCircle, Clock, Plus, Trash2, CheckCircle2,
  Shield,
} from 'lucide-react';
import { api } from '../lib/api';
import { formatCnpj, formatCurrency, formatDate } from '../lib/constants';
import { PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import { EditarPreferenciasModal } from '../components/EditarPreferenciasModal';
import { ImportarLicitacoesModal } from '../components/ImportarLicitacoesModal';
import { ToastContainer } from '../components/Toast';
import { useToast } from '../hooks/useToast';
import type { Empresa, LicitacaoMatch, Licitacao, MatchStatus, EmpresaDocumento, DocumentoTipo, DocumentoStatusType } from '../types';

type MatchComLicitacao = LicitacaoMatch & { licitacao: Licitacao };

interface LicitacaoDetalhe {
  id: string;
  pncpId: string;
  objeto: string;
  orgao: string;
  modalidade: string;
  valorEstimado: number | null;
  uf: string;
  esfera: string;
  dataPublicacao: string;
  dataAbertura: string | null;
  dataEncerramento: string | null;
  situacao: string;
  linkPortal: string;
  linkEdital: string;
  matches: Array<{
    empresaId: string;
    razaoSocial: string;
    score: number;
    scoreTextual: number;
    scoreGeografico: number;
    scoreValor: number;
    palavrasMatch: string[];
  }>;
}

export function EmpresaDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toasts, addToast, removeToast } = useToast();
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [matches, setMatches] = useState<MatchComLicitacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState(false);
  const [showImportar, setShowImportar] = useState(false);
  const [scoreMin, setScoreMin] = useState(0);
  const [statusFilter, setStatusFilter] = useState<'ativos' | 'FAVORITO' | 'DESCARTADO' | 'todos'>('ativos');

  const [documentos, setDocumentos] = useState<EmpresaDocumento[]>([]);
  const [showAddDoc, setShowAddDoc] = useState(false);

  const [selectedLicId, setSelectedLicId] = useState<string | null>(null);
  const [licDetalhe, setLicDetalhe] = useState<LicitacaoDetalhe | null>(null);
  const [loadingDetalhe, setLoadingDetalhe] = useState(false);

  useEffect(() => {
    if (id) loadData(id);
  }, [id]);

  async function loadData(empresaId: string) {
    try {
      setLoading(true);
      const [emp, matchesData, docsData] = await Promise.all([
        api.get<Empresa>(`/empresas/${empresaId}`),
        api.get<MatchComLicitacao[]>(`/empresas/${empresaId}/matches?scoreMin=0&limit=200`),
        api.get<EmpresaDocumento[]>(`/empresas/${empresaId}/documentos`),
      ]);
      setEmpresa(emp);
      setMatches(matchesData);
      setDocumentos(docsData);
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }

  function openDetalhe(licId: string) {
    setSelectedLicId(licId);
    setLoadingDetalhe(true);
    api.get<LicitacaoDetalhe>(`/licitacoes/${licId}`)
      .then(setLicDetalhe)
      .catch(() => setLicDetalhe(null))
      .finally(() => setLoadingDetalhe(false));
  }

  function closeDetalhe() {
    setSelectedLicId(null);
    setLicDetalhe(null);
  }

  async function handleStatusChange(matchId: string, newStatus: MatchStatus) {
    try {
      await api.patch<LicitacaoMatch>(`/licitacoes/matches/${matchId}/status`, { status: newStatus });
      setMatches((prev) =>
        prev.map((m) => m.id === matchId ? { ...m, status: newStatus } : m)
      );
      const labels: Record<MatchStatus, string> = { NOVO: 'Match restaurado', FAVORITO: 'Favoritado!', DESCARTADO: 'Descartado' };
      addToast('success', labels[newStatus]);
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Erro ao atualizar');
    }
  }

  function isEncerrada(lic: Licitacao): boolean {
    if (!lic.dataEncerramento) return false;
    return new Date(lic.dataEncerramento) < new Date();
  }

  const filteredMatches = matches.filter((m) => {
    if (Number(m.score) < scoreMin) return false;
    if (statusFilter === 'ativos') return m.status !== 'DESCARTADO';
    if (statusFilter === 'FAVORITO') return m.status === 'FAVORITO';
    if (statusFilter === 'DESCARTADO') return m.status === 'DESCARTADO';
    return true;
  });

  const cnaesSecundarios = empresa?.cnaesSecundarios as Array<{ codigo: number; descricao: string }> | undefined;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-blue-600" />
      </div>
    );
  }

  if (!empresa) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3 text-red-700">
        <AlertCircle size={20} />
        <span>Empresa não encontrada</span>
      </div>
    );
  }

  return (
    <div>
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <button
        onClick={() => navigate('/empresas')}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-4 transition-colors"
      >
        <ArrowLeft size={16} />
        Voltar para Empresas
      </button>

      <PageHeader
        title={empresa.nomeFantasia || empresa.razaoSocial}
        description={formatCnpj(empresa.cnpj)}
        actions={
          <div className="flex gap-2">
            <button
              onClick={() => setEditando(true)}
              className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <Settings size={16} />
              Preferências
            </button>
            <button
              onClick={() => setShowImportar(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              <Download size={16} />
              Buscar Licitações
            </button>
          </div>
        }
      />

      {/* === SEÇÃO 1: Dados Cadastrais === */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 mb-4 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Building2 size={18} className="text-blue-600" />
          <h2 className="font-semibold text-slate-900">Dados Cadastrais</h2>
          <span className="text-xs text-slate-400 ml-auto">Fonte: Receita Federal (BrasilAPI)</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <DetailField icon={Building2} label="Razão Social" value={empresa.razaoSocial} />
          <DetailField icon={Building2} label="Nome Fantasia" value={empresa.nomeFantasia || '—'} />
          <DetailField icon={Hash} label="CNPJ" value={formatCnpj(empresa.cnpj)} />
          <DetailField icon={MapPin} label="Município / UF" value={empresa.municipio ? `${empresa.municipio} / ${empresa.uf}` : empresa.uf || '—'} />
          <DetailField
            icon={AlertCircle}
            label="Situação Cadastral"
            value={empresa.situacaoCadastral || '—'}
            highlight={empresa.situacaoCadastral?.toLowerCase().includes('ativa') ? 'green' : 'red'}
          />
          <DetailField icon={Calendar} label="Cadastrada em" value={formatDate(empresa.createdAt)} />
        </div>
      </div>

      {/* === SEÇÃO 2: CNAEs === */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 mb-4 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <FileText size={18} className="text-emerald-600" />
          <h2 className="font-semibold text-slate-900">Atividades Econômicas (CNAEs)</h2>
        </div>

        <div className="mb-3">
          <p className="text-xs font-medium text-slate-500 mb-1">CNAE Principal</p>
          <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
            <span className="text-xs font-mono bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded shrink-0">
              {empresa.cnaePrincipal}
            </span>
            <p className="text-sm text-emerald-800">{empresa.cnaePrincipalDescricao}</p>
          </div>
        </div>

        {cnaesSecundarios && cnaesSecundarios.length > 0 && (
          <div>
            <p className="text-xs font-medium text-slate-500 mb-1.5">
              CNAEs Secundários ({cnaesSecundarios.length})
            </p>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {cnaesSecundarios.map((cnae, i) => (
                <div key={i} className="flex items-start gap-2 bg-slate-50 rounded-lg p-2">
                  <span className="text-xs font-mono bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded shrink-0">
                    {cnae.codigo}
                  </span>
                  <p className="text-xs text-slate-700">{cnae.descricao}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* === SEÇÃO 3: NLP / Stems === */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 mb-4 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Brain size={18} className="text-purple-600" />
          <h2 className="font-semibold text-slate-900">Inteligência de Texto (NLP)</h2>
          <span className="text-xs text-slate-400 ml-auto">Usado no cálculo do score textual (60%)</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-medium text-slate-500 mb-1.5">
              Stems dos CNAEs ({empresa.stemsCnae.length})
            </p>
            <p className="text-[10px] text-slate-400 mb-2">
              Radicais extraídos das descrições dos CNAEs. O sistema compara esses stems com os objetos das licitações.
            </p>
            {empresa.stemsCnae.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {empresa.stemsCnae.map((s, i) => (
                  <span key={i} className="text-[11px] bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded font-mono">{s}</span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400 italic">Nenhum</p>
            )}
          </div>

          <div>
            <p className="text-xs font-medium text-slate-500 mb-1.5">
              Stems das Palavras-chave ({empresa.stemsChave.length})
            </p>
            <p className="text-[10px] text-slate-400 mb-2">
              Radicais das palavras-chave configuradas nas preferências.
            </p>
            {empresa.stemsChave.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {empresa.stemsChave.map((s, i) => (
                  <span key={i} className="text-[11px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-mono">{s}</span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400 italic">Adicione palavras-chave nas preferências</p>
            )}
          </div>
        </div>
      </div>

      {/* === SEÇÃO 4: Preferências === */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 mb-4 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Settings size={18} className="text-amber-600" />
            <h2 className="font-semibold text-slate-900">Preferências de Busca</h2>
          </div>
          <button
            onClick={() => setEditando(true)}
            className="text-sm text-blue-600 hover:underline font-medium"
          >
            Editar
          </button>
        </div>
        <p className="text-xs text-slate-400 mb-4">
          Definem o que é relevante para esta empresa. Quanto mais detalhadas, melhor o score dos matches.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <Tag size={12} className="text-blue-500" />
              <p className="text-xs font-medium text-slate-500">Palavras-chave</p>
              <span className="text-[10px] text-slate-400">— impacta 60% do score</span>
            </div>
            {empresa.palavrasChave.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {empresa.palavrasChave.map((kw, i) => (
                  <span key={i} className="bg-blue-100 text-blue-700 text-xs px-2.5 py-1 rounded-lg font-medium">{kw}</span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-amber-500 italic">Nenhuma definida — configure para melhorar os matches</p>
            )}
          </div>

          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <Globe size={12} className="text-emerald-500" />
              <p className="text-xs font-medium text-slate-500">UFs de interesse</p>
              <span className="text-[10px] text-slate-400">— impacta 25% do score</span>
            </div>
            {empresa.ufsInteresse.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {empresa.ufsInteresse.map((uf, i) => (
                  <span key={i} className="bg-emerald-100 text-emerald-700 text-xs px-2.5 py-1 rounded-lg font-medium">{uf}</span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400 italic">Todas (sem restrição geográfica)</p>
            )}
          </div>

          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <Handshake size={12} className="text-purple-500" />
              <p className="text-xs font-medium text-slate-500">Modalidades de interesse</p>
            </div>
            {empresa.modalidadesInteresse.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {empresa.modalidadesInteresse.map((m, i) => (
                  <span key={i} className="bg-purple-100 text-purple-700 text-xs px-2.5 py-1 rounded-lg font-medium">{m}</span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400 italic">Todas</p>
            )}
          </div>

          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <Banknote size={12} className="text-amber-500" />
              <p className="text-xs font-medium text-slate-500">Faixa de valor</p>
              <span className="text-[10px] text-slate-400">— impacta 15% do score</span>
            </div>
            <p className="text-sm text-slate-800 font-medium">
              {formatCurrency(empresa.valorMinimo)} — {empresa.valorMaximo ? formatCurrency(empresa.valorMaximo) : 'Sem limite'}
            </p>
          </div>
        </div>
      </div>

      {/* === SEÇÃO 5: Documentos === */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 mb-4 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Shield size={18} className="text-teal-600" />
            <h2 className="font-semibold text-slate-900">Documentos da Empresa</h2>
            <span className="text-xs text-slate-400">({documentos.length})</span>
          </div>
          <button
            onClick={() => setShowAddDoc(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-teal-600 text-white rounded-lg text-xs font-medium hover:bg-teal-700 transition-colors"
          >
            <Plus size={14} /> Adicionar Documento
          </button>
        </div>

        <div className="bg-teal-50 border border-teal-200 rounded-lg p-3 mb-4 text-xs text-teal-700">
          Cadastre aqui os documentos de habilitação da empresa (CNDs, FGTS, Contrato Social, etc.).
          Eles serão comparados com as exigências dos editais no módulo de Disputas.
        </div>

        {documentos.length === 0 ? (
          <div className="text-center py-8">
            <FileText size={36} className="text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-400 mb-1">Nenhum documento cadastrado.</p>
            <p className="text-xs text-slate-400">Adicione documentos para verificar conformidade com editais.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {documentos.map((doc) => (
              <DocCard
                key={doc.id}
                doc={doc}
                empresaId={empresa.id}
                onRemove={(docId) => {
                  setDocumentos((prev) => prev.filter((d) => d.id !== docId));
                  addToast('success', 'Documento removido');
                }}
                onUpdate={(updated) => {
                  setDocumentos((prev) => prev.map((d) => d.id === updated.id ? updated : d));
                  addToast('success', 'Documento atualizado');
                }}
                onError={(msg) => addToast('error', msg)}
              />
            ))}
          </div>
        )}
      </div>

      {showAddDoc && empresa && (
        <AddDocumentoModal
          open={showAddDoc}
          empresaId={empresa.id}
          onClose={() => setShowAddDoc(false)}
          onSuccess={(doc) => {
            setDocumentos((prev) => [...prev, doc]);
            setShowAddDoc(false);
            addToast('success', 'Documento cadastrado!');
          }}
          onError={(msg) => addToast('error', msg)}
        />
      )}

      {/* === Estatísticas === */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <StatBox label="Total de Matches" value={matches.length} color="text-blue-600" />
        <StatBox label="Score ≥ 50%" value={matches.filter(m => Number(m.score) >= 0.5).length} color="text-amber-600" />
        <StatBox label="Score ≥ 70%" value={matches.filter(m => Number(m.score) >= 0.7).length} color="text-green-600" />
        <StatBox
          label="Score médio"
          value={matches.length > 0 ? `${(matches.reduce((s, m) => s + Number(m.score), 0) / matches.length * 100).toFixed(0)}%` : '—'}
          color="text-purple-600"
        />
      </div>

      {/* === SEÇÃO 6: Matches === */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="px-5 py-4 border-b border-slate-100 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Star size={18} className="text-amber-500" />
              <h2 className="font-semibold text-slate-900">
                Matches ({filteredMatches.length})
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Score:</span>
              {[0, 0.3, 0.5, 0.7].map((v) => (
                <button
                  key={v}
                  onClick={() => setScoreMin(v)}
                  className={`px-2 py-1 text-xs rounded-full font-medium transition-colors ${
                    scoreMin === v
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {v === 0 ? 'Todos' : `≥ ${(v * 100).toFixed(0)}%`}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
            {([
              { key: 'ativos' as const, label: 'Ativos' },
              { key: 'FAVORITO' as const, label: `Favoritos (${matches.filter(m => m.status === 'FAVORITO').length})` },
              { key: 'DESCARTADO' as const, label: 'Descartados' },
              { key: 'todos' as const, label: 'Todos' },
            ]).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setStatusFilter(key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  statusFilter === key
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {key === 'FAVORITO' && <Star size={11} className="text-amber-500" />}
                {key === 'DESCARTADO' && <XCircle size={11} className="text-red-400" />}
                {label}
              </button>
            ))}
          </div>
        </div>

        {filteredMatches.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <Star size={40} className="text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-400 mb-3">
              {matches.length === 0
                ? 'Nenhum match. Importe licitações ou ajuste as preferências.'
                : 'Nenhum match com esse filtro de score.'}
            </p>
            {matches.length === 0 && (
              <button
                onClick={() => setShowImportar(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                <Download size={16} /> Buscar Licitações
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredMatches.map((match) => (
              <MatchRow
                key={match.id}
                match={match}
                onClick={() => openDetalhe(match.licitacaoId)}
                onParticipar={() => navigate(`/participacoes?empresaId=${match.empresaId}&licitacaoId=${match.licitacaoId}`)}
                onStatusChange={handleStatusChange}
                isEncerrada={isEncerrada(match.licitacao)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modal detalhe licitação */}
      <Modal open={!!selectedLicId} onClose={closeDetalhe} title="Detalhes da Licitação" size="lg">
        {loadingDetalhe ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 size={24} className="animate-spin text-blue-600" />
          </div>
        ) : !licDetalhe ? (
          <p className="text-sm text-slate-400 text-center py-8">Não encontrada</p>
        ) : (
          <div className="space-y-5">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 mb-1">{licDetalhe.objeto}</h3>
              <p className="text-xs text-slate-500">{licDetalhe.orgao}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <LicInfo icon={MapPin} label="UF / Esfera" value={`${licDetalhe.uf} — ${licDetalhe.esfera}`} />
              <LicInfo icon={Banknote} label="Valor estimado" value={formatCurrency(licDetalhe.valorEstimado)} />
              <LicInfo icon={Calendar} label="Publicação" value={formatDate(licDetalhe.dataPublicacao)} />
              <LicInfo icon={Calendar} label="Abertura" value={formatDate(licDetalhe.dataAbertura)} />
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 font-medium">{licDetalhe.modalidade}</span>
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                licDetalhe.situacao?.toLowerCase().includes('aberta') || licDetalhe.situacao?.toLowerCase().includes('divulgada')
                  ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'
              }`}>{licDetalhe.situacao}</span>
              {licDetalhe.dataEncerramento && (
                <span className="text-xs px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 font-medium">
                  Encerra {formatDate(licDetalhe.dataEncerramento)}
                </span>
              )}
            </div>
            {(licDetalhe.linkPortal || licDetalhe.linkEdital) && (
              <div className="flex gap-3">
                {licDetalhe.linkPortal && (
                  <a href={licDetalhe.linkPortal} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline font-medium">
                    <ExternalLink size={12} /> Portal
                  </a>
                )}
                {licDetalhe.linkEdital && (
                  <a href={licDetalhe.linkEdital} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline font-medium">
                    <ExternalLink size={12} /> Edital
                  </a>
                )}
              </div>
            )}
            <div className="border-t border-slate-200 pt-4">
              <div className="flex items-center gap-2 mb-3">
                <Star size={16} className="text-amber-500" />
                <h4 className="text-sm font-semibold text-slate-900">Empresas com match ({licDetalhe.matches.length})</h4>
              </div>
              <div className="space-y-2">
                {licDetalhe.matches.map((m) => (
                  <div key={m.empresaId} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                    <div className="p-1.5 bg-white rounded"><Building2 size={14} className="text-slate-500" /></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{m.razaoSocial}</p>
                      {m.palavrasMatch.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {m.palavrasMatch.slice(0, 5).map((w, i) => (
                            <span key={i} className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded">{w}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <div className="text-center"><p className="text-[10px] text-slate-400">Txt</p><p className="font-medium">{(Number(m.scoreTextual) * 100).toFixed(0)}%</p></div>
                      <div className="text-center"><p className="text-[10px] text-slate-400">Geo</p><p className="font-medium">{(Number(m.scoreGeografico) * 100).toFixed(0)}%</p></div>
                      <div className="text-center"><p className="text-[10px] text-slate-400">Val</p><p className="font-medium">{(Number(m.scoreValor) * 100).toFixed(0)}%</p></div>
                    </div>
                    <span className={`text-sm font-bold ${Number(m.score) >= 0.7 ? 'text-green-600' : Number(m.score) >= 0.4 ? 'text-amber-600' : 'text-slate-500'}`}>
                      {(Number(m.score) * 100).toFixed(0)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {editando && (
        <EditarPreferenciasModal
          open={editando}
          empresa={empresa}
          onClose={() => setEditando(false)}
          onSuccess={(atualizada) => {
            setEmpresa(atualizada);
            setEditando(false);
            if (id) loadData(id);
            addToast('success', 'Preferências atualizadas!');
          }}
          onError={(msg) => addToast('error', msg)}
        />
      )}

      <ImportarLicitacoesModal
        open={showImportar}
        onClose={() => setShowImportar(false)}
        preEmpresaId={empresa.id}
        preEmpresaNome={empresa.nomeFantasia || empresa.razaoSocial}
        onSuccess={(res) => {
          addToast('success', `${res.totalImportadas} licitações importadas para esta empresa`);
          if (id) loadData(id);
        }}
        onError={(msg) => addToast('error', msg)}
      />
    </div>
  );
}

function DetailField({ icon: Icon, label, value, highlight }: {
  icon: typeof Building2; label: string; value: string; highlight?: 'green' | 'red';
}) {
  const hlClass = highlight === 'green' ? 'text-green-700 bg-green-50' : highlight === 'red' ? 'text-red-700 bg-red-50' : '';
  return (
    <div className="flex items-start gap-2.5">
      <div className="p-1.5 rounded-lg bg-slate-100 mt-0.5">
        <Icon size={14} className="text-slate-500" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-slate-400 uppercase tracking-wide">{label}</p>
        <p className={`text-sm font-medium text-slate-800 ${hlClass} ${highlight ? 'px-2 py-0.5 rounded inline-block' : ''}`}>
          {value}
        </p>
      </div>
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 text-center shadow-sm">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
    </div>
  );
}

function LicInfo({ icon: Icon, label, value }: { icon: typeof MapPin; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon size={14} className="text-slate-400" />
      <div>
        <p className="text-[10px] text-slate-400">{label}</p>
        <p className="text-sm text-slate-800">{value}</p>
      </div>
    </div>
  );
}

function MatchRow({ match, onClick, onParticipar, onStatusChange, isEncerrada }: {
  match: MatchComLicitacao;
  onClick: () => void;
  onParticipar: () => void;
  onStatusChange: (matchId: string, status: MatchStatus) => void;
  isEncerrada: boolean;
}) {
  const score = Number(match.score);
  const lic = match.licitacao;
  const isFav = match.status === 'FAVORITO';

  return (
    <div
      className={`px-5 py-3.5 flex items-center gap-4 transition-colors cursor-pointer ${
        isEncerrada ? 'opacity-60 bg-slate-50/50' : isFav ? 'bg-amber-50/30 hover:bg-amber-50/60' : 'hover:bg-blue-50/50'
      }`}
      onClick={onClick}
    >
      <div className="flex flex-col items-center gap-0.5 min-w-[45px]">
        <span className={`text-sm font-bold ${score >= 0.7 ? 'text-green-600' : score >= 0.4 ? 'text-amber-600' : 'text-slate-500'}`}>
          {(score * 100).toFixed(0)}%
        </span>
        <div className="w-10 h-1.5 rounded-full bg-slate-200 overflow-hidden">
          <div
            className={`h-full rounded-full ${score >= 0.7 ? 'bg-green-500' : score >= 0.4 ? 'bg-amber-500' : 'bg-slate-400'}`}
            style={{ width: `${score * 100}%` }}
          />
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-slate-800 truncate">{lic.objeto}</p>
          {isEncerrada && (
            <span className="flex items-center gap-0.5 text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-medium shrink-0">
              <Clock size={9} /> Encerrada
            </span>
          )}
          {isFav && <Star size={12} className="text-amber-500 fill-amber-500 shrink-0" />}
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
          <span>{lic.orgao?.slice(0, 40)}</span>
          <span>{lic.modalidade}</span>
          {lic.uf && <span>{lic.uf}</span>}
          {lic.valorEstimado && <span>{formatCurrency(lic.valorEstimado)}</span>}
        </div>
        {match.palavrasMatch.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {match.palavrasMatch.slice(0, 4).map((w, i) => (
              <span key={i} className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">{w}</span>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 text-xs text-slate-500">
        <ScoreDetail label="Txt" value={Number(match.scoreTextual)} />
        <ScoreDetail label="Geo" value={Number(match.scoreGeografico)} />
        <ScoreDetail label="Val" value={Number(match.scoreValor)} />
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={(e) => { e.stopPropagation(); onStatusChange(match.id, isFav ? 'NOVO' : 'FAVORITO'); }}
          title={isFav ? 'Remover favorito' : 'Favoritar'}
          className={`p-1.5 rounded-lg transition-colors ${
            isFav ? 'bg-amber-100 text-amber-600' : 'text-slate-300 hover:bg-amber-50 hover:text-amber-500'
          }`}
        >
          <Star size={13} className={isFav ? 'fill-amber-500' : ''} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onStatusChange(match.id, match.status === 'DESCARTADO' ? 'NOVO' : 'DESCARTADO'); }}
          title={match.status === 'DESCARTADO' ? 'Restaurar' : 'Descartar'}
          className="p-1.5 rounded-lg text-slate-300 hover:bg-red-50 hover:text-red-500 transition-colors"
        >
          <XCircle size={13} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onParticipar(); }}
          title="Registrar participação"
          className="p-1.5 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition-colors"
        >
          <Handshake size={13} />
        </button>
      </div>
    </div>
  );
}

function ScoreDetail({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <p className="text-[10px] text-slate-400">{label}</p>
      <p className="font-medium">{(value * 100).toFixed(0)}%</p>
    </div>
  );
}

const DOC_TIPOS: { value: DocumentoTipo; label: string }[] = [
  { value: 'CND_FEDERAL', label: 'CND Federal' },
  { value: 'CND_ESTADUAL', label: 'CND Estadual' },
  { value: 'CND_MUNICIPAL', label: 'CND Municipal' },
  { value: 'CND_TRABALHISTA', label: 'CND Trabalhista (CNDT)' },
  { value: 'FGTS', label: 'FGTS (CRF)' },
  { value: 'BALANCO_PATRIMONIAL', label: 'Balanço Patrimonial' },
  { value: 'ATESTADO_TECNICO', label: 'Atestado Técnico' },
  { value: 'CONTRATO_SOCIAL', label: 'Contrato Social' },
  { value: 'ALVARA', label: 'Alvará de Funcionamento' },
  { value: 'CERTIDAO_FALENCIA', label: 'Certidão Falência' },
  { value: 'SICAF', label: 'SICAF' },
  { value: 'CNPJ_CARTAO', label: 'Cartão CNPJ' },
  { value: 'PROCURACAO', label: 'Procuração' },
  { value: 'DECLARACAO_ME_EPP', label: 'Declaração ME/EPP' },
  { value: 'DECLARACAO_INEXISTENCIA_FATO', label: 'Declaração Fato Impeditivo' },
  { value: 'DECLARACAO_MENOR', label: 'Declaração de Menor' },
  { value: 'REGISTRO_CONSELHO', label: 'Registro Conselho (CREA/CAU)' },
  { value: 'OUTRO', label: 'Outro' },
];

const DOC_STATUS_CFG: Record<DocumentoStatusType, { label: string; color: string }> = {
  VALIDO: { label: 'Válido', color: 'bg-green-100 text-green-700' },
  VENCIDO: { label: 'Vencido', color: 'bg-red-100 text-red-700' },
  AUSENTE: { label: 'Ausente', color: 'bg-slate-100 text-slate-500' },
};

function DocCard({ doc, empresaId, onRemove, onUpdate, onError }: {
  doc: EmpresaDocumento;
  empresaId: string;
  onRemove: (id: string) => void;
  onUpdate: (updated: EmpresaDocumento) => void;
  onError: (msg: string) => void;
}) {
  const [removing, setRemoving] = useState(false);
  const [editing, setEditing] = useState(false);
  const statusCfg = DOC_STATUS_CFG[doc.status] ?? DOC_STATUS_CFG.AUSENTE;
  const tipoLabel = DOC_TIPOS.find((t) => t.value === doc.tipo)?.label ?? doc.tipo;

  async function handleRemove() {
    try {
      setRemoving(true);
      await api.delete(`/empresas/${empresaId}/documentos/${doc.id}`);
      onRemove(doc.id);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Erro ao remover');
    } finally {
      setRemoving(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors">
        <div className="p-2 rounded-lg bg-teal-50 shrink-0">
          {doc.status === 'VALIDO' ? (
            <CheckCircle2 size={16} className="text-green-600" />
          ) : doc.status === 'VENCIDO' ? (
            <AlertCircle size={16} className="text-red-500" />
          ) : (
            <FileText size={16} className="text-slate-400" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-900">{doc.nome}</span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded ${statusCfg.color}`}>{statusCfg.label}</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
            <span className="bg-slate-100 px-1.5 py-0.5 rounded">{tipoLabel}</span>
            {doc.emissor && <span>Emissor: {doc.emissor}</span>}
            {doc.validade && <span>Validade: {formatDate(doc.validade)}</span>}
            {doc.arquivoUrl && (
              <a href={doc.arquivoUrl} target="_blank" rel="noopener noreferrer"
                className="text-blue-600 hover:underline flex items-center gap-0.5">
                <ExternalLink size={10} /> Arquivo
              </a>
            )}
          </div>
        </div>
        <button
          onClick={() => setEditing(true)}
          className="p-1.5 text-slate-300 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
          title="Editar documento"
        >
          <Settings size={14} />
        </button>
        <button
          onClick={handleRemove}
          disabled={removing}
          className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
          title="Remover documento"
        >
          {removing ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
        </button>
      </div>
      {editing && (
        <EditDocumentoModal
          doc={doc}
          empresaId={empresaId}
          onClose={() => setEditing(false)}
          onSuccess={(updated) => { onUpdate(updated); setEditing(false); }}
          onError={onError}
        />
      )}
    </>
  );
}

function AddDocumentoModal({ open, empresaId, onClose, onSuccess, onError }: {
  open: boolean;
  empresaId: string;
  onClose: () => void;
  onSuccess: (doc: EmpresaDocumento) => void;
  onError: (msg: string) => void;
}) {
  const [tipo, setTipo] = useState<DocumentoTipo | ''>('');
  const [nome, setNome] = useState('');
  const [validade, setValidade] = useState('');
  const [emissor, setEmissor] = useState('');
  const [arquivoUrl, setArquivoUrl] = useState('');
  const [loading, setLoading] = useState(false);

  function handleTipoChange(value: string) {
    setTipo(value as DocumentoTipo);
    const found = DOC_TIPOS.find((t) => t.value === value);
    if (found && !nome) setNome(found.label);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!tipo || !nome) {
      onError('Selecione o tipo e informe o nome do documento');
      return;
    }
    try {
      setLoading(true);
      const body: Record<string, unknown> = { tipo, nome };
      if (validade) body.validade = new Date(validade).toISOString();
      if (emissor) body.emissor = emissor;
      if (arquivoUrl.trim()) body.arquivoUrl = arquivoUrl.trim();
      const result = await api.post<EmpresaDocumento>(`/empresas/${empresaId}/documentos`, body);
      onSuccess(result);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Erro ao cadastrar');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Adicionar Documento" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Tipo do Documento</label>
          <select
            value={tipo}
            onChange={(e) => handleTipoChange(e.target.value)}
            className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            disabled={loading}
          >
            <option value="">Selecione o tipo...</option>
            {DOC_TIPOS.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Nome / Descrição</label>
          <input
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex: CND Federal - emitida em 15/01/2026"
            className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            disabled={loading}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Validade</label>
            <input
              type="date"
              value={validade}
              onChange={(e) => setValidade(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Emissor</label>
            <input
              type="text"
              value={emissor}
              onChange={(e) => setEmissor(e.target.value)}
              placeholder="Receita Federal..."
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              disabled={loading}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            URL do Arquivo <span className="text-slate-400 font-normal">— opcional</span>
          </label>
          <input
            type="url"
            value={arquivoUrl}
            onChange={(e) => setArquivoUrl(e.target.value)}
            placeholder="https://exemplo.com/documento.pdf"
            className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            disabled={loading}
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading || !tipo || !nome}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors disabled:opacity-50"
          >
            {loading ? (
              <><Loader2 size={16} className="animate-spin" /> Salvando...</>
            ) : (
              'Cadastrar Documento'
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function EditDocumentoModal({ doc, empresaId, onClose, onSuccess, onError }: {
  doc: EmpresaDocumento;
  empresaId: string;
  onClose: () => void;
  onSuccess: (updated: EmpresaDocumento) => void;
  onError: (msg: string) => void;
}) {
  const [nome, setNome] = useState(doc.nome);
  const [validade, setValidade] = useState(doc.validade ? doc.validade.slice(0, 10) : '');
  const [emissor, setEmissor] = useState(doc.emissor || '');
  const [arquivoUrl, setArquivoUrl] = useState(doc.arquivoUrl || '');
  const [status, setStatus] = useState<DocumentoStatusType>(doc.status);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nome) { onError('Informe o nome do documento'); return; }
    try {
      setLoading(true);
      const body: Record<string, unknown> = { nome, status };
      if (validade) body.validade = new Date(validade).toISOString();
      else body.validade = null;
      if (emissor.trim()) body.emissor = emissor.trim();
      body.arquivoUrl = arquivoUrl.trim() || '';
      const result = await api.patch<EmpresaDocumento>(`/empresas/${empresaId}/documentos/${doc.id}`, body);
      onSuccess(result);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Erro ao atualizar');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Editar Documento" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Tipo</label>
          <p className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600">
            {DOC_TIPOS.find((t) => t.value === doc.tipo)?.label ?? doc.tipo}
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Nome / Descrição</label>
          <input
            type="text" value={nome} onChange={(e) => setNome(e.target.value)}
            className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            disabled={loading}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Status</label>
          <select
            value={status} onChange={(e) => setStatus(e.target.value as DocumentoStatusType)}
            className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            disabled={loading}
          >
            <option value="VALIDO">Válido</option>
            <option value="VENCIDO">Vencido</option>
            <option value="AUSENTE">Ausente</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Validade</label>
            <input
              type="date" value={validade} onChange={(e) => setValidade(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Emissor</label>
            <input
              type="text" value={emissor} onChange={(e) => setEmissor(e.target.value)}
              placeholder="Receita Federal..."
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              disabled={loading}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            URL do Arquivo <span className="text-slate-400 font-normal">— opcional</span>
          </label>
          <input
            type="url" value={arquivoUrl} onChange={(e) => setArquivoUrl(e.target.value)}
            placeholder="https://exemplo.com/documento.pdf"
            className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            disabled={loading}
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} disabled={loading}
            className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">
            Cancelar
          </button>
          <button type="submit" disabled={loading || !nome}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors disabled:opacity-50">
            {loading ? <><Loader2 size={16} className="animate-spin" /> Salvando...</> : 'Salvar Alterações'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
