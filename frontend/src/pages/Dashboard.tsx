import { useEffect, useState } from 'react';
import { Building2, FileText, Star, Handshake, TrendingUp, AlertCircle } from 'lucide-react';
import { api } from '../lib/api';
import { StatCard } from '../components/StatCard';
import { PageHeader } from '../components/PageHeader';
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
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      <PageHeader title="Dashboard" description="Visão geral do sistema de licitações" />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <StatCard label="Empresas" value={stats.empresas} icon={Building2} color="bg-blue-600" subtitle="cadastradas" />
        <StatCard label="Licitações" value={stats.licitacoes} icon={FileText} color="bg-emerald-600" subtitle="importadas" />
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
                Nenhum match encontrado. Importe licitações e cadastre empresas.
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
