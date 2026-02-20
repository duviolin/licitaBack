import { useEffect, useState, useCallback } from 'react';
import {
  FileText, Download, Search, Filter, ChevronLeft, ChevronRight,
  MapPin, Banknote, Calendar, Eye, Loader2, X,
} from 'lucide-react';
import { api } from '../lib/api';
import { UFS, formatCurrency, formatDate } from '../lib/constants';
import { PageHeader } from '../components/PageHeader';
import { ImportarLicitacoesModal } from '../components/ImportarLicitacoesModal';
import { LicitacaoDetalheModal } from '../components/LicitacaoDetalheModal';
import { ToastContainer } from '../components/Toast';
import { useToast } from '../hooks/useToast';
import type { Licitacao } from '../types';

interface ListResult {
  data: Licitacao[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const SITUACOES = ['Divulgada', 'Aberta', 'Encerrada', 'Suspensa', 'Revogada', 'Anulada'];
const ESFERAS = ['Federal', 'Estadual', 'Municipal'];
const MODALIDADES_FILTRO = [
  'Pregão Eletrônico',
  'Concorrência',
  'Dispensa de Licitação',
  'Inexigibilidade',
  'Diálogo Competitivo',
];

export function Licitacoes() {
  const { toasts, addToast, removeToast } = useToast();
  const [result, setResult] = useState<ListResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [showImportar, setShowImportar] = useState(false);
  const [detalheLicId, setDetalheLicId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const [search, setSearch] = useState('');
  const [filterUf, setFilterUf] = useState('');
  const [filterModalidade, setFilterModalidade] = useState('');
  const [filterEsfera, setFilterEsfera] = useState('');
  const [filterSituacao, setFilterSituacao] = useState('');
  const [filterApenasAbertas, setFilterApenasAbertas] = useState(false);
  const [page, setPage] = useState(1);

  const activeFilterCount = [filterUf, filterModalidade, filterEsfera, filterSituacao, filterApenasAbertas].filter(Boolean).length;

  const loadLicitacoes = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', '20');
      if (filterUf) params.set('uf', filterUf);
      if (filterModalidade) params.set('modalidade', filterModalidade);
      if (filterEsfera) params.set('esfera', filterEsfera);
      if (filterSituacao) params.set('situacao', filterSituacao);
      if (filterApenasAbertas) params.set('apenasAbertas', 'true');

      const data = await api.get<ListResult>(`/licitacoes?${params.toString()}`);
      setResult(data);
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Erro ao carregar licitações');
    } finally {
      setLoading(false);
    }
  }, [page, filterUf, filterModalidade, filterEsfera, filterSituacao, filterApenasAbertas, addToast]);

  useEffect(() => {
    loadLicitacoes();
  }, [loadLicitacoes]);

  function clearFilters() {
    setFilterUf('');
    setFilterModalidade('');
    setFilterEsfera('');
    setFilterSituacao('');
    setFilterApenasAbertas(false);
    setPage(1);
  }

  const displayed = result?.data.filter((lic) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      lic.objeto.toLowerCase().includes(q) ||
      lic.orgao.toLowerCase().includes(q) ||
      lic.uf?.toLowerCase().includes(q)
    );
  }) ?? [];

  return (
    <div>
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <PageHeader
        title="Licitações"
        description={result ? `${result.total} licitação${result.total !== 1 ? 'ões' : ''} encontrada${result.total !== 1 ? 's' : ''}` : 'Carregando...'}
        actions={
          <button
            onClick={() => setShowImportar(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Download size={18} />
            Importar do PNCP
          </button>
        }
      />

      {/* Search + Filter Toggle */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-lg">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar no objeto ou órgão..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 px-4 py-2.5 border rounded-lg text-sm font-medium transition-colors ${
            showFilters || activeFilterCount > 0
              ? 'border-blue-300 bg-blue-50 text-blue-700'
              : 'border-slate-300 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <Filter size={16} />
          Filtros
          {activeFilterCount > 0 && (
            <span className="bg-blue-600 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 mb-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-700">Filtros avançados</h3>
            {activeFilterCount > 0 && (
              <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-red-500 hover:underline">
                <X size={12} /> Limpar filtros
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">UF</label>
              <select value={filterUf} onChange={(e) => { setFilterUf(e.target.value); setPage(1); }}
                className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Todos</option>
                {UFS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Modalidade</label>
              <select value={filterModalidade} onChange={(e) => { setFilterModalidade(e.target.value); setPage(1); }}
                className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Todas</option>
                {MODALIDADES_FILTRO.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Esfera</label>
              <select value={filterEsfera} onChange={(e) => { setFilterEsfera(e.target.value); setPage(1); }}
                className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Todas</option>
                {ESFERAS.map((e) => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Situação</label>
              <select value={filterSituacao} onChange={(e) => { setFilterSituacao(e.target.value); setPage(1); }}
                className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Todas</option>
                {SITUACOES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="mt-3">
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={filterApenasAbertas}
                onChange={(e) => { setFilterApenasAbertas(e.target.checked); setPage(1); }}
                className="rounded border-slate-300"
              />
              Apenas licitações abertas (não encerradas)
            </label>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 size={24} className="animate-spin text-blue-600" />
        </div>
      ) : displayed.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <FileText size={48} className="text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500 mb-4">
            {(result?.total ?? 0) === 0
              ? 'Nenhuma licitação importada ainda.'
              : 'Nenhuma licitação encontrada com os filtros aplicados.'}
          </p>
          {(result?.total ?? 0) === 0 && (
            <button onClick={() => setShowImportar(true)} className="text-blue-600 text-sm font-medium hover:underline">
              Importar do PNCP
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {displayed.map((lic) => (
              <LicitacaoCard key={lic.id} licitacao={lic} onView={() => setDetalheLicId(lic.id)} />
            ))}
          </div>

          {/* Pagination */}
          {result && result.totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <p className="text-sm text-slate-500">
                Página {result.page} de {result.totalPages} ({result.total} total)
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="flex items-center gap-1 px-3 py-1.5 border border-slate-300 rounded-lg text-sm hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={14} /> Anterior
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(result.totalPages, p + 1))}
                  disabled={page >= result.totalPages}
                  className="flex items-center gap-1 px-3 py-1.5 border border-slate-300 rounded-lg text-sm hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Próxima <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modals */}
      <ImportarLicitacoesModal
        open={showImportar}
        onClose={() => setShowImportar(false)}
        onSuccess={(res) => {
          addToast('success', `${res.totalImportadas} licitações importadas, ${res.matchesCalculados} matches calculados`);
          loadLicitacoes();
        }}
        onError={(msg) => addToast('error', msg)}
      />

      <LicitacaoDetalheModal
        open={!!detalheLicId}
        licitacaoId={detalheLicId}
        onClose={() => setDetalheLicId(null)}
      />
    </div>
  );
}

function LicitacaoCard({ licitacao: lic, onView }: { licitacao: Licitacao; onView: () => void }) {
  const isAberta = lic.situacao?.toLowerCase().includes('aberta') || lic.situacao?.toLowerCase().includes('divulgada');

  return (
    <div
      onClick={onView}
      className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
    >
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-emerald-50 shrink-0">
          <FileText size={18} className="text-emerald-600" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-900 line-clamp-2 group-hover:text-blue-700 transition-colors">
            {lic.objeto}
          </p>
          <p className="text-xs text-slate-500 mt-1 truncate">{lic.orgao}</p>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <MapPin size={12} /> {lic.uf} {lic.esfera && `— ${lic.esfera}`}
            </span>
            {lic.valorEstimado && (
              <span className="flex items-center gap-1">
                <Banknote size={12} /> {formatCurrency(lic.valorEstimado)}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Calendar size={12} /> {formatDate(lic.dataPublicacao)}
            </span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2 shrink-0">
          <div className="flex gap-1.5">
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
              {lic.modalidade}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              isAberta ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
            }`}>
              {lic.situacao}
            </span>
          </div>
          <button className="p-1.5 text-slate-400 group-hover:text-blue-600 transition-colors">
            <Eye size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
