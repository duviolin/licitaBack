import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Star, Building2, Filter, X, Loader2,
  Info, Handshake, Download, ExternalLink,
  MapPin, Calendar, Banknote, XCircle, Clock,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { formatCurrency, formatDate } from '../lib/constants';
import { PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import { ImportarLicitacoesModal } from '../components/ImportarLicitacoesModal';
import { ToastContainer } from '../components/Toast';
import { useToast } from '../hooks/useToast';
import type { Empresa, LicitacaoMatch, Licitacao, MatchStatus } from '../types';

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
  const [loading, setLoading] = useState(true);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [scoreMin, setScoreMin] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [filterUf, setFilterUf] = useState('');
  const [filterModalidade, setFilterModalidade] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ativos');
  const [showImportar, setShowImportar] = useState(false);

  const [selectedLicId, setSelectedLicId] = useState<string | null>(null);
  const [licDetalhe, setLicDetalhe] = useState<LicitacaoDetalhe | null>(null);
  const [loadingDetalhe, setLoadingDetalhe] = useState(false);

  useEffect(() => {
    api.get<Empresa[]>('/empresas')
      .then(setEmpresas)
      .catch((err) => addToast('error', err instanceof Error ? err.message : 'Erro'))
      .finally(() => setLoading(false));
  }, [addToast]);

  const loadMatches = useCallback(async (empresaId: string) => {
    if (!empresaId) {
      setMatches([]);
      return;
    }
    try {
      setLoadingMatches(true);
      const excluir = statusFilter === 'ativos' ? 'true' : 'false';
      const statusParam = statusFilter === 'FAVORITO' || statusFilter === 'DESCARTADO' ? `&status=${statusFilter}` : '';
      const data = await api.get<MatchComLicitacao[]>(
        `/empresas/${empresaId}/matches?scoreMin=0&limit=200&excluirDescartados=${excluir}${statusParam}`
      );
      setMatches(data);
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
        <div>
          <p>
            Cada match tem um <strong>score de 0% a 100%</strong>:
            <strong> Textual (60%)</strong> — palavras-chave vs. objeto;
            <strong> Geográfico (25%)</strong> — UFs de interesse;
            <strong> Valor (15%)</strong> — faixa de valor.
            Use a <Star size={12} className="inline text-amber-500" /> para favoritar e o <XCircle size={12} className="inline text-red-400" /> para descartar.
          </p>
        </div>
      </div>

      {/* Empresa Selector */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          Selecione a empresa
        </label>
        <select
          value={selectedEmpresa}
          onChange={(e) => setSelectedEmpresa(e.target.value)}
          className="w-full max-w-md px-3 py-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
        >
          <option value="">Escolha uma empresa...</option>
          {empresas.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nomeFantasia || e.razaoSocial} — {e.uf}
            </option>
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
                  statusFilter === key
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
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
                    scoreMin === v
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {v === 0 ? 'Todos' : `≥ ${(v * 100).toFixed(0)}%`}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs font-medium transition-colors ${
                showFilters || activeFilterCount > 0
                  ? 'border-blue-300 bg-blue-50 text-blue-700'
                  : 'border-slate-300 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Filter size={12} />
              Filtros
              {activeFilterCount > 0 && (
                <span className="bg-blue-600 text-white w-4 h-4 rounded-full flex items-center justify-center text-[10px]">
                  {activeFilterCount}
                </span>
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
                  <input
                    type="text"
                    value={filterModalidade}
                    onChange={(e) => setFilterModalidade(e.target.value)}
                    placeholder="Filtrar..."
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-sm outline-none"
                  />
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
                  ? statusFilter === 'DESCARTADO'
                    ? 'Nenhum match descartado.'
                    : statusFilter === 'FAVORITO'
                    ? 'Nenhum match favoritado ainda.'
                    : 'Nenhum match para esta empresa. Importe licitações ou ajuste as preferências.'
                  : 'Nenhum match com os filtros atuais.'}
              </p>
              {matches.length === 0 && statusFilter === 'ativos' && (
                <button
                  onClick={() => setShowImportar(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  <Download size={16} /> Importar Licitações
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-slate-500 mb-2">
                {filteredMatches.length} match{filteredMatches.length !== 1 ? 'es' : ''} — ordenados por relevância
              </p>
              {filteredMatches.map((match) => (
                <MatchCard
                  key={match.id}
                  match={match}
                  onClick={() => openDetalhe(match.licitacaoId)}
                  onParticipar={() => navigate(`/participacoes?empresaId=${match.empresaId}&licitacaoId=${match.licitacaoId}`)}
                  onStatusChange={handleStatusChange}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Modal de detalhe da licitação */}
      <Modal open={!!selectedLicId} onClose={closeDetalhe} title="Detalhes da Licitação" size="lg">
        {loadingDetalhe ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 size={24} className="animate-spin text-blue-600" />
          </div>
        ) : !licDetalhe ? (
          <p className="text-sm text-slate-400 text-center py-8">Licitação não encontrada</p>
        ) : (
          <div className="space-y-5">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 mb-1">{licDetalhe.objeto}</h3>
              <p className="text-xs text-slate-500">{licDetalhe.orgao}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2">
                <MapPin size={14} className="text-slate-400" />
                <div>
                  <p className="text-[10px] text-slate-400">UF / Esfera</p>
                  <p className="text-sm text-slate-800">{licDetalhe.uf} — {licDetalhe.esfera}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Banknote size={14} className="text-slate-400" />
                <div>
                  <p className="text-[10px] text-slate-400">Valor estimado</p>
                  <p className="text-sm text-slate-800">{formatCurrency(licDetalhe.valorEstimado)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Calendar size={14} className="text-slate-400" />
                <div>
                  <p className="text-[10px] text-slate-400">Publicação</p>
                  <p className="text-sm text-slate-800">{formatDate(licDetalhe.dataPublicacao)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Calendar size={14} className="text-slate-400" />
                <div>
                  <p className="text-[10px] text-slate-400">Abertura</p>
                  <p className="text-sm text-slate-800">{formatDate(licDetalhe.dataAbertura)}</p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 font-medium">
                {licDetalhe.modalidade}
              </span>
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                licDetalhe.situacao?.toLowerCase().includes('aberta') || licDetalhe.situacao?.toLowerCase().includes('divulgada')
                  ? 'bg-green-100 text-green-700'
                  : 'bg-slate-100 text-slate-600'
              }`}>
                {licDetalhe.situacao}
              </span>
              {licDetalhe.dataEncerramento && (
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                  new Date(licDetalhe.dataEncerramento) < new Date()
                    ? 'bg-red-100 text-red-700'
                    : 'bg-amber-100 text-amber-700'
                }`}>
                  {new Date(licDetalhe.dataEncerramento) < new Date() ? 'Encerrada' : `Encerra ${formatDate(licDetalhe.dataEncerramento)}`}
                </span>
              )}
            </div>

            {(licDetalhe.linkPortal || licDetalhe.linkEdital) && (
              <div className="flex gap-3">
                {licDetalhe.linkPortal && (
                  <a href={licDetalhe.linkPortal} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline font-medium">
                    <ExternalLink size={12} /> Abrir no Portal
                  </a>
                )}
                {licDetalhe.linkEdital && (
                  <a href={licDetalhe.linkEdital} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline font-medium">
                    <ExternalLink size={12} /> Ver Edital
                  </a>
                )}
              </div>
            )}

            <div className="border-t border-slate-200 pt-4">
              <div className="flex items-center gap-2 mb-3">
                <Star size={16} className="text-amber-500" />
                <h4 className="text-sm font-semibold text-slate-900">
                  Empresas com match ({licDetalhe.matches.length})
                </h4>
              </div>
              {licDetalhe.matches.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">Nenhum match</p>
              ) : (
                <div className="space-y-2">
                  {licDetalhe.matches.map((m) => (
                    <div key={m.empresaId} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                      <div className="p-1.5 bg-white rounded">
                        <Building2 size={14} className="text-slate-500" />
                      </div>
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
                      <div className="flex items-center gap-2 text-xs text-slate-500">
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

function MatchCard({ match, onClick, onParticipar, onStatusChange }: {
  match: MatchComLicitacao;
  onClick: () => void;
  onParticipar: () => void;
  onStatusChange: (matchId: string, status: MatchStatus) => void;
}) {
  const score = Number(match.score);
  const lic = match.licitacao;
  const encerrada = isEncerrada(lic);
  const isFav = match.status === 'FAVORITO';

  const scoreColor = score >= 0.7 ? 'text-green-600' : score >= 0.4 ? 'text-amber-600' : 'text-slate-500';
  const barColor = score >= 0.7 ? 'bg-green-500' : score >= 0.4 ? 'bg-amber-500' : 'bg-slate-400';

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
          <span className="text-[10px] text-slate-400">score</span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-slate-900 line-clamp-2 flex-1">{lic.objeto}</p>
            {encerrada && (
              <span className="flex items-center gap-1 text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium shrink-0">
                <Clock size={10} /> Encerrada
              </span>
            )}
            {isFav && (
              <Star size={14} className="text-amber-500 fill-amber-500 shrink-0" />
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">{lic.orgao}</p>

          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span className="flex items-center gap-1 text-xs text-slate-500">
              <Building2 size={11} /> {lic.uf} {lic.esfera && `— ${lic.esfera}`}
            </span>
            {lic.valorEstimado && (
              <span className="text-xs text-slate-500">{formatCurrency(lic.valorEstimado)}</span>
            )}
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{lic.modalidade}</span>
          </div>

          <div className="flex items-center gap-3 mt-2">
            <ScoreChip label="Textual" value={Number(match.scoreTextual)} tip="Palavras-chave da empresa vs. objeto da licitação" />
            <ScoreChip label="Geográfico" value={Number(match.scoreGeografico)} tip="UFs de interesse vs. UF da licitação" />
            <ScoreChip label="Valor" value={Number(match.scoreValor)} tip="Faixa de valor vs. valor estimado" />
          </div>

          {match.palavrasMatch.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {match.palavrasMatch.slice(0, 6).map((w, i) => (
                <span key={i} className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">{w}</span>
              ))}
              {match.palavrasMatch.length > 6 && (
                <span className="text-[10px] text-slate-400">+{match.palavrasMatch.length - 6}</span>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-1.5 shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onStatusChange(match.id, isFav ? 'NOVO' : 'FAVORITO'); }}
            title={isFav ? 'Remover favorito' : 'Favoritar'}
            className={`p-2 rounded-lg transition-colors ${
              isFav ? 'bg-amber-100 text-amber-600 hover:bg-amber-200' : 'bg-slate-50 text-slate-400 hover:bg-amber-50 hover:text-amber-500'
            }`}
          >
            <Star size={14} className={isFav ? 'fill-amber-500' : ''} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onStatusChange(match.id, match.status === 'DESCARTADO' ? 'NOVO' : 'DESCARTADO'); }}
            title={match.status === 'DESCARTADO' ? 'Restaurar' : 'Descartar'}
            className={`p-2 rounded-lg transition-colors ${
              match.status === 'DESCARTADO' ? 'bg-green-50 text-green-600 hover:bg-green-100' : 'bg-slate-50 text-slate-400 hover:bg-red-50 hover:text-red-500'
            }`}
          >
            {match.status === 'DESCARTADO' ? <X size={14} className="rotate-45" /> : <XCircle size={14} />}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onParticipar(); }}
            title="Registrar participação"
            className="p-2 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition-colors"
          >
            <Handshake size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

function ScoreChip({ label, value, tip }: { label: string; value: number; tip: string }) {
  return (
    <div className="group relative">
      <div className="flex items-center gap-1 text-xs bg-slate-50 px-2 py-0.5 rounded">
        <span className="text-slate-400">{label}:</span>
        <span className={`font-medium ${value >= 0.7 ? 'text-green-600' : value >= 0.4 ? 'text-amber-600' : 'text-slate-500'}`}>
          {(value * 100).toFixed(0)}%
        </span>
      </div>
      <div className="absolute bottom-full left-0 mb-1 hidden group-hover:block z-10 w-48 p-2 bg-slate-800 text-white text-[10px] rounded-lg shadow-lg">
        {tip}
      </div>
    </div>
  );
}
