import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Loader2, AlertCircle, CheckCircle2,
  Calendar, FileText, RefreshCw, Trash2, XCircle,
  ExternalLink, Clock, Shield, Handshake, ChevronDown, ChevronUp,
} from 'lucide-react';
import { api } from '../lib/api';
import { formatDate, formatCurrency } from '../lib/constants';
import { PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import { ToastContainer } from '../components/Toast';
import { useToast } from '../hooks/useToast';
import type {
  Participacao, ParticipacaoStatus, ConformidadeStatus,
  DocumentoExigido, ConformidadeDocumento, PrazosEdital,
} from '../types';

const STATUS_CFG: Record<ParticipacaoStatus, { label: string; color: string; bg: string }> = {
  ANALISANDO: { label: 'Analisando Edital', color: 'text-blue-700', bg: 'bg-blue-100' },
  PENDENTE_DOC: { label: 'Pendente de Documentos', color: 'text-amber-700', bg: 'bg-amber-100' },
  APTA: { label: 'Apta para Participar', color: 'text-green-700', bg: 'bg-green-100' },
  ENVIADA: { label: 'Proposta Enviada', color: 'text-indigo-700', bg: 'bg-indigo-100' },
  EM_DISPUTA: { label: 'Em Disputa', color: 'text-purple-700', bg: 'bg-purple-100' },
  GANHA: { label: 'Ganha!', color: 'text-emerald-700', bg: 'bg-emerald-100' },
  PERDIDA: { label: 'Perdida', color: 'text-red-700', bg: 'bg-red-100' },
};

const CONFORMIDADE_CFG: Record<ConformidadeStatus, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  OK: { label: 'OK', color: 'text-green-600', icon: CheckCircle2 },
  AUSENTE: { label: 'Ausente', color: 'text-red-500', icon: XCircle },
  VENCIDO: { label: 'Vencido', color: 'text-amber-600', icon: AlertCircle },
  INCOMPATIVEL: { label: 'Incompatível', color: 'text-orange-500', icon: AlertCircle },
};

const STATUS_ORDER: ParticipacaoStatus[] = ['ANALISANDO', 'PENDENTE_DOC', 'APTA', 'ENVIADA', 'EM_DISPUTA', 'GANHA', 'PERDIDA'];

export function ParticipacaoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toasts, addToast, removeToast } = useToast();
  const [participacao, setParticipacao] = useState<Participacao | null>(null);
  const [loading, setLoading] = useState(true);
  const [reprocessando, setReprocessando] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showRemove, setShowRemove] = useState(false);
  const [docsExpanded, setDocsExpanded] = useState(false);

  useEffect(() => {
    if (id) loadDetalhe(id);
  }, [id]);

  async function loadDetalhe(pid: string) {
    try {
      setLoading(true);
      const data = await api.get<Participacao>(`/participacoes/${pid}`);
      setParticipacao(data);
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Erro ao carregar');
    } finally {
      setLoading(false);
    }
  }

  async function handleReprocessar() {
    if (!id) return;
    try {
      setReprocessando(true);
      const data = await api.post<Participacao>(`/participacoes/${id}/reprocessar`);
      setParticipacao(data);
      addToast('success', 'Documentos reavaliados!');
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Erro ao reprocessar');
    } finally {
      setReprocessando(false);
    }
  }

  async function handleRemove() {
    if (!id) return;
    try {
      await api.delete(`/participacoes/${id}`);
      addToast('success', 'Participação removida');
      navigate('/participacoes');
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Erro ao remover');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-purple-600" />
      </div>
    );
  }

  if (!participacao) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3 text-red-700">
        <AlertCircle size={20} />
        <span>Participação não encontrada</span>
      </div>
    );
  }

  const p = participacao;
  const statusCfg = STATUS_CFG[p.status];
  const prazos = p.prazos;
  const conformidades = p.conformidades ?? [];
  const docsExigidos = p.documentosExigidos ?? [];
  const checklist = p.checklist;

  const confOk = conformidades.filter((c) => c.status === 'OK').length;
  const confTotal = conformidades.length;

  return (
    <div>
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <button
        onClick={() => navigate('/participacoes')}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-4 transition-colors"
      >
        <ArrowLeft size={16} />
        Voltar para Participações
      </button>

      <PageHeader
        title={p.licitacao?.objeto ?? 'Participação'}
        description={`${p.empresa?.nomeFantasia || p.empresa?.razaoSocial || ''} • ${p.licitacao?.orgao || ''}`}
        actions={
          <div className="flex gap-2">
            <button
              onClick={() => setShowEdit(true)}
              className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Editar
            </button>
            {docsExigidos.length > 0 && (
              <button
                onClick={handleReprocessar}
                disabled={reprocessando}
                className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors disabled:opacity-50"
              >
                {reprocessando ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                Reavaliar Docs
              </button>
            )}
          </div>
        }
      />

      {/* Status banner */}
      <div className={`rounded-xl p-4 mb-4 flex items-center justify-between ${statusCfg.bg}`}>
        <div className="flex items-center gap-3">
          {p.status === 'APTA' || p.status === 'GANHA' ? (
            <CheckCircle2 size={24} className="text-green-600" />
          ) : p.status === 'PENDENTE_DOC' ? (
            <AlertCircle size={24} className="text-amber-600" />
          ) : p.status === 'PERDIDA' ? (
            <XCircle size={24} className="text-red-500" />
          ) : (
            <Handshake size={24} className={statusCfg.color} />
          )}
          <div>
            <p className={`font-bold text-lg ${statusCfg.color}`}>{statusCfg.label}</p>
            {checklist && (
              <p className="text-sm opacity-75">
                {checklist.totalOk}/{checklist.totalExigidos} documentos OK — {checklist.percentualConformidade}% conformidade
              </p>
            )}
          </div>
        </div>
        {p.percentualConformidade > 0 && (
          <div className="text-right">
            <p className={`text-3xl font-bold ${statusCfg.color}`}>{p.percentualConformidade}%</p>
            <p className="text-xs opacity-60">conformidade</p>
          </div>
        )}
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <InfoCard label="Valor Estimado" value={formatCurrency(p.licitacao?.valorEstimado)} />
        <InfoCard label="Valor Proposta" value={p.valorProposta ? formatCurrency(p.valorProposta) : '—'} />
        <InfoCard label="Modalidade" value={p.licitacao?.modalidade ?? '—'} />
        <InfoCard label="Registrada em" value={formatDate(p.createdAt)} />
      </div>

      {/* Links */}
      {(p.editalUrl || p.portalLink || p.licitacao?.linkPortal) && (
        <div className="flex gap-3 mb-4">
          {p.editalUrl && (
            <a href={p.editalUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline font-medium bg-white px-3 py-2 rounded-lg border border-slate-200">
              <FileText size={14} /> Ver Edital PDF
            </a>
          )}
          {(p.portalLink || p.licitacao?.linkPortal) && (
            <a href={p.portalLink || p.licitacao?.linkPortal} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline font-medium bg-white px-3 py-2 rounded-lg border border-slate-200">
              <ExternalLink size={14} /> Portal da Licitação
            </a>
          )}
        </div>
      )}

      {/* Prazos */}
      {prazos && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 mb-4 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Calendar size={18} className="text-blue-600" />
            <h2 className="font-semibold text-slate-900">Prazos Extraídos do Edital</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <PrazoItem label="Abertura" value={prazos.dataAbertura} />
            <PrazoItem label="Sessão" value={prazos.dataSessao} />
            <PrazoItem label="Impugnação" value={prazos.prazoImpugnacao} />
            <PrazoItem label="Esclarecimento" value={prazos.prazoEsclarecimento} />
            <PrazoItem label="Recurso" value={prazos.prazoRecurso} />
          </div>
        </div>
      )}

      {/* Conformidade */}
      {conformidades.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 mb-4 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Shield size={18} className="text-teal-600" />
            <h2 className="font-semibold text-slate-900">Conformidade Documental</h2>
            <span className="text-xs text-slate-400 ml-auto">{confOk}/{confTotal} OK</span>
          </div>
          <div className="space-y-2">
            {conformidades.map((c) => {
              const cfg = CONFORMIDADE_CFG[c.status];
              const Icon = cfg.icon;
              return (
                <div key={c.id} className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 hover:bg-slate-50">
                  <Icon size={18} className={cfg.color} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-900">
                        {c.documentoExigido?.nome ?? c.documentoExigidoId.slice(0, 8)}
                      </span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                        c.status === 'OK' ? 'bg-green-100 text-green-700' :
                        c.status === 'VENCIDO' ? 'bg-amber-100 text-amber-700' :
                        'bg-red-100 text-red-700'
                      }`}>{cfg.label}</span>
                    </div>
                    {c.observacao && (
                      <p className="text-xs text-slate-500 mt-0.5">{c.observacao}</p>
                    )}
                    {c.empresaDocumento && (
                      <p className="text-xs text-teal-600 mt-0.5">
                        Vinculado: {c.empresaDocumento.nome}
                        {c.empresaDocumento.validade && ` • Validade: ${formatDate(c.empresaDocumento.validade)}`}
                      </p>
                    )}
                  </div>
                  <span className="text-xs bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 shrink-0">
                    {c.documentoExigido?.tipo}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Documentos Exigidos (expandível) */}
      {docsExigidos.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm mb-4">
          <button
            onClick={() => setDocsExpanded(!docsExpanded)}
            className="w-full flex items-center justify-between p-5 text-left hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <FileText size={18} className="text-slate-600" />
              <h2 className="font-semibold text-slate-900">
                Documentos Exigidos pelo Edital ({docsExigidos.length})
              </h2>
            </div>
            {docsExpanded ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
          </button>
          {docsExpanded && (
            <div className="px-5 pb-5 space-y-2 border-t border-slate-100 pt-4">
              {docsExigidos.map((doc) => (
                <DocExigidoRow key={doc.id} doc={doc} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Observações */}
      {p.observacoes && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 mb-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900 mb-2">Observações</h2>
          <p className="text-sm text-slate-600 whitespace-pre-wrap">{p.observacoes}</p>
        </div>
      )}

      {/* Sem análise */}
      {docsExigidos.length === 0 && !p.editalUrl && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4 text-sm text-amber-700">
          <p className="font-medium">Sem análise de edital</p>
          <p>Esta participação foi criada sem URL de edital. Edite e adicione a URL para disparar a análise.</p>
        </div>
      )}

      {/* Remove */}
      <div className="flex justify-end mt-4">
        <button
          onClick={() => setShowRemove(true)}
          className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 transition-colors"
        >
          <Trash2 size={13} /> Remover participação
        </button>
      </div>

      {/* Modal Editar */}
      {showEdit && (
        <EditModal
          participacao={p}
          onClose={() => setShowEdit(false)}
          onSuccess={(updated) => {
            setParticipacao(updated as Participacao);
            setShowEdit(false);
            addToast('success', 'Atualizada!');
          }}
          onError={(msg) => addToast('error', msg)}
        />
      )}

      {/* Modal Confirmar remoção */}
      <Modal open={showRemove} onClose={() => setShowRemove(false)} title="Remover Participação" size="sm">
        <p className="text-sm text-slate-600 mb-4">Tem certeza? Todos os dados de análise serão perdidos.</p>
        <div className="flex gap-3">
          <button
            onClick={() => setShowRemove(false)}
            className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium"
          >
            Cancelar
          </button>
          <button
            onClick={handleRemove}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
          >
            Sim, remover
          </button>
        </div>
      </Modal>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-sm font-medium text-slate-800 mt-0.5">{value}</p>
    </div>
  );
}

function PrazoItem({ label, value }: { label: string; value: string | null }) {
  const isPassado = value ? new Date(value) < new Date() : false;
  return (
    <div className="text-center">
      <p className="text-xs text-slate-400 mb-1">{label}</p>
      {value ? (
        <div className="flex items-center justify-center gap-1">
          <Clock size={12} className={isPassado ? 'text-red-400' : 'text-blue-400'} />
          <p className={`text-sm font-medium ${isPassado ? 'text-red-600 line-through' : 'text-slate-800'}`}>
            {formatDate(value)}
          </p>
        </div>
      ) : (
        <p className="text-sm text-slate-300">—</p>
      )}
    </div>
  );
}

function DocExigidoRow({ doc }: { doc: DocumentoExigido }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="border border-slate-100 rounded-lg">
      <div
        onClick={() => doc.referenciaEdital && setExpanded(!expanded)}
        className={`flex items-center gap-3 p-3 ${doc.referenciaEdital ? 'cursor-pointer hover:bg-slate-50' : ''}`}
      >
        <FileText size={14} className="text-slate-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-slate-800">{doc.nome}</span>
          <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
            <span className="bg-slate-100 px-1.5 py-0.5 rounded">{doc.tipo}</span>
            {doc.secaoEdital && <span>{doc.secaoEdital}</span>}
            {doc.obrigatorio && <span className="text-red-500 font-medium">Obrigatório</span>}
            {doc.validadeDias && <span>Validade: {doc.validadeDias}d</span>}
          </div>
        </div>
        {doc.referenciaEdital && (
          expanded ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />
        )}
      </div>
      {expanded && doc.referenciaEdital && (
        <div className="px-3 pb-3">
          <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-600 font-mono whitespace-pre-wrap max-h-32 overflow-y-auto">
            {doc.referenciaEdital}
          </div>
        </div>
      )}
    </div>
  );
}

function EditModal({ participacao, onClose, onSuccess, onError }: {
  participacao: Participacao;
  onClose: () => void;
  onSuccess: (p: Participacao) => void;
  onError: (msg: string) => void;
}) {
  const [status, setStatus] = useState<ParticipacaoStatus>(participacao.status);
  const [valorProposta, setValorProposta] = useState(participacao.valorProposta?.toString() ?? '');
  const [observacoes, setObservacoes] = useState(participacao.observacoes ?? '');
  const [loading, setLoading] = useState(false);

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

  return (
    <Modal open onClose={onClose} title="Atualizar Participação" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Status</label>
          <div className="grid grid-cols-1 gap-2">
            {STATUS_ORDER.map((s) => {
              const cfg = STATUS_CFG[s];
              return (
                <label
                  key={s}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${
                    status === s ? 'border-purple-400 bg-purple-50' : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="status"
                    value={s}
                    checked={status === s}
                    onChange={() => setStatus(s)}
                    className="accent-purple-600"
                  />
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                </label>
              );
            })}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Valor proposta (R$)</label>
          <input
            type="number"
            value={valorProposta}
            onChange={(e) => setValorProposta(e.target.value)}
            placeholder="Ex: 50000"
            className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            disabled={loading}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Observações</label>
          <textarea
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            rows={3}
            className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
            disabled={loading}
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50"
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : null}
            Salvar
          </button>
        </div>
      </form>
    </Modal>
  );
}
