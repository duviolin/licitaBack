import { useEffect, useState, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Handshake, Plus, Loader2, X, Info, Trash2,
} from 'lucide-react';
import { api } from '../lib/api';
import { formatCurrency, formatDate } from '../lib/constants';
import { PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import { FieldHelp } from '../components/FieldHelp';
import { ToastContainer } from '../components/Toast';
import { useToast } from '../hooks/useToast';
import type { Empresa, Licitacao, Participacao, ParticipacaoStatus } from '../types';

const STATUS_OPTIONS: { value: ParticipacaoStatus; label: string; color: string; desc: string }[] = [
  { value: 'ANALISANDO', label: 'Analisando', color: 'bg-blue-100 text-blue-700', desc: 'Avaliando se vale participar' },
  { value: 'PROPOSTA_ENVIADA', label: 'Proposta Enviada', color: 'bg-yellow-100 text-yellow-700', desc: 'Proposta foi submetida' },
  { value: 'EM_DISPUTA', label: 'Em Disputa', color: 'bg-indigo-100 text-indigo-700', desc: 'Participando do certame' },
  { value: 'GANHO', label: 'Ganho', color: 'bg-green-100 text-green-700', desc: 'Licitação vencida!' },
  { value: 'PERDIDO', label: 'Perdido', color: 'bg-red-100 text-red-700', desc: 'Não venceu o certame' },
];

export function Participacoes() {
  const [searchParams] = useSearchParams();
  const { toasts, addToast, removeToast } = useToast();
  const [participacoes, setParticipacoes] = useState<Participacao[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCriar, setShowCriar] = useState(false);
  const [editando, setEditando] = useState<Participacao | null>(null);
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

  return (
    <div>
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <PageHeader
        title="Participações"
        description={`${participacoes.length} participação${participacoes.length !== 1 ? 'ões' : ''} registrada${participacoes.length !== 1 ? 's' : ''}`}
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

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-6 text-sm text-blue-700 flex items-start gap-2">
        <Info size={16} className="shrink-0 mt-0.5" />
        <div>
          <p className="font-medium">O que são participações?</p>
          <p>
            Uma participação registra que sua <strong>empresa decidiu concorrer</strong> em uma licitação.
            Você pode acompanhar o status (analisando, proposta enviada, em disputa, ganho ou perdido),
            anotar o valor da proposta e adicionar observações. Use para controlar todo o funil de licitações.
          </p>
        </div>
      </div>

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
              onEdit={() => setEditando(p)}
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
            addToast('success', 'Participação registrada com sucesso!');
          }}
          onError={(msg) => addToast('error', msg)}
        />
      )}

      {/* Modal Editar */}
      {editando && (
        <EditarParticipacaoModal
          open={!!editando}
          participacao={editando}
          onClose={() => setEditando(null)}
          onSuccess={(atualizada) => {
            setParticipacoes((prev) => prev.map((p) => (p.id === atualizada.id ? atualizada : p)));
            setEditando(null);
            addToast('success', 'Participação atualizada!');
          }}
          onRemove={(id) => {
            setParticipacoes((prev) => prev.filter((p) => p.id !== id));
            setEditando(null);
            addToast('success', 'Participação removida.');
          }}
          onError={(msg) => addToast('error', msg)}
        />
      )}
    </div>
  );
}

/* ---- Card ---- */
function ParticipacaoCard({ participacao: p, empresas, onEdit }: {
  participacao: Participacao;
  empresas: Empresa[];
  onEdit: () => void;
}) {
  const empresa = empresas.find((e) => e.id === p.empresaId);
  const statusOpt = STATUS_OPTIONS.find((s) => s.value === p.status);

  return (
    <div
      onClick={onEdit}
      className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
    >
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-purple-50 shrink-0">
          <Handshake size={18} className="text-purple-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-bold px-2 py-0.5 rounded ${statusOpt?.color ?? 'bg-slate-100 text-slate-500'}`}>
              {statusOpt?.label ?? p.status}
            </span>
            <span className="text-xs text-slate-400">{statusOpt?.desc}</span>
          </div>
          <p className="text-sm font-medium text-slate-900 truncate">
            {p.licitacao?.objeto ?? `Licitação ${p.licitacaoId.slice(0, 8)}...`}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            {empresa?.nomeFantasia || empresa?.razaoSocial || p.empresaId.slice(0, 8)}
          </p>
          {p.observacoes && (
            <p className="text-xs text-slate-400 mt-1 italic truncate">"{p.observacoes}"</p>
          )}
        </div>
        <div className="text-right shrink-0">
          {p.valorProposta && (
            <p className="text-sm font-semibold text-slate-800">{formatCurrency(p.valorProposta)}</p>
          )}
          <p className="text-xs text-slate-400">{formatDate(p.createdAt)}</p>
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
  const [valorProposta, setValorProposta] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingLics, setLoadingLics] = useState(false);

  useEffect(() => {
    setLoadingLics(true);
    api.get<{ data: Licitacao[] }>('/licitacoes?limit=100')
      .then((r) => setLicitacoes(r.data))
      .finally(() => setLoadingLics(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!empresaId || !licitacaoId) {
      onError('Selecione empresa e licitação');
      return;
    }
    try {
      setLoading(true);
      const body: Record<string, unknown> = { empresaId, licitacaoId };
      if (valorProposta) body.valorProposta = Number(valorProposta);
      if (observacoes) body.observacoes = observacoes;

      const result = await api.post<Participacao>('/participacoes', body);
      onSuccess(result);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Erro ao registrar');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Registrar Participação" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-sm text-purple-700">
          <p className="font-medium mb-1">O que é registrar uma participação?</p>
          <p>
            Significa que sua empresa <strong>vai concorrer</strong> nesta licitação. O status
            inicial é "Analisando". Depois você pode atualizar para "Proposta Enviada", "Em Disputa", etc.
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
          <FieldHelp text="A empresa que vai participar da licitação. Deve estar cadastrada no sistema." />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Licitação</label>
          <select
            value={licitacaoId}
            onChange={(e) => setLicitacaoId(e.target.value)}
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
          <FieldHelp text="A licitação em que a empresa quer participar. A lista mostra as licitações importadas do PNCP." />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Valor da proposta (R$) — opcional
          </label>
          <input
            type="number"
            value={valorProposta}
            onChange={(e) => setValorProposta(e.target.value)}
            placeholder="Ex: 50000"
            min="0"
            step="100"
            className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            disabled={loading}
          />
          <FieldHelp text="O valor que a empresa pretende ofertar (em reais, sem pontos). Pode ser preenchido depois. Ex: 50000 para R$ 50.000,00." />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Observações — opcional
          </label>
          <textarea
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            placeholder="Anotações sobre a participação..."
            rows={2}
            className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
            disabled={loading}
          />
          <FieldHelp text="Notas internas livres. Ex: 'Edital revisado pela equipe jurídica', 'Precisa de atestado técnico'." />
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
            disabled={loading || !empresaId || !licitacaoId}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors disabled:opacity-50"
          >
            {loading ? (
              <><Loader2 size={16} className="animate-spin" /> Registrando...</>
            ) : (
              'Registrar Participação'
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ---- Modal Editar ---- */
function EditarParticipacaoModal({ open, participacao, onClose, onSuccess, onRemove, onError }: {
  open: boolean;
  participacao: Participacao;
  onClose: () => void;
  onSuccess: (p: Participacao) => void;
  onRemove: (id: string) => void;
  onError: (msg: string) => void;
}) {
  const [status, setStatus] = useState<ParticipacaoStatus>(participacao.status);
  const [valorProposta, setValorProposta] = useState(participacao.valorProposta?.toString() ?? '');
  const [observacoes, setObservacoes] = useState(participacao.observacoes ?? '');
  const [loading, setLoading] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [removing, setRemoving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      setLoading(true);
      const body: Record<string, unknown> = { status, observacoes };
      if (valorProposta) body.valorProposta = Number(valorProposta);

      const result = await api.patch<Participacao>(`/participacoes/${participacao.id}`, body);
      onSuccess(result);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Erro ao atualizar');
    } finally {
      setLoading(false);
    }
  }

  async function handleRemove() {
    try {
      setRemoving(true);
      await api.delete(`/participacoes/${participacao.id}`);
      onRemove(participacao.id);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Erro ao remover');
    } finally {
      setRemoving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Atualizar Participação" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-slate-50 rounded-lg p-3 text-sm">
          <p className="font-medium text-slate-900 truncate">
            {participacao.licitacao?.objeto ?? `Licitação ${participacao.licitacaoId.slice(0, 12)}...`}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            Criada em {formatDate(participacao.createdAt)}
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Status</label>
          <div className="grid grid-cols-1 gap-2">
            {STATUS_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${
                  status === opt.value
                    ? 'border-purple-400 bg-purple-50'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="status"
                  value={opt.value}
                  checked={status === opt.value}
                  onChange={() => setStatus(opt.value)}
                  className="accent-purple-600"
                />
                <div className="flex-1">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${opt.color}`}>{opt.label}</span>
                  <span className="text-xs text-slate-500 ml-2">{opt.desc}</span>
                </div>
              </label>
            ))}
          </div>
          <FieldHelp text="O status reflete o andamento da participação. Atualize conforme o processo avança: Analisando → Proposta Enviada → Em Disputa → Ganho/Perdido." />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Valor da proposta (R$)
          </label>
          <input
            type="number"
            value={valorProposta}
            onChange={(e) => setValorProposta(e.target.value)}
            placeholder="Ex: 50000"
            min="0"
            step="100"
            className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            disabled={loading}
          />
          <FieldHelp text="Valor que foi ou será ofertado na proposta, em reais (sem pontos ou vírgulas). Ex: 150000 = R$ 150.000,00." />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Observações</label>
          <textarea
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            placeholder="Anotações sobre o andamento..."
            rows={3}
            className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
            disabled={loading}
          />
          <FieldHelp text="Notas livres para acompanhamento. Ex: 'Aguardando resultado da ata', 'Recurso administrativo protocolado'." />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
            disabled={loading || removing}
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading || removing}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors disabled:opacity-50"
          >
            {loading ? (
              <><Loader2 size={16} className="animate-spin" /> Salvando...</>
            ) : (
              'Salvar Alterações'
            )}
          </button>
        </div>

        {/* Remover */}
        <div className="border-t border-slate-200 pt-4">
          {!confirmRemove ? (
            <button
              type="button"
              onClick={() => setConfirmRemove(true)}
              className="flex items-center gap-2 text-xs text-red-500 hover:text-red-700 transition-colors"
              disabled={loading || removing}
            >
              <Trash2 size={13} />
              Remover participação
            </button>
          ) : (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-2">
              <p className="text-xs text-red-700 font-medium">Tem certeza? Essa ação não pode ser desfeita.</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmRemove(false)}
                  className="px-3 py-1.5 text-xs border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50"
                  disabled={removing}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleRemove}
                  disabled={removing}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  {removing ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                  {removing ? 'Removendo...' : 'Sim, remover'}
                </button>
              </div>
            </div>
          )}
        </div>
      </form>
    </Modal>
  );
}
