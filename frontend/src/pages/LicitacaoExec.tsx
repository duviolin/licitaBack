import { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileSearch, Plus, Loader2, X, Info, ChevronRight,
  CheckCircle2, AlertTriangle, Clock, Send,
} from 'lucide-react';
import { api } from '../lib/api';
import { formatDate, formatCurrency } from '../lib/constants';
import { PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import { FieldHelp } from '../components/FieldHelp';
import { ToastContainer } from '../components/Toast';
import { useToast } from '../hooks/useToast';
import type { Empresa, Licitacao, LicitacaoExec as LicitacaoExecType, LicitacaoExecStatus } from '../types';

const STATUS_CONFIG: Record<LicitacaoExecStatus, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  ANALISE: { label: 'Em Análise', color: 'bg-blue-100 text-blue-700', icon: Clock },
  DOCUMENTOS_OK: { label: 'Documentos OK', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  PENDENTE_DOC: { label: 'Pendente Doc', color: 'bg-amber-100 text-amber-700', icon: AlertTriangle },
  PRONTO_ENVIO: { label: 'Pronto p/ Envio', color: 'bg-teal-100 text-teal-700', icon: Send },
  ENVIADO: { label: 'Enviado', color: 'bg-purple-100 text-purple-700', icon: Send },
};

export function LicitacaoExec() {
  const navigate = useNavigate();
  const { toasts, addToast, removeToast } = useToast();
  const [execs, setExecs] = useState<LicitacaoExecType[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(true);
  const [showIniciar, setShowIniciar] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterEmpresa, setFilterEmpresa] = useState('');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [execList, empList] = await Promise.all([
        api.get<LicitacaoExecType[]>('/licitacao-exec'),
        api.get<Empresa[]>('/empresas'),
      ]);
      setExecs(execList);
      setEmpresas(empList);
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Erro ao carregar');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = useMemo(() => {
    return execs.filter((e) => {
      if (filterStatus && e.status !== filterStatus) return false;
      if (filterEmpresa && e.empresaId !== filterEmpresa) return false;
      return true;
    });
  }, [execs, filterStatus, filterEmpresa]);

  const activeFilterCount = [filterStatus, filterEmpresa].filter(Boolean).length;

  const stats = useMemo(() => ({
    total: execs.length,
    ok: execs.filter((e) => e.status === 'DOCUMENTOS_OK' || e.status === 'PRONTO_ENVIO').length,
    pendente: execs.filter((e) => e.status === 'PENDENTE_DOC').length,
    analise: execs.filter((e) => e.status === 'ANALISE').length,
  }), [execs]);

  return (
    <div>
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <PageHeader
        title="Disputas"
        description={`${execs.length} análise${execs.length !== 1 ? 's' : ''} de licitação`}
        actions={
          <button
            onClick={() => setShowIniciar(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors shadow-sm"
          >
            <Plus size={18} />
            Iniciar Análise
          </button>
        }
      />

      <div className="bg-teal-50 border border-teal-200 rounded-lg p-3 mb-6 text-sm text-teal-700 flex items-start gap-2">
        <Info size={16} className="shrink-0 mt-0.5" />
        <div>
          <p className="font-medium">Módulo de Disputas</p>
          <p>
            Aqui você analisa editais de licitações, verifica quais documentos são exigidos,
            compara com os documentos da empresa e identifica o que está faltando ou vencido.
            O sistema gera um checklist completo para participação.
          </p>
        </div>
      </div>

      {!loading && execs.length > 0 && (
        <div className="grid grid-cols-4 gap-3 mb-6">
          <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
            <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
            <p className="text-xs text-slate-500 mt-1">Total Análises</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{stats.ok}</p>
            <p className="text-xs text-slate-500 mt-1">Aptas</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
            <p className="text-2xl font-bold text-amber-600">{stats.pendente}</p>
            <p className="text-xs text-slate-500 mt-1">Pendentes</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{stats.analise}</p>
            <p className="text-xs text-slate-500 mt-1">Em Análise</p>
          </div>
        </div>
      )}

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
          {Object.entries(STATUS_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
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

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 size={24} className="animate-spin text-teal-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <FileSearch size={48} className="text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500 mb-2">
            {execs.length === 0
              ? 'Nenhuma análise de licitação iniciada ainda.'
              : 'Nenhuma análise com os filtros aplicados.'}
          </p>
          <p className="text-xs text-slate-400 mb-4">
            Inicie uma análise selecionando uma licitação e informando a URL do edital.
          </p>
          {execs.length === 0 && (
            <button onClick={() => setShowIniciar(true)} className="text-teal-600 text-sm font-medium hover:underline">
              Iniciar primeira análise
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((exec) => {
            const cfg = STATUS_CONFIG[exec.status];
            const StatusIcon = cfg.icon;
            return (
              <div
                key={exec.id}
                onClick={() => navigate(`/licitacao-exec/${exec.id}`)}
                className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-teal-50 shrink-0">
                    <StatusIcon size={18} className="text-teal-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${cfg.color}`}>
                        {cfg.label}
                      </span>
                      <span className="text-xs text-slate-400">
                        {exec.empresa?.nomeFantasia || exec.empresa?.razaoSocial || ''}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {exec.licitacao?.objeto ?? `Licitação ${exec.licitacaoId.slice(0, 8)}...`}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {exec.licitacao?.orgao} — {exec.licitacao?.uf}
                      {exec.licitacao?.valorEstimado ? ` — ${formatCurrency(Number(exec.licitacao.valorEstimado))}` : ''}
                    </p>
                  </div>
                  <div className="text-right shrink-0 flex items-center gap-2">
                    <div>
                      <p className="text-xs text-slate-400">{formatDate(exec.createdAt)}</p>
                      {exec.prazos?.dataSessao && (
                        <p className="text-xs text-teal-600 font-medium">Sessão: {formatDate(exec.prazos.dataSessao)}</p>
                      )}
                    </div>
                    <ChevronRight size={16} className="text-slate-300" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showIniciar && (
        <IniciarAnaliseModal
          open={showIniciar}
          empresas={empresas}
          onClose={() => setShowIniciar(false)}
          onSuccess={(nova) => {
            setExecs((prev) => [nova, ...prev]);
            setShowIniciar(false);
            addToast('success', 'Análise iniciada com sucesso! Edital processado.');
            navigate(`/licitacao-exec/${nova.id}`);
          }}
          onError={(msg) => addToast('error', msg)}
        />
      )}
    </div>
  );
}

function IniciarAnaliseModal({ open, empresas, onClose, onSuccess, onError }: {
  open: boolean;
  empresas: Empresa[];
  onClose: () => void;
  onSuccess: (exec: LicitacaoExecType) => void;
  onError: (msg: string) => void;
}) {
  const [empresaId, setEmpresaId] = useState('');
  const [licitacaoId, setLicitacaoId] = useState('');
  const [editalUrl, setEditalUrl] = useState('');
  const [portalLink, setPortalLink] = useState('');
  const [licitacoes, setLicitacoes] = useState<Licitacao[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingLics, setLoadingLics] = useState(false);

  useEffect(() => {
    setLoadingLics(true);
    api.get<{ data: Licitacao[] }>('/licitacoes?limit=200')
      .then((r) => setLicitacoes(r.data))
      .finally(() => setLoadingLics(false));
  }, []);

  function handleLicitacaoChange(id: string) {
    setLicitacaoId(id);
    const lic = licitacoes.find((l) => l.id === id);
    if (lic?.linkEdital) setEditalUrl(lic.linkEdital);
    if (lic?.linkPortal) setPortalLink(lic.linkPortal);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!empresaId || !licitacaoId || !editalUrl) {
      onError('Preencha empresa, licitação e URL do edital');
      return;
    }
    try {
      setLoading(true);
      const result = await api.post<LicitacaoExecType>('/licitacao-exec/iniciar', {
        empresaId,
        licitacaoId,
        editalUrl,
        portalLink: portalLink || undefined,
      });
      onSuccess(result);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Erro ao iniciar análise');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Iniciar Análise de Edital" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-teal-50 border border-teal-200 rounded-lg p-3 text-sm text-teal-700">
          <p className="font-medium mb-1">Como funciona?</p>
          <p>
            O sistema vai <strong>baixar o edital PDF</strong>, extrair o texto, identificar os documentos
            exigidos para habilitação, comparar com os documentos da empresa e gerar um checklist completo.
            O processo leva alguns segundos.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Empresa</label>
          <select
            value={empresaId}
            onChange={(e) => setEmpresaId(e.target.value)}
            className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            disabled={loading}
          >
            <option value="">Selecione a empresa...</option>
            {empresas.map((e) => (
              <option key={e.id} value={e.id}>{e.nomeFantasia || e.razaoSocial}</option>
            ))}
          </select>
          <FieldHelp text="A empresa cuja documentação será verificada contra as exigências do edital." />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Licitação</label>
          <select
            value={licitacaoId}
            onChange={(e) => handleLicitacaoChange(e.target.value)}
            className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            disabled={loading || loadingLics}
          >
            <option value="">{loadingLics ? 'Carregando...' : 'Selecione a licitação...'}</option>
            {licitacoes.map((l) => (
              <option key={l.id} value={l.id}>
                {l.objeto.slice(0, 80)} — {l.uf} ({formatCurrency(l.valorEstimado)})
              </option>
            ))}
          </select>
          <FieldHelp text="A licitação que será analisada. Se tiver link do edital cadastrado, será preenchido automaticamente." />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">URL do Edital (PDF)</label>
          <input
            type="url"
            value={editalUrl}
            onChange={(e) => setEditalUrl(e.target.value)}
            placeholder="https://pncp.gov.br/.../arquivos/1"
            className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            disabled={loading}
          />
          <FieldHelp text="Link direto para download do PDF do edital. Pode ser do PNCP ou do portal da licitação." />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Link do Portal — opcional</label>
          <input
            type="url"
            value={portalLink}
            onChange={(e) => setPortalLink(e.target.value)}
            placeholder="https://portaldecompraspublicas.com.br/..."
            className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            disabled={loading}
          />
          <FieldHelp text="Link da licitação no portal de compras (BLL, BNC, ComprasNet, etc.). Usado para futura automação." />
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
            disabled={loading || !empresaId || !licitacaoId || !editalUrl}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors disabled:opacity-50"
          >
            {loading ? (
              <><Loader2 size={16} className="animate-spin" /> Analisando edital...</>
            ) : (
              'Iniciar Análise'
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
