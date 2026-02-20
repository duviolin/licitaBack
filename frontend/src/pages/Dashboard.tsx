import { useEffect, useState } from 'react';
import { Building2, FileText, Star, Handshake, TrendingUp, AlertCircle, Info, Download, Trash2, Loader2 } from 'lucide-react';
import { api } from '../lib/api';
import { StatCard } from '../components/StatCard';
import { PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import { ImportarLicitacoesModal } from '../components/ImportarLicitacoesModal';
import { ToastContainer } from '../components/Toast';
import { useToast } from '../hooks/useToast';
import type { Empresa, Licitacao, LicitacaoMatch, Participacao } from '../types';

interface DashboardStats {
  empresas: number;
  licitacoes: number;
  matchesAltos: number;
  participacoes: number;
  topMatches: Array<{
    empresa: string;
    objeto: string;
    score: number;
  }>;
  participacoesRecentes: Participacao[];
}

export function Dashboard() {
  const { toasts, addToast, removeToast } = useToast();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showImportar, setShowImportar] = useState(false);
  const [showLimpeza, setShowLimpeza] = useState(false);
  const [limpezaPreview, setLimpezaPreview] = useState<{
    matchesDescartados: number;
    licitacoesEncerradas: number;
    licitacoesOrfas: number;
  } | null>(null);
  const [loadingLimpeza, setLoadingLimpeza] = useState(false);
  const [executandoLimpeza, setExecutandoLimpeza] = useState(false);

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    try {
      setLoading(true);
      setError(null);

      const [empresas, licitacoes, participacoes] = await Promise.all([
        api.get<Empresa[]>('/empresas'),
        api.get<{ data: Licitacao[]; total: number }>('/licitacoes'),
        api.get<Participacao[]>('/participacoes'),
      ]);

      let matchesAltos = 0;
      const topMatches: DashboardStats['topMatches'] = [];

      for (const emp of empresas) {
        try {
          const matches = await api.get<(LicitacaoMatch & { licitacao: Licitacao })[]>(
            `/empresas/${emp.id}/matches?scoreMin=0.5`
          );
          matchesAltos += matches.length;

          for (const m of matches.slice(0, 3)) {
            topMatches.push({
              empresa: emp.nomeFantasia || emp.razaoSocial,
              objeto: m.licitacao.objeto.slice(0, 80),
              score: Number(m.score),
            });
          }
        } catch {
          // skip
        }
      }

      topMatches.sort((a, b) => b.score - a.score);

      setStats({
        empresas: empresas.length,
        licitacoes: licitacoes.total,
        matchesAltos,
        participacoes: participacoes.length,
        topMatches: topMatches.slice(0, 5),
        participacoesRecentes: participacoes.slice(0, 5),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }

  async function openLimpeza() {
    setShowLimpeza(true);
    setLoadingLimpeza(true);
    try {
      const preview = await api.get<typeof limpezaPreview>('/licitacoes/limpeza/preview');
      setLimpezaPreview(preview);
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Erro ao carregar preview');
      setShowLimpeza(false);
    } finally {
      setLoadingLimpeza(false);
    }
  }

  async function executarLimpeza() {
    setExecutandoLimpeza(true);
    try {
      const result = await api.post<{
        matchesRemovidos: number;
        licitacoesEncerradasRemovidas: number;
        licitacoesOrfasRemovidas: number;
      }>('/licitacoes/limpeza/executar');

      const total = result.matchesRemovidos + result.licitacoesEncerradasRemovidas + result.licitacoesOrfasRemovidas;
      addToast('success', `Limpeza concluída! ${total} registros removidos.`);
      setShowLimpeza(false);
      setLimpezaPreview(null);
      loadStats();
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Erro na limpeza');
    } finally {
      setExecutandoLimpeza(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3 text-red-700">
        <AlertCircle size={20} />
        <span>{error}</span>
        <button onClick={loadStats} className="ml-auto text-sm underline">
          Tentar novamente
        </button>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div>
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <PageHeader
        title="Dashboard"
        description="Visão geral do sistema de licitações"
        actions={
          <div className="flex gap-2">
            <button
              onClick={openLimpeza}
              className="flex items-center gap-2 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
            >
              <Trash2 size={16} />
              Limpar base
            </button>
            <button
              onClick={() => setShowImportar(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              <Download size={16} />
              Importar Licitações
            </button>
          </div>
        }
      />

      <div className="bg-slate-100 border border-slate-200 rounded-lg p-3 mb-6 text-sm text-slate-600 flex items-start gap-2">
        <Info size={16} className="shrink-0 mt-0.5" />
        <div>
          <p><strong>Fluxo de uso:</strong> 1) Cadastre empresas por CNPJ → 2) Configure preferências (palavras-chave, UFs, valores) → 3) Importe licitações do PNCP → 4) Veja os matches por relevância → 5) Registre participações nas melhores oportunidades.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <StatCard label="Empresas" value={stats.empresas} icon={Building2} color="bg-blue-600" subtitle="cadastradas" />
        <StatCard label="Licitações" value={stats.licitacoes} icon={FileText} color="bg-emerald-600" subtitle="importadas (relevantes)" />
        <StatCard label="Matches > 50%" value={stats.matchesAltos} icon={Star} color="bg-amber-500" subtitle="score acima de 0.5" />
        <StatCard label="Participações" value={stats.participacoes} icon={Handshake} color="bg-purple-600" subtitle="registradas" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
            <TrendingUp size={18} className="text-amber-500" />
            <h2 className="font-semibold text-slate-900">Melhores Matches</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {stats.topMatches.length === 0 ? (
              <p className="px-5 py-8 text-sm text-slate-400 text-center">
                Nenhum match encontrado. Cadastre empresas e importe licitações.
              </p>
            ) : (
              stats.topMatches.map((m, i) => (
                <div key={i} className="px-5 py-3 flex items-center gap-3">
                  <span className={`text-xs font-bold px-2 py-1 rounded ${m.score >= 0.7 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                    {(m.score * 100).toFixed(0)}%
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{m.objeto}</p>
                    <p className="text-xs text-slate-400">{m.empresa}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
            <Handshake size={18} className="text-purple-500" />
            <h2 className="font-semibold text-slate-900">Participações Recentes</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {stats.participacoesRecentes.length === 0 ? (
              <p className="px-5 py-8 text-sm text-slate-400 text-center">
                Nenhuma participação registrada ainda.
              </p>
            ) : (
              stats.participacoesRecentes.map((p) => (
                <div key={p.id} className="px-5 py-3 flex items-center gap-3">
                  <StatusBadge status={p.status} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">
                      {p.licitacao?.objeto ?? p.licitacaoId.slice(0, 12)}
                    </p>
                    <p className="text-xs text-slate-400">
                      {p.empresa?.razaoSocial ?? p.empresaId.slice(0, 12)}
                    </p>
                  </div>
                  {p.valorProposta && (
                    <span className="text-sm font-medium text-slate-600">
                      R$ {Number(p.valorProposta).toLocaleString('pt-BR')}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Modal Limpeza */}
      <Modal open={showLimpeza} onClose={() => { setShowLimpeza(false); setLimpezaPreview(null); }} title="Limpar Base de Dados" size="md">
        {loadingLimpeza ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 size={24} className="animate-spin text-blue-600" />
          </div>
        ) : limpezaPreview ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              A limpeza remove dados desnecessários para manter a base enxuta:
            </p>

            <div className="space-y-3">
              <LimpezaItem
                label="Matches descartados"
                count={limpezaPreview.matchesDescartados}
                desc="Matches que você marcou como irrelevantes"
                color="text-red-600"
              />
              <LimpezaItem
                label="Licitações encerradas (> 30 dias)"
                count={limpezaPreview.licitacoesEncerradas}
                desc="Licitações com prazo expirado há mais de 30 dias (sem participações)"
                color="text-amber-600"
              />
              <LimpezaItem
                label="Licitações órfãs"
                count={limpezaPreview.licitacoesOrfas}
                desc="Licitações sem nenhum match ou participação"
                color="text-slate-500"
              />
            </div>

            {limpezaPreview.matchesDescartados + limpezaPreview.licitacoesEncerradas + limpezaPreview.licitacoesOrfas === 0 ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700 text-center">
                A base já está limpa! Nada para remover.
              </div>
            ) : (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
                Participações ativas e matches favoritados <strong>nunca</strong> são removidos.
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => { setShowLimpeza(false); setLimpezaPreview(null); }}
                className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={executarLimpeza}
                disabled={executandoLimpeza || (limpezaPreview.matchesDescartados + limpezaPreview.licitacoesEncerradas + limpezaPreview.licitacoesOrfas === 0)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {executandoLimpeza ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                {executandoLimpeza ? 'Limpando...' : 'Executar limpeza'}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      <ImportarLicitacoesModal
        open={showImportar}
        onClose={() => setShowImportar(false)}
        onSuccess={(res) => {
          addToast('success', `${res.totalImportadas} licitações importadas, ${res.matchesCalculados} matches`);
          loadStats();
        }}
        onError={(msg) => addToast('error', msg)}
      />
    </div>
  );
}

const statusColors: Record<string, string> = {
  ANALISANDO: 'bg-blue-100 text-blue-700',
  PROPOSTA_ENVIADA: 'bg-yellow-100 text-yellow-700',
  EM_DISPUTA: 'bg-indigo-100 text-indigo-700',
  GANHO: 'bg-green-100 text-green-700',
  PERDIDO: 'bg-red-100 text-red-700',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`text-xs font-bold px-2 py-1 rounded ${statusColors[status] ?? 'bg-slate-100 text-slate-500'}`}>
      {status}
    </span>
  );
}

function LimpezaItem({ label, count, desc, color }: { label: string; count: number; desc: string; color: string }) {
  return (
    <div className="flex items-center gap-3 bg-slate-50 rounded-lg p-3">
      <span className={`text-xl font-bold min-w-[40px] text-right ${color}`}>{count}</span>
      <div className="flex-1">
        <p className="text-sm font-medium text-slate-800">{label}</p>
        <p className="text-xs text-slate-500">{desc}</p>
      </div>
    </div>
  );
}
