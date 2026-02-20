import { PageHeader } from '../components/PageHeader';
import { Handshake } from 'lucide-react';

export function Participacoes() {
  return (
    <div>
      <PageHeader
        title="Participações"
        description="Acompanhe e gerencie participações em licitações"
      />
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
        <Handshake size={48} className="text-slate-300 mx-auto mb-4" />
        <p className="text-slate-500">Módulo Participações — em breve (Etapa F4)</p>
      </div>
    </div>
  );
}
