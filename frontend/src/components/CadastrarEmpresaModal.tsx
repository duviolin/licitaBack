import { useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { Modal } from './Modal';
import { FieldHelp } from './FieldHelp';
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
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700 space-y-1">
          <p className="font-medium">Como funciona?</p>
          <p>
            Ao digitar o CNPJ, o sistema consulta a <strong>Receita Federal</strong> (via BrasilAPI) e preenche
            automaticamente: razão social, nome fantasia, CNAE, endereço e situação cadastral.
            Após o cadastro, o sistema já calcula os primeiros matches com as licitações importadas.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">CNPJ da empresa</label>
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
          <FieldHelp text={`Digite apenas os 14 números ou no formato XX.XXX.XXX/XXXX-XX. A formatação é automática. (${cnpj.replace(/\D/g, '').length}/14 dígitos)`} />
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
                Buscando na Receita...
              </>
            ) : (
              'Cadastrar'
            )}
          </button>
        </div>

        {loading && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
            Consultando dados da empresa e calculando relevância com licitações existentes... Pode levar até 15 segundos.
          </div>
        )}
      </form>
    </Modal>
  );
}
