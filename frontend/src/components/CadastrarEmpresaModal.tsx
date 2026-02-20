import { useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { Modal } from './Modal';
import { api } from '../lib/api';
import type { Empresa } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: (empresa: Empresa) => void;
  onError: (msg: string) => void;
}

export function CadastrarEmpresaModal({ open, onClose, onSuccess, onError }: Props) {
  const [cnpj, setCnpj] = useState('');
  const [loading, setLoading] = useState(false);

  function formatInput(value: string) {
    const digits = value.replace(/\D/g, '').slice(0, 14);
    let formatted = digits;
    if (digits.length > 2) formatted = digits.slice(0, 2) + '.' + digits.slice(2);
    if (digits.length > 5) formatted = formatted.slice(0, 6) + '.' + digits.slice(5);
    if (digits.length > 8) formatted = formatted.slice(0, 10) + '/' + digits.slice(8);
    if (digits.length > 12) formatted = formatted.slice(0, 15) + '-' + digits.slice(12);
    return formatted;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const digits = cnpj.replace(/\D/g, '');
    if (digits.length !== 14) {
      onError('CNPJ deve ter 14 dígitos');
      return;
    }

    try {
      setLoading(true);
      const empresa = await api.post<Empresa>('/empresas/cnpj', { cnpj: digits });
      setCnpj('');
      onSuccess(empresa);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Erro ao cadastrar empresa');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Cadastrar Empresa por CNPJ" size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-slate-500">
          Digite o CNPJ e buscaremos automaticamente os dados da empresa na Receita Federal via BrasilAPI.
        </p>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">CNPJ</label>
          <div className="relative">
            <input
              type="text"
              value={cnpj}
              onChange={(e) => setCnpj(formatInput(e.target.value))}
              placeholder="00.000.000/0000-00"
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              disabled={loading}
              autoFocus
            />
            <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {cnpj.replace(/\D/g, '').length}/14 dígitos
          </p>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => { setCnpj(''); onClose(); }}
            className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading || cnpj.replace(/\D/g, '').length !== 14}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Buscando...
              </>
            ) : (
              'Cadastrar'
            )}
          </button>
        </div>

        {loading && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
            Consultando BrasilAPI e calculando matches... Isso pode levar alguns segundos.
          </div>
        )}
      </form>
    </Modal>
  );
}
