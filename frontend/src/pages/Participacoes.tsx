import { useEffect, useState, useMemo, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Handshake, Plus, Loader2, X, Info, CheckCircle2, AlertCircle,
  Clock, FileText, ChevronRight,
} from 'lucide-react';
import { api } from '../lib/api';
import { formatCurrency, formatDate } from '../lib/constants';
import { PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import { ToastContainer } from '../components/Toast';
import { useToast } from '../hooks/useToast';
import type { Empresa, Licitacao, Participacao, ParticipacaoStatus } from '../types';

const STATUS_OPTIONS: { value: ParticipacaoStatus; label: string; color: string; icon: typeof CheckCircle2; desc: string }[] = [
  { value: 'ANALISANDO', label: 'Analisando', color: 'bg-blue-100 text-blue-700', icon: Clock, desc: 'Baixando edital e analisando...' },
  { value: 'PENDENTE_DOC', label: 'Pendente Doc', color: 'bg-amber-100 text-amber-700', icon: AlertCircle, desc: 'Faltam documentos de habilitação' },
  { value: 'APTA', label: 'Apta', color: 'bg-green-100 text-green-700', icon: CheckCircle2, desc: 'Todos os documentos OK' },
  { value: 'ENVIADA', label: 'Enviada', color: 'bg-indigo-100 text-indigo-700', icon: FileText, desc: 'Proposta submetida ao portal' },
  { value: 'EM_DISPUTA', label: 'Em Disputa', color: 'bg-purple-100 text-purple-700', icon: Handshake, desc: 'Participando do certame' },
  { value: 'GANHA', label: 'Ganha', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2, desc: 'Licitação vencida!' },
  { value: 'PERDIDA', label: 'Perdida', color: 'bg-red-100 text-red-700', icon: X, desc: 'Não venceu o certame' },
];

export function Participacoes() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toasts, addToast, removeToast } = useToast();
  const [participacoes, setParticipacoes] = useState<Participacao[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCriar, setShowCriar] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterEmpresa, setFilterEmpresa] = useState('');

  const preEmpresaId = searchParams.get('empresaId') || '';
  const preLicitacaoId = searchParams.get('licitacaoId') || '';

  useEffect(() => {
    if (preEmpresaId && preLicitacaoId) {
      setShowCriar(true);
    }
  }, [preEmpresaId, preLicitacaoId]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [parts, emps] = await Promise.all([
        api.get<Participacao[]>('/participacoes'),
        api.get<Empresa[]>('/empresas'),
      ]);
      setParticipacoes(parts);
      setEmpresas(emps);
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Erro ao carregar');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filtered = useMemo(() => {
    return participacoes.filter((p) => {
      if (filterStatus && p.status !== filterStatus) return false;
      if (filterEmpresa && p.empresaId !== filterEmpresa) return false;
      return true;
    });
  }, [participacoes, filterStatus, filterEmpresa]);

  const activeFilterCount = [filterStatus, filterEmpresa].filter(Boolean).length;

  const stats = useMemo(() => ({
    total: participacoes.length,
    analisando: participacoes.filter((p) => p.status === 'ANALISANDO').length,
    pendente: participacoes.filter((p) => p.status === 'PENDENTE_DOC').length,
    apta: participacoes.filter((p) => p.status === 'APTA').length,
    ganhas: participacoes.filter((p) => p.status === 'GANHA').length,
  }), [participacoes]);

  return (
    <div>
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <PageHeader
        title="Participações"
        description={`${participacoes.length} participação${participacoes.length !== 1 ? 'ões' : ''}`}
        actions={
          <button
            onClick={() => setShowCriar(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors shadow-sm"
          >
            <Plus size={18} />
            Nova Participação
          </button>
        }
      />

      <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 mb-6 text-sm text-purple-700 flex items-start gap-2">
        <Info size={16} className="shrink-0 mt-0.5" />
        <div>
          <p className="font-medium">Fluxo unificado</p>
          <p>
            Ao registrar participação, o sistema <strong>baixa o edital automaticamente</strong>, extrai
            os requisitos de habilitação, e verifica se a empresa tem todos os documentos.
            O status evolui: Analisando → Pendente Doc / Apta → Enviada → Em Disputa → Ganha/Perdida.
          </p>
        </div>
      </div>

      {/* Stats */}
      {stats.total > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
          <MiniStat label="Total" value={stats.total} color="text-slate-700" />
          <MiniStat label="Analisando" value={stats.analisando} color="text-blue-600" />
          <MiniStat label="Pendente" value={stats.pendente} color="text-amber-600" />
          <MiniStat label="Aptas" value={stats.apta} color="text-green-600" />
          <MiniStat label="Ganhas" value={stats.ganhas} color="text-emerald-600" />
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <select
          value={filterEmpresa}
          onChange={(e) => setFilterEmpresa(e.target.value)}
          className="px-3 py-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
        >
          <option value="">Todas as empresas</option>
          {empresas.map((e) => (
            <option key={e.id} value={e.id}>{e.nomeFantasia || e.razaoSocial}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
        >
          <option value="">Todos os status</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        {activeFilterCount > 0 && (
          <button
            onClick={() => { setFilterStatus(''); setFilterEmpresa(''); }}
            className="flex items-center gap-1 px-3 py-2 text-xs text-red-500 hover:bg-red-50 rounded-lg"
          >
            <X size={12} /> Limpar ({activeFilterCount})
          </button>
        )}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 size={24} className="animate-spin text-purple-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Handshake size={48} className="text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500 mb-2">
            {participacoes.length === 0
              ? 'Nenhuma participação registrada ainda.'
              : 'Nenhuma participação com os filtros aplicados.'}
          </p>
          <p className="text-xs text-slate-400 mb-4">
            Dica: vá em Matches, encontre uma licitação interessante e clique em "Participar".
          </p>
          {participacoes.length === 0 && (
            <button onClick={() => setShowCriar(true)} className="text-purple-600 text-sm font-medium hover:underline">
              Registrar primeira participação
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => (
            <ParticipacaoCard
              key={p.id}
              participacao={p}
              empresas={empresas}
              onClick={() => navigate(`/participacoes/${p.id}`)}
            />
          ))}
        </div>
      )}

      {/* Modal Criar */}
      {showCriar && (
        <CriarParticipacaoModal
          open={showCriar}
          empresas={empresas}
          preEmpresaId={preEmpresaId}
          preLicitacaoId={preLicitacaoId}
          onClose={() => setShowCriar(false)}
          onSuccess={(nova) => {
            setParticipacoes((prev) => [nova, ...prev]);
            setShowCriar(false);
            addToast('success', 'Participação registrada! Análise do edital em andamento...');
            navigate(`/participacoes/${nova.id}`);
          }}
          onError={(msg) => addToast('error', msg)}
        />
      )}
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-3 text-center shadow-sm">
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}

/* ---- Card ---- */
function ParticipacaoCard({ participacao: p, empresas, onClick }: {
  participacao: Participacao;
  empresas: Empresa[];
  onClick: () => void;
}) {
  const empresa = empresas.find((e) => e.id === p.empresaId);
  const statusOpt = STATUS_OPTIONS.find((s) => s.value === p.status);
  const Icon = statusOpt?.icon ?? Clock;

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
    >
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg shrink-0 ${
          p.status === 'APTA' || p.status === 'GANHA' ? 'bg-green-50' :
          p.status === 'PENDENTE_DOC' ? 'bg-amber-50' :
          p.status === 'PERDIDA' ? 'bg-red-50' : 'bg-purple-50'
        }`}>
          <Icon size={18} className={
            p.status === 'APTA' || p.status === 'GANHA' ? 'text-green-600' :
            p.status === 'PENDENTE_DOC' ? 'text-amber-600' :
            p.status === 'PERDIDA' ? 'text-red-500' : 'text-purple-600'
          } />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-bold px-2 py-0.5 rounded ${statusOpt?.color ?? 'bg-slate-100 text-slate-500'}`}>
              {statusOpt?.label ?? p.status}
            </span>
            {p.percentualConformidade > 0 && (
              <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                p.percentualConformidade >= 100 ? 'bg-green-100 text-green-700' :
                p.percentualConformidade >= 50 ? 'bg-amber-100 text-amber-700' :
                'bg-red-100 text-red-700'
              }`}>
                {p.percentualConformidade}% docs
              </span>
            )}
          </div>
          <p className="text-sm font-medium text-slate-900 truncate">
            {p.licitacao?.objeto ?? `Licitação ${p.licitacaoId.slice(0, 8)}...`}
          </p>
          <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
            <span>{empresa?.nomeFantasia || empresa?.razaoSocial || p.empresaId.slice(0, 8)}</span>
            {p.licitacao?.uf && <span>{p.licitacao.uf}</span>}
            {p.licitacao?.modalidade && <span>{p.licitacao.modalidade}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="text-right">
            {p.valorProposta && (
              <p className="text-sm font-semibold text-slate-800">{formatCurrency(p.valorProposta)}</p>
            )}
            <p className="text-xs text-slate-400">{formatDate(p.createdAt)}</p>
          </div>
          <ChevronRight size={16} className="text-slate-300" />
        </div>
      </div>
    </div>
  );
}

/* ---- Modal Criar ---- */
function CriarParticipacaoModal({ open, empresas, preEmpresaId, preLicitacaoId, onClose, onSuccess, onError }: {
  open: boolean;
  empresas: Empresa[];
  preEmpresaId: string;
  preLicitacaoId: string;
  onClose: () => void;
  onSuccess: (p: Participacao) => void;
  onError: (msg: string) => void;
}) {
  const [empresaId, setEmpresaId] = useState(preEmpresaId);
  const [licitacaoId, setLicitacaoId] = useState(preLicitacaoId);
  const [licitacoes, setLicitacoes] = useState<Licitacao[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingLics, setLoadingLics] = useState(false);

  const selectedLic = licitacoes.find((l) => l.id === licitacaoId);

  useEffect(() => {
    setLoadingLics(true);
    api.get<{ data: Licitacao[] }>('/licitacoes?limit=200')
      .then((r) => setLicitacoes(r.data))
      .finally(() => setLoadingLics(false));
  }, []);

  async function handleParticipar() {
    if (!empresaId || !licitacaoId) {
      onError('Selecione empresa e licitação');
      return;
    }
    try {
      setLoading(true);
      const result = await api.post<Participacao>('/participacoes', { empresaId, licitacaoId });
      onSuccess(result);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Erro ao registrar');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Participar de Licitação" size="md">
      <div className="space-y-4">
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-sm text-purple-700">
          O sistema vai <strong>automaticamente baixar o edital, extrair requisitos e verificar seus documentos</strong>.
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Empresa</label>
          <select
            value={empresaId}
            onChange={(e) => setEmpresaId(e.target.value)}
            className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            disabled={loading || empresas.length === 1}
          >
            <option value="">Selecione...</option>
            {empresas.map((e) => (
              <option key={e.id} value={e.id}>{e.nomeFantasia || e.razaoSocial}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Licitação</label>
          <select
            value={licitacaoId}
            onChange={(e) => setLicitacaoId(e.target.value)}
            className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            disabled={loading || loadingLics}
          >
            <option value="">{loadingLics ? 'Carregando...' : 'Selecione...'}</option>
            {licitacoes.map((l) => (
              <option key={l.id} value={l.id}>
                {l.objeto.slice(0, 80)} — {l.uf}
              </option>
            ))}
          </select>
        </div>

        {selectedLic && (
          <div className="bg-slate-50 rounded-lg p-3 text-sm space-y-1">
            <p className="font-medium text-slate-900 truncate">{selectedLic.objeto}</p>
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span>{selectedLic.orgao}</span>
              <span>{selectedLic.modalidade}</span>
              {selectedLic.valorEstimado && <span>{formatCurrency(selectedLic.valorEstimado)}</span>}
            </div>
            <div className="flex items-center gap-2 text-xs mt-1">
              {selectedLic.linkEdital ? (
                <span className="text-green-600 flex items-center gap-1"><CheckCircle2 size={12} /> Edital disponível</span>
              ) : (
                <span className="text-amber-600 flex items-center gap-1"><AlertCircle size={12} /> Edital será buscado automaticamente</span>
              )}
            </div>
          </div>
        )}

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
            onClick={handleParticipar}
            disabled={loading || !empresaId || !licitacaoId}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors disabled:opacity-50"
          >
            {loading ? (
              <><Loader2 size={16} className="animate-spin" /> Analisando...</>
            ) : (
              'Participar'
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
