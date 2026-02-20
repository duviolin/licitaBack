import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2, Plus, Search, MapPin, FileText,
  ChevronRight, Loader2,
} from 'lucide-react';
import { api } from '../lib/api';
import { formatCnpj, formatDate } from '../lib/constants';
import { PageHeader } from '../components/PageHeader';
import { ToastContainer } from '../components/Toast';
import { useToast } from '../hooks/useToast';
import { CadastrarEmpresaModal } from '../components/CadastrarEmpresaModal';
import type { Empresa } from '../types';

export function Empresas() {
  const navigate = useNavigate();
  const { toasts, addToast, removeToast } = useToast();
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterUf, setFilterUf] = useState('');
  const [showCadastrar, setShowCadastrar] = useState(false);

  useEffect(() => {
    loadEmpresas();
  }, []);

  async function loadEmpresas() {
    try {
      setLoading(true);
      const data = await api.get<Empresa[]>('/empresas');
      setEmpresas(data);
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Erro ao carregar empresas');
    } finally {
      setLoading(false);
    }
  }

  const ufsDisponiveis = useMemo(() => {
    const ufs = new Set(empresas.map((e) => e.uf).filter(Boolean));
    return [...ufs].sort();
  }, [empresas]);

  const filtered = useMemo(() => {
    return empresas.filter((e) => {
      const matchSearch =
        !search ||
        e.razaoSocial.toLowerCase().includes(search.toLowerCase()) ||
        e.nomeFantasia?.toLowerCase().includes(search.toLowerCase()) ||
        e.cnpj.includes(search.replace(/\D/g, ''));

      const matchUf = !filterUf || e.uf === filterUf;

      return matchSearch && matchUf;
    });
  }, [empresas, search, filterUf]);

  return (
    <div>
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <PageHeader
        title="Empresas"
        description={`${empresas.length} empresa${empresas.length !== 1 ? 's' : ''} cadastrada${empresas.length !== 1 ? 's' : ''}`}
        actions={
          <button
            onClick={() => setShowCadastrar(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus size={18} />
            Cadastrar por CNPJ
          </button>
        }
      />

      {/* Filtros */}
      <div className="flex gap-3 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nome, fantasia ou CNPJ..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>
        <select
          value={filterUf}
          onChange={(e) => setFilterUf(e.target.value)}
          className="px-3 py-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
        >
          <option value="">Todos os estados</option>
          {ufsDisponiveis.map((uf) => (
            <option key={uf} value={uf}>{uf}</option>
          ))}
        </select>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 size={24} className="animate-spin text-blue-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Building2 size={48} className="text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500 mb-4">
            {empresas.length === 0
              ? 'Nenhuma empresa cadastrada ainda.'
              : 'Nenhuma empresa encontrada com os filtros aplicados.'}
          </p>
          {empresas.length === 0 && (
            <button
              onClick={() => setShowCadastrar(true)}
              className="text-blue-600 text-sm font-medium hover:underline"
            >
              Cadastrar a primeira empresa
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((empresa) => (
            <EmpresaCard
              key={empresa.id}
              empresa={empresa}
              onClick={() => navigate(`/empresas/${empresa.id}`)}
            />
          ))}
        </div>
      )}

      {/* Modais */}
      <CadastrarEmpresaModal
        open={showCadastrar}
        onClose={() => setShowCadastrar(false)}
        onSuccess={(nova) => {
          setEmpresas((prev) => [nova, ...prev]);
          setShowCadastrar(false);
          addToast('success', `${nova.nomeFantasia || nova.razaoSocial} cadastrada com sucesso!`);
        }}
        onError={(msg) => addToast('error', msg)}
      />
    </div>
  );
}

function EmpresaCard({ empresa, onClick }: { empresa: Empresa; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md hover:border-blue-200 transition-all cursor-pointer"
    >
      <div className="flex items-start gap-4">
        <div className="p-2.5 rounded-lg bg-blue-50">
          <Building2 size={20} className="text-blue-600" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-slate-900 truncate">
              {empresa.nomeFantasia || empresa.razaoSocial}
            </h3>
            {empresa.situacaoCadastral && (
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                empresa.situacaoCadastral.toLowerCase().includes('ativa')
                  ? 'bg-green-100 text-green-700'
                  : 'bg-red-100 text-red-700'
              }`}>
                {empresa.situacaoCadastral}
              </span>
            )}
          </div>

          <p className="text-sm text-slate-500 mb-2">
            {empresa.razaoSocial} — <span className="font-mono text-xs">{formatCnpj(empresa.cnpj)}</span>
          </p>

          <div className="flex flex-wrap gap-3 text-xs text-slate-500">
            {empresa.uf && (
              <span className="flex items-center gap-1">
                <MapPin size={12} /> {empresa.municipio ? `${empresa.municipio}/${empresa.uf}` : empresa.uf}
              </span>
            )}
            {empresa.cnaePrincipalDescricao && (
              <span className="flex items-center gap-1">
                <FileText size={12} /> {empresa.cnaePrincipalDescricao.slice(0, 60)}
              </span>
            )}
          </div>

          {empresa.palavrasChave.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {empresa.palavrasChave.slice(0, 5).map((kw, i) => (
                <span key={i} className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded">
                  {kw}
                </span>
              ))}
              {empresa.palavrasChave.length > 5 && (
                <span className="text-xs text-slate-400">+{empresa.palavrasChave.length - 5}</span>
              )}
            </div>
          )}

          <p className="text-xs text-slate-400 mt-2">
            Cadastrada em {formatDate(empresa.createdAt)}
          </p>
        </div>

        <ChevronRight size={18} className="text-slate-300 mt-2" />
      </div>
    </div>
  );
}
