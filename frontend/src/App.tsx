import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Empresas } from './pages/Empresas';
import { EmpresaDetalhe } from './pages/EmpresaDetalhe';
import { Licitacoes } from './pages/Licitacoes';
import { Matches } from './pages/Matches';
import { Participacoes } from './pages/Participacoes';
import { ParticipacaoDetalhe } from './pages/ParticipacaoDetalhe';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/empresas" element={<Empresas />} />
          <Route path="/empresas/:id" element={<EmpresaDetalhe />} />
          <Route path="/licitacoes" element={<Licitacoes />} />
          <Route path="/matches" element={<Matches />} />
          <Route path="/participacoes" element={<Participacoes />} />
          <Route path="/participacoes/:id" element={<ParticipacaoDetalhe />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
