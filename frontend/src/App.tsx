import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Empresas } from './pages/Empresas';
import { EmpresaDetalhe } from './pages/EmpresaDetalhe';
import { Matches } from './pages/Matches';
import { Participacoes } from './pages/Participacoes';
import { LicitacaoExec } from './pages/LicitacaoExec';
import { LicitacaoExecDetalhe } from './pages/LicitacaoExecDetalhe';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/empresas" element={<Empresas />} />
          <Route path="/empresas/:id" element={<EmpresaDetalhe />} />
          <Route path="/matches" element={<Matches />} />
          <Route path="/participacoes" element={<Participacoes />} />
          <Route path="/licitacao-exec" element={<LicitacaoExec />} />
          <Route path="/licitacao-exec/:id" element={<LicitacaoExecDetalhe />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
