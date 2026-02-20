import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  FileText,
  Handshake,
  Star,
} from 'lucide-react';

const links = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/empresas', label: 'Empresas', icon: Building2 },
  { to: '/licitacoes', label: 'Licitações', icon: FileText },
  { to: '/matches', label: 'Matches', icon: Star },
  { to: '/participacoes', label: 'Participações', icon: Handshake },
];

export function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 h-screen w-60 bg-slate-900 text-white flex flex-col">
      <div className="px-5 py-6 border-b border-slate-700">
        <h1 className="text-lg font-bold tracking-tight">Licitações MVP</h1>
        <p className="text-xs text-slate-400 mt-0.5">Painel de Gestão</p>
      </div>

      <nav className="flex-1 py-4 px-3 space-y-1">
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="px-5 py-4 border-t border-slate-700 text-xs text-slate-500">
        v1.0.0
      </div>
    </aside>
  );
}
