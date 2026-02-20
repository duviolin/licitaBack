import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Star, Building2, Filter, X, Loader2,
  Info, Handshake, Download, ExternalLink,
  MapPin, Calendar, Banknote, XCircle, Clock,
  CheckCircle2, AlertCircle, FileText,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { formatCurrency, formatDate } from '../lib/constants';
import { PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import { ImportarLicitacoesModal } from '../components/ImportarLicitacoesModal';
import { ToastContainer } from '../components/Toast';
import { useToast } from '../hooks/useToast';
import type { Empresa, LicitacaoMatch, Licitacao, MatchStatus, Participacao, ParticipacaoStatus } from '../types';

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

type StatusFilter = 'ativos' | 'FAVORITO' | 'DESCARTADO' | 'todos';

const PART_STATUS_CFG: Record<ParticipacaoStatus, { label: string; color: string; bg: string }> = {
  ANALISANDO: { label: 'Analisando', color: 'text-blue-700', bg: 'bg-blue-100' },
  PENDENTE_DOC: { label: 'Pendente', color: 'text-amber-700', bg: 'bg-amber-100' },
  APTA: { label: 'Apta', color: 'text-green-700', bg: 'bg-green-100' },
  ENVIADA: { label: 'Enviada', color: 'text-indigo-700', bg: 'bg-indigo-100' },
  EM_DISPUTA: { label: 'Em Disputa', color: 'text-purple-700', bg: 'bg-purple-100' },
  GANHA: { label: 'Ganha', color: 'text-emerald-700', bg: 'bg-emerald-100' },
  PERDIDA: { label: 'Perdida', color: 'text-red-700', bg: 'bg-red-100' },
};

function isEncerrada(lic: Licitacao): boolean {
  if (!lic.dataEncerramento) return false;
  return new Date(lic.dataEncerramento) < new Date();
}

export function Matches() {
  const navigate = useNavigate();
  const { toasts, addToast, removeToast } = useToast();
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [selectedEmpresa, setSelectedEmpresa] = useState('');
  const [matches, setMatches] = useState<MatchComLicitacao[]>([]);
  const [participacoes, setParticipacoes] = useState<Participacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [scoreMin, setScoreMin] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [filterUf, setFilterUf] = useState('');
  const [filterModalidade, setFilterModalidade] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ativos');
  const [showImportar, setShowImportar] = useState(false);
  const [criandoPart, setCriandoPart] = useState<string | null>(null);

  const [selectedLicId, setSelectedLicId] = useState<string | null>(null);
  const [licDetalhe, setLicDetalhe] = useState<LicitacaoDetalhe | null>(null);
  const [loadingDetalhe, setLoadingDetalhe] = useState(false);

  const partMap = useMemo(() => {
    const map = new Map<string, Participacao>();
    participacoes.forEach((p) => map.set(`${p.empresaId}:${p.licitacaoId}`, p));
    return map;
  }, [participacoes]);

  function getParticipacao(empresaId: string, licitacaoId: string) {
    return partMap.get(`${empresaId}:${licitacaoId}`);
  }

  useEffect(() => {
    api.get<Empresa[]>('/empresas')
      .then(setEmpresas)
      .catch((err) => addToast('error', err instanceof Error ? err.message : 'Erro'))
      .finally(() => setLoading(false));
  }, [addToast]);

  const loadMatches = useCallback(async (empresaId: string) => {
    if (!empresaId) {
      setMatches([]);
      setParticipacoes([]);
      return;
    }
    try {
      setLoadingMatches(true);
      const excluir = statusFilter === 'ativos' ? 'true' : 'false';
      const statusParam = statusFilter === 'FAVORITO' || statusFilter === 'DESCARTADO' ? `&status=${statusFilter}` : '';
      const [data, parts] = await Promise.all([
        api.get<MatchComLicitacao[]>(
          `/empresas/${empresaId}/matches?scoreMin=0&limit=200&excluirDescartados=${excluir}${statusParam}`
        ),
        api.get<Participacao[]>(`/participacoes?empresaId=${empresaId}`),
      ]);
      setMatches(data);
      setParticipacoes(parts);
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Erro ao carregar matches');
    } finally {
      setLoadingMatches(false);
    }
  }, [addToast, statusFilter]);

  useEffect(() => {
    if (selectedEmpresa) loadMatches(selectedEmpresa);
  }, [selectedEmpresa, loadMatches]);

  useEffect(() => {
    if (empresas.length === 1 && !selectedEmpresa) {
      setSelectedEmpresa(empresas[0].id);
    }
  }, [empresas, selectedEmpresa]);

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
          .filter((m) => {
            if (statusFilter === 'ativos') return m.status !== 'DESCARTADO';
            if (statusFilter === 'FAVORITO') return m.status === 'FAVORITO';
            if (statusFilter === 'DESCARTADO') return m.status === 'DESCARTADO';
            return true;
          })
      );
      const labels: Record<MatchStatus, string> = { NOVO: 'Match restaurado', FAVORITO: 'Favoritado!', DESCARTADO: 'Descartado' };
      addToast('success', labels[newStatus]);
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Erro ao atualizar');
    }
  }

  async function handleParticipar(empresaId: string, licitacaoId: string) {
    try {
      setCriandoPart(licitacaoId);
      const result = await api.post<Participacao>('/participacoes', { empresaId, licitacaoId });
      setParticipacoes((prev) => [...prev, result]);
      addToast('success', 'Participação criada! Análise do edital em andamento...');
      navigate(`/participacoes/${result.id}`);
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Erro ao participar');
    } finally {
      setCriandoPart(null);
    }
  }

  const filteredMatches = useMemo(() => {
    return matches.filter((m) => {
      if (Number(m.score) < scoreMin) return false;
      if (filterUf && m.licitacao.uf !== filterUf) return false;
      if (filterModalidade && !m.licitacao.modalidade?.toLowerCase().includes(filterModalidade.toLowerCase())) return false;
      return true;
    });
  }, [matches, scoreMin, filterUf, filterModalidade]);

  const favCount = matches.filter((m) => m.status === 'FAVORITO').length;

  const ufsDisp = useMemo(() => {
    const ufs = new Set(matches.map((m) => m.licitacao.uf).filter(Boolean));
    return [...ufs].sort();
  }, [matches]);

  const activeFilterCount = [filterUf, filterModalidade, scoreMin > 0].filter(Boolean).length;

  const detalheMatch = selectedLicId ? matches.find((m) => m.licitacaoId === selectedLicId) : null;
  const detalhePart = detalheMatch ? getParticipacao(detalheMatch.empresaId, detalheMatch.licitacaoId) : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 size={24} className="animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div>
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <PageHeader
        title="Matches"
        description="Licitações ranqueadas por relevância para suas empresas"
        actions={
          <button
            onClick={() => setShowImportar(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <Download size={16} />
            Importar Licitações
          </button>
        }
      />

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-6 text-sm text-blue-700 flex items-start gap-2">
        <Info size={16} className="shrink-0 mt-0.5" />
        <p>
          Score de 0% a 100%: <strong>Textual (60%)</strong> · <strong>Geográfico (25%)</strong> · <strong>Valor (15%)</strong>.
          Clique em <strong>Participar</strong> para iniciar análise automática do edital.
        </p>
      </div>

      {/* Empresa Selector */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Selecione a empresa</label>
        <select
          value={selectedEmpresa}
          onChange={(e) => setSelectedEmpresa(e.target.value)}
          className="w-full max-w-md px-3 py-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
        >
          <option value="">Escolha uma empresa...</option>
          {empresas.map((e) => (
            <option key={e.id} value={e.id}>{e.nomeFantasia || e.razaoSocial} — {e.uf}</option>
          ))}
        </select>
      </div>

      {selectedEmpresa && (
        <>
          {/* Status tabs */}
          <div className="flex gap-1 mb-4 bg-slate-100 rounded-lg p-1 w-fit">
            {([
              { key: 'ativos', label: 'Ativos', icon: null },
              { key: 'FAVORITO', label: `Favoritos${favCount ? ` (${favCount})` : ''}`, icon: Star },
              { key: 'DESCARTADO', label: 'Descartados', icon: XCircle },
              { key: 'todos', label: 'Todos', icon: null },
            ] as const).map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setStatusFilter(key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  statusFilter === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {Icon && <Icon size={12} className={key === 'FAVORITO' ? 'text-amber-500' : 'text-red-400'} />}
                {label}
              </button>
            ))}
          </div>

          {/* Filter Bar */}
          <div className="flex gap-3 mb-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-600">Score:</span>
              {[0, 0.3, 0.5, 0.7].map((v) => (
                <button
                  key={v}
                  onClick={() => setScoreMin(v)}
                  className={`px-2.5 py-1 text-xs rounded-full font-medium transition-colors ${
                    scoreMin === v ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {v === 0 ? 'Todos' : `≥ ${(v * 100).toFixed(0)}%`}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs font-medium transition-colors ${
                showFilters || activeFilterCount > 0 ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-slate-300 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Filter size={12} /> Filtros
              {activeFilterCount > 0 && (
                <span className="bg-blue-600 text-white w-4 h-4 rounded-full flex items-center justify-center text-[10px]">{activeFilterCount}</span>
              )}
            </button>
          </div>

          {showFilters && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 mb-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-700">Filtros</h3>
                {(filterUf || filterModalidade) && (
                  <button onClick={() => { setFilterUf(''); setFilterModalidade(''); }} className="flex items-center gap-1 text-xs text-red-500 hover:underline">
                    <X size={12} /> Limpar
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">UF</label>
                  <select value={filterUf} onChange={(e) => setFilterUf(e.target.value)}
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-sm outline-none">
                    <option value="">Todas</option>
                    {ufsDisp.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Modalidade</label>
                  <input type="text" value={filterModalidade} onChange={(e) => setFilterModalidade(e.target.value)}
                    placeholder="Filtrar..." className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-sm outline-none" />
                </div>
              </div>
            </div>
          )}

          {/* Results */}
          {loadingMatches ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 size={24} className="animate-spin text-blue-600" />
            </div>
          ) : filteredMatches.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
              <Star size={48} className="text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500 mb-4">
                {matches.length === 0
                  ? statusFilter === 'DESCARTADO' ? 'Nenhum match descartado.'
                  : statusFilter === 'FAVORITO' ? 'Nenhum match favoritado ainda.'
                  : 'Nenhum match. Importe licitações ou ajuste as preferências.'
                  : 'Nenhum match com os filtros atuais.'}
              </p>
              {matches.length === 0 && statusFilter === 'ativos' && (
                <button onClick={() => setShowImportar(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
                  <Download size={16} /> Importar Licitações
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-slate-500 mb-2">
                {filteredMatches.length} match{filteredMatches.length !== 1 ? 'es' : ''}
              </p>
              {filteredMatches.map((match) => {
                const part = getParticipacao(match.empresaId, match.licitacaoId);
                return (
                  <MatchCard
                    key={match.id}
                    match={match}
                    participacao={part}
                    criando={criandoPart === match.licitacaoId}
                    onClick={() => openDetalhe(match.licitacaoId)}
                    onParticipar={() => handleParticipar(match.empresaId, match.licitacaoId)}
                    onVerParticipacao={() => part && navigate(`/participacoes/${part.id}`)}
                    onStatusChange={handleStatusChange}
                  />
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Modal Detalhe */}
      <Modal open={!!selectedLicId} onClose={closeDetalhe} title="Detalhes da Licitação" size="lg">
        {loadingDetalhe ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 size={24} className="animate-spin text-blue-600" />
          </div>
        ) : !licDetalhe ? (
          <p className="text-sm text-slate-400 text-center py-8">Licitação não encontrada</p>
        ) : (
          <div className="space-y-5">
            {/* Participação status banner */}
            {detalhePart && (
              <div className={`rounded-lg p-3 flex items-center justify-between ${PART_STATUS_CFG[detalhePart.status].bg}`}>
                <div className="flex items-center gap-2">
                  <Handshake size={16} className={PART_STATUS_CFG[detalhePart.status].color} />
                  <span className={`text-sm font-bold ${PART_STATUS_CFG[detalhePart.status].color}`}>
                    Participando — {PART_STATUS_CFG[detalhePart.status].label}
                  </span>
                  {detalhePart.percentualConformidade > 0 && (
                    <span className="text-xs opacity-75">({detalhePart.percentualConformidade}% docs)</span>
                  )}
                </div>
                <button
                  onClick={() => { closeDetalhe(); navigate(`/participacoes/${detalhePart.id}`); }}
                  className="text-xs font-medium underline hover:no-underline"
                >
                  Ver detalhe
                </button>
              </div>
            )}

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
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                  new Date(licDetalhe.dataEncerramento) < new Date() ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  {new Date(licDetalhe.dataEncerramento) < new Date() ? 'Encerrada' : `Encerra ${formatDate(licDetalhe.dataEncerramento)}`}
                </span>
              )}
            </div>

            {/* Links */}
            <div className="flex flex-wrap gap-2">
              {licDetalhe.linkPortal && (
                <a href={licDetalhe.linkPortal} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline font-medium bg-blue-50 px-3 py-1.5 rounded-lg">
                  <ExternalLink size={12} /> Portal
                </a>
              )}
              {licDetalhe.linkEdital && (
                <a href={licDetalhe.linkEdital} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline font-medium bg-blue-50 px-3 py-1.5 rounded-lg">
                  <FileText size={12} /> Edital PDF
                </a>
              )}
            </div>

            {/* Actions */}
            <div className="border-t border-slate-200 pt-4">
              <div className="flex gap-2">
                {detalheMatch && !detalhePart && (
                  <button
                    onClick={() => { closeDetalhe(); handleParticipar(detalheMatch.empresaId, detalheMatch.licitacaoId); }}
                    disabled={criandoPart === detalheMatch.licitacaoId}
                    className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors disabled:opacity-50"
                  >
                    {criandoPart === detalheMatch?.licitacaoId ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Handshake size={16} />
                    )}
                    Participar desta Licitação
                  </button>
                )}
                {detalhePart && (
                  <button
                    onClick={() => { closeDetalhe(); navigate(`/participacoes/${detalhePart.id}`); }}
                    className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors"
                  >
                    <Handshake size={16} />
                    Ver Participação
                  </button>
                )}
                {detalheMatch && (
                  <>
                    <button
                      onClick={() => {
                        handleStatusChange(detalheMatch.id, detalheMatch.status === 'FAVORITO' ? 'NOVO' : 'FAVORITO');
                      }}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                        detalheMatch.status === 'FAVORITO'
                          ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                          : 'border border-slate-300 text-slate-700 hover:bg-amber-50'
                      }`}
                    >
                      <Star size={16} className={detalheMatch.status === 'FAVORITO' ? 'fill-amber-500' : ''} />
                      {detalheMatch.status === 'FAVORITO' ? 'Favoritado' : 'Favoritar'}
                    </button>
                    <button
                      onClick={() => {
                        handleStatusChange(detalheMatch.id, detalheMatch.status === 'DESCARTADO' ? 'NOVO' : 'DESCARTADO');
                        if (detalheMatch.status !== 'DESCARTADO') closeDetalhe();
                      }}
                      className="flex items-center gap-2 px-4 py-2.5 border border-slate-300 text-slate-500 rounded-lg text-sm font-medium hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
                    >
                      <XCircle size={16} />
                      {detalheMatch.status === 'DESCARTADO' ? 'Restaurar' : 'Descartar'}
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Matches */}
            <div className="border-t border-slate-200 pt-4">
              <div className="flex items-center gap-2 mb-3">
                <Star size={16} className="text-amber-500" />
                <h4 className="text-sm font-semibold text-slate-900">Empresas com match ({licDetalhe.matches.length})</h4>
              </div>
              {licDetalhe.matches.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">Nenhum match</p>
              ) : (
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
                      <span className={`text-sm font-bold ${Number(m.score) >= 0.7 ? 'text-green-600' : Number(m.score) >= 0.4 ? 'text-amber-600' : 'text-slate-500'}`}>
                        {(Number(m.score) * 100).toFixed(0)}%
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      <ImportarLicitacoesModal
        open={showImportar}
        onClose={() => setShowImportar(false)}
        onSuccess={(res) => {
          addToast('success', `${res.totalImportadas} importadas, ${res.matchesCalculados} matches`);
          if (selectedEmpresa) loadMatches(selectedEmpresa);
        }}
        onError={(msg) => addToast('error', msg)}
      />
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

function MatchCard({ match, participacao, criando, onClick, onParticipar, onVerParticipacao, onStatusChange }: {
  match: MatchComLicitacao;
  participacao?: Participacao;
  criando: boolean;
  onClick: () => void;
  onParticipar: () => void;
  onVerParticipacao: () => void;
  onStatusChange: (matchId: string, status: MatchStatus) => void;
}) {
  const score = Number(match.score);
  const lic = match.licitacao;
  const encerrada = isEncerrada(lic);
  const isFav = match.status === 'FAVORITO';

  const scoreColor = score >= 0.7 ? 'text-green-600' : score >= 0.4 ? 'text-amber-600' : 'text-slate-500';
  const barColor = score >= 0.7 ? 'bg-green-500' : score >= 0.4 ? 'bg-amber-500' : 'bg-slate-400';

  const partCfg = participacao ? PART_STATUS_CFG[participacao.status] : null;

  return (
    <div
      className={`bg-white rounded-xl border p-4 shadow-sm hover:shadow-md transition-all cursor-pointer ${
        encerrada ? 'border-red-200 opacity-70' : isFav ? 'border-amber-300 bg-amber-50/30' : 'border-slate-200 hover:border-blue-200'
      }`}
      onClick={onClick}
    >
      <div className="flex items-start gap-4">
        {/* Score */}
        <div className="flex flex-col items-center gap-1 min-w-[50px]">
          <span className={`text-lg font-bold ${scoreColor}`}>{(score * 100).toFixed(0)}%</span>
          <div className="w-12 h-1.5 rounded-full bg-slate-200 overflow-hidden">
            <div className={`h-full rounded-full ${barColor}`} style={{ width: `${score * 100}%` }} />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-slate-900 line-clamp-1 flex-1">{lic.objeto}</p>
            {encerrada && (
              <span className="flex items-center gap-1 text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium shrink-0">
                <Clock size={10} /> Encerrada
              </span>
            )}
            {isFav && <Star size={14} className="text-amber-500 fill-amber-500 shrink-0" />}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">{lic.orgao}</p>

          <div className="flex flex-wrap items-center gap-2 mt-1.5">
            <span className="text-xs text-slate-500">{lic.uf}</span>
            {lic.valorEstimado && <span className="text-xs text-slate-500">{formatCurrency(lic.valorEstimado)}</span>}
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{lic.modalidade}</span>
          </div>

          {/* Participation status badge */}
          {participacao && partCfg && (
            <div className="mt-2">
              <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-lg ${partCfg.bg} ${partCfg.color}`}>
                {participacao.status === 'APTA' || participacao.status === 'GANHA' ? (
                  <CheckCircle2 size={12} />
                ) : participacao.status === 'PENDENTE_DOC' ? (
                  <AlertCircle size={12} />
                ) : (
                  <Handshake size={12} />
                )}
                Participando — {partCfg.label}
                {participacao.percentualConformidade > 0 && ` (${participacao.percentualConformidade}%)`}
              </span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => onStatusChange(match.id, isFav ? 'NOVO' : 'FAVORITO')}
            title={isFav ? 'Remover favorito' : 'Favoritar'}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
              isFav ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : 'bg-slate-50 text-slate-500 hover:bg-amber-50 hover:text-amber-600'
            }`}
          >
            <Star size={14} className={isFav ? 'fill-amber-500' : ''} />
            {isFav ? 'Favoritado' : 'Favoritar'}
          </button>

          <button
            onClick={() => onStatusChange(match.id, match.status === 'DESCARTADO' ? 'NOVO' : 'DESCARTADO')}
            title={match.status === 'DESCARTADO' ? 'Restaurar' : 'Descartar'}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
              match.status === 'DESCARTADO'
                ? 'bg-green-50 text-green-700 hover:bg-green-100'
                : 'bg-slate-50 text-slate-500 hover:bg-red-50 hover:text-red-600'
            }`}
          >
            <XCircle size={14} />
            {match.status === 'DESCARTADO' ? 'Restaurar' : 'Descartar'}
          </button>

          {participacao ? (
            <button
              onClick={onVerParticipacao}
              className="flex items-center gap-1.5 px-3 py-2 bg-purple-100 text-purple-700 rounded-lg text-xs font-medium hover:bg-purple-200 transition-colors"
            >
              <Handshake size={14} />
              Ver Participação
            </button>
          ) : (
            <button
              onClick={onParticipar}
              disabled={criando}
              className="flex items-center gap-1.5 px-3 py-2 bg-purple-600 text-white rounded-lg text-xs font-medium hover:bg-purple-700 transition-colors disabled:opacity-50"
            >
              {criando ? <Loader2 size={14} className="animate-spin" /> : <Handshake size={14} />}
              Participar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
