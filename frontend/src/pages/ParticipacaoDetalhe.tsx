import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Loader2, AlertCircle, CheckCircle2,
  Calendar, FileText, RefreshCw, Trash2, XCircle,
  ExternalLink, Clock, Shield, Handshake, ChevronDown, ChevronUp,
  Link2, Send, Upload, Bot,
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

interface RoboLogEntry {
  etapa: string;
  mensagem: string;
  tipo: 'info' | 'sucesso' | 'erro' | 'detalhe' | 'resultado';
  ts: number;
}

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
  const [editalUrlManual, setEditalUrlManual] = useState('');
  const [analisando, setAnalisando] = useState(false);
  const [editalTab, setEditalTab] = useState<'link' | 'upload' | 'robo'>('robo');
  const [editalFile, setEditalFile] = useState<File | null>(null);
  const [roboLog, setRoboLog] = useState<RoboLogEntry[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (id) loadDetalhe(id);
  }, [id]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [roboLog]);

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

  async function handleAnalisarManual() {
    if (!id || !editalUrlManual.trim()) return;
    try {
      setAnalisando(true);
      const data = await api.post<Participacao>(`/participacoes/${id}/analisar-edital`, {
        editalUrl: editalUrlManual.trim(),
      });
      setParticipacao(data);
      setEditalUrlManual('');
      addToast('success', 'Análise de edital concluída!');
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Erro ao analisar edital');
    } finally {
      setAnalisando(false);
    }
  }

  async function handleRetentarAnalise() {
    if (!id || !participacao?.editalUrl) return;
    try {
      setAnalisando(true);
      const data = await api.post<Participacao>(`/participacoes/${id}/analisar-edital`, {
        editalUrl: participacao.editalUrl,
      });
      setParticipacao(data);
      addToast('success', 'Análise de edital concluída!');
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Erro ao analisar edital');
    } finally {
      setAnalisando(false);
    }
  }

  async function handleUploadEdital() {
    if (!id || !editalFile) return;
    try {
      setAnalisando(true);
      const formData = new FormData();
      formData.append('edital', editalFile);

      const res = await fetch(`/api/participacoes/${id}/analisar-edital-upload`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Erro ${res.status}`);
      }
      const data: Participacao = await res.json();
      setParticipacao(data);
      setEditalFile(null);
      addToast('success', 'Análise de edital concluída!');
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Erro ao analisar edital');
    } finally {
      setAnalisando(false);
    }
  }

  async function handleBuscarViaRobo() {
    if (!id) return;
    setAnalisando(true);
    setRoboLog([{ etapa: 'inicio', mensagem: 'Iniciando robô...', tipo: 'info', ts: Date.now() }]);

    try {
      const response = await fetch(`/api/participacoes/${id}/buscar-edital-robo`, { method: 'POST' });

      if (!response.body) {
        throw new Error('Navegador não suporta streaming');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const evento = JSON.parse(line.slice(6));
            if (evento.tipo === 'resultado' && evento.dados) {
              setParticipacao(evento.dados as Participacao);
              addToast('success', 'Robô encontrou e analisou o edital!');
            } else {
              setRoboLog((prev) => [...prev, { ...evento, ts: Date.now() }]);
            }
          } catch {
            // ignore parse errors
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      setRoboLog((prev) => [...prev, { etapa: 'erro', mensagem: msg, tipo: 'erro', ts: Date.now() }]);
      addToast('error', msg);
    } finally {
      setAnalisando(false);
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

      {/* Painel de análise manual */}
      {docsExigidos.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-4 shadow-sm">
          <div className="flex items-start gap-3 mb-3">
            <AlertCircle size={20} className="text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-amber-800">
                {p.editalUrl && !p.editalUrl.startsWith('upload://') ? 'Falha na análise do edital' : 'Sem análise de edital'}
              </p>
              <p className="text-sm text-amber-700 mt-0.5">
                {p.editalUrl && !p.editalUrl.startsWith('upload://')
                  ? 'O sistema não conseguiu baixar ou processar o PDF do edital. Use o robô para buscar automaticamente, informe outro link ou envie o PDF.'
                  : 'Use o robô para buscar automaticamente, cole o link do PDF ou faça upload do arquivo para disparar a análise.'}
              </p>
            </div>
          </div>

          {p.editalUrl && !p.editalUrl.startsWith('upload://') && (
            <div className="mb-3">
              <p className="text-xs text-amber-600 mb-1">URL utilizada:</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-white/60 border border-amber-200 rounded px-2 py-1.5 text-amber-800 truncate">
                  {p.editalUrl}
                </code>
                <button
                  onClick={handleRetentarAnalise}
                  disabled={analisando}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-800 bg-amber-200 hover:bg-amber-300 rounded-lg transition-colors disabled:opacity-50"
                >
                  {analisando ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                  Tentar novamente
                </button>
              </div>
            </div>
          )}

          <div className="border-t border-amber-200 pt-3">
            <div className="flex gap-1 mb-3 bg-amber-100 rounded-lg p-0.5">
              <button
                onClick={() => setEditalTab('robo')}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                  editalTab === 'robo' ? 'bg-white text-amber-900 shadow-sm' : 'text-amber-700 hover:text-amber-900'
                }`}
              >
                <Bot size={13} /> Buscar com Robô
              </button>
              <button
                onClick={() => setEditalTab('link')}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                  editalTab === 'link' ? 'bg-white text-amber-900 shadow-sm' : 'text-amber-700 hover:text-amber-900'
                }`}
              >
                <Link2 size={13} /> Informar link
              </button>
              <button
                onClick={() => setEditalTab('upload')}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                  editalTab === 'upload' ? 'bg-white text-amber-900 shadow-sm' : 'text-amber-700 hover:text-amber-900'
                }`}
              >
                <Upload size={13} /> Enviar PDF
              </button>
            </div>

            {editalTab === 'robo' && (
              <div className="space-y-3">
                {roboLog.length === 0 ? (
                  <div className="bg-white rounded-lg border border-amber-200 p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                        <Bot size={20} className="text-purple-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-800">Busca automática com robô</p>
                        <p className="text-xs text-slate-500 mt-1">
                          O robô abre um navegador invisível, navega até o portal, encontra o PDF do edital, baixa e analisa tudo automaticamente.
                        </p>
                        {(p.portalLink || p.licitacao?.linkPortal) && (
                          <p className="text-xs text-purple-600 mt-1.5 font-medium truncate">
                            Portal: {p.portalLink || p.licitacao?.linkPortal}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-900 rounded-lg border border-slate-700 overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-2 bg-slate-800 border-b border-slate-700">
                      <div className="flex gap-1.5">
                        <span className="w-3 h-3 rounded-full bg-red-500" />
                        <span className="w-3 h-3 rounded-full bg-yellow-500" />
                        <span className="w-3 h-3 rounded-full bg-green-500" />
                      </div>
                      <span className="text-xs text-slate-400 font-mono ml-2">robô — busca de edital</span>
                      {analisando && <Loader2 size={12} className="animate-spin text-purple-400 ml-auto" />}
                    </div>
                    <div className="p-3 max-h-72 overflow-y-auto font-mono text-xs space-y-0.5">
                      {roboLog.map((entry, i) => (
                        <RoboLogLine key={i} entry={entry} />
                      ))}
                      <div ref={logEndRef} />
                    </div>
                  </div>
                )}
                <button
                  onClick={handleBuscarViaRobo}
                  disabled={analisando || (!p.portalLink && !p.licitacao?.linkPortal)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700 transition-colors disabled:opacity-50"
                >
                  {analisando ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Robô trabalhando...
                    </>
                  ) : roboLog.length > 0 ? (
                    <>
                      <RefreshCw size={16} />
                      Tentar Novamente
                    </>
                  ) : (
                    <>
                      <Bot size={16} />
                      Iniciar Busca Automática
                    </>
                  )}
                </button>
                {!p.portalLink && !p.licitacao?.linkPortal && (
                  <p className="text-xs text-red-600 text-center">
                    Sem link do portal disponível. Use as opções de link manual ou upload.
                  </p>
                )}
              </div>
            )}

            {editalTab === 'link' && (
              <div className="flex gap-2">
                <input
                  type="url"
                  value={editalUrlManual}
                  onChange={(e) => setEditalUrlManual(e.target.value)}
                  placeholder="https://... cole o link direto do PDF do edital"
                  className="flex-1 px-3 py-2 border border-amber-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-amber-400 focus:border-amber-400 outline-none placeholder:text-amber-400"
                  disabled={analisando}
                />
                <button
                  onClick={handleAnalisarManual}
                  disabled={analisando || !editalUrlManual.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors disabled:opacity-50 whitespace-nowrap"
                >
                  {analisando ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  Analisar
                </button>
              </div>
            )}

            {editalTab === 'upload' && (
              <div className="space-y-2">
                <label
                  className={`flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                    editalFile
                      ? 'border-purple-400 bg-purple-50'
                      : 'border-amber-300 bg-white hover:border-amber-400 hover:bg-amber-50/50'
                  } ${analisando ? 'opacity-50 pointer-events-none' : ''}`}
                >
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    className="hidden"
                    disabled={analisando}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) setEditalFile(f);
                    }}
                  />
                  {editalFile ? (
                    <>
                      <FileText size={24} className="text-purple-500" />
                      <div className="text-center">
                        <p className="text-sm font-medium text-purple-800">{editalFile.name}</p>
                        <p className="text-xs text-purple-600 mt-0.5">
                          {(editalFile.size / 1024 / 1024).toFixed(2)} MB — Clique para trocar
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <Upload size={24} className="text-amber-500" />
                      <div className="text-center">
                        <p className="text-sm font-medium text-amber-800">Clique para selecionar o PDF</p>
                        <p className="text-xs text-amber-600 mt-0.5">ou arraste e solte aqui (máx. 50MB)</p>
                      </div>
                    </>
                  )}
                </label>
                <button
                  onClick={handleUploadEdital}
                  disabled={analisando || !editalFile}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors disabled:opacity-50"
                >
                  {analisando ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  Enviar e Analisar Edital
                </button>
              </div>
            )}
          </div>
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

const LOG_TIPO_STYLES: Record<string, string> = {
  info: 'text-blue-400',
  sucesso: 'text-green-400',
  erro: 'text-red-400',
  detalhe: 'text-slate-500',
};

const LOG_TIPO_PREFIX: Record<string, string> = {
  info: '►',
  sucesso: '✓',
  erro: '✗',
  detalhe: '  •',
};

function RoboLogLine({ entry }: { entry: RoboLogEntry }) {
  const color = LOG_TIPO_STYLES[entry.tipo] || 'text-slate-400';
  const prefix = LOG_TIPO_PREFIX[entry.tipo] || '►';
  const time = new Date(entry.ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div className={`flex gap-2 leading-relaxed ${color}`}>
      <span className="text-slate-600 shrink-0 select-none">{time}</span>
      <span className="shrink-0 w-3 text-center select-none">{prefix}</span>
      <span className={entry.tipo === 'detalhe' ? 'text-slate-500 italic' : ''}>{entry.mensagem}</span>
    </div>
  );
}
