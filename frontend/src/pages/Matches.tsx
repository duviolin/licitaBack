import { PageHeader } from '../components/PageHeader';
import { Star } from 'lucide-react';

export function Matches() {
  return (
    <div>
      <PageHeader
        title="Matches"
        description="Visualize recomendações empresa × licitação"
      />
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
        <Star size={48} className="text-slate-300 mx-auto mb-4" />
        <p className="text-slate-500">Módulo Matches — em breve (Etapa F4)</p>
      </div>
    </div>
  );
}
