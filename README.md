# Licitações MVP — Recomendação, Gestão e Participação em Licitações Públicas

Sistema completo (backend + frontend) para recomendar licitações públicas a empresas brasileiras com base em score de aderência NLP, analisar editais automaticamente e preparar participação em certames.

---

## Status Atual — O que funciona e o que não funciona

### Funcional (pode usar agora)

| Funcionalidade | Descrição |
|---|---|
| **Cadastro de empresa por CNPJ** | Consulta BrasilAPI, extrai CNAEs, gera stems NLP automaticamente |
| **Configuração de preferências** | Palavras-chave, UFs, modalidades, faixa de valor — impactam o score |
| **Importação de licitações do PNCP** | Busca por período/UF/modalidade, calcula score antes de salvar (score-first) |
| **Score de aderência NLP** | 60% textual (Jaccard stems) + 25% geográfico + 15% valor |
| **Matches empresa×licitação** | Ranking, favoritar, descartar, filtrar por score |
| **Documentos da empresa** | Cadastrar CNDs, FGTS, Contrato Social, Atestados, etc. com validade |
| **Participação com análise automática** | Ao registrar, o sistema baixa o edital, extrai requisitos, verifica docs e calcula conformidade |
| **Verificação de conformidade** | Compara docs da empresa × exigências do edital, indica faltantes/vencidos |
| **Reprocessamento** | Após cadastrar novos docs, reavalia conformidade automaticamente |

### NÃO funcional (ainda não existe)

| Item | Status |
|---|---|
| **Autenticação / Login** | Não existe. O sistema é aberto, sem controle de acesso |
| **Login em portais (BLL/BNC/ComprasNet)** | Não há integração real com portais de compras |
| **Envio automático de proposta** | Não implementado |
| **Upload de arquivos de documentos** | Não existe. O campo `arquivoUrl` é preenchido manualmente |
| **OCR para editais escaneados** | O parser só funciona com PDFs que possuem texto extraível |
| **Multi-tenant / Multi-usuário** | Não existe separação de dados por usuário |

---

## Fluxo de Uso Completo

```
1. Cadastrar empresa por CNPJ
   └→ Configurar preferências (palavras-chave, UFs, modalidades, valor)

2. Cadastrar documentos da empresa
   └→ CNDs, FGTS, Contrato Social, Atestados, etc.

3. Importar licitações do PNCP
   └→ Sistema calcula score e mostra matches relevantes

4. Decidir participar (clica "Participar")
   └→ Sistema AUTOMATICAMENTE:
      a) Cria participação
      b) Baixa o PDF do edital
      c) Extrai texto e identifica requisitos de habilitação
      d) Extrai prazos (abertura, impugnação, sessão)
      e) Verifica conformidade documental
      f) Atualiza status: PENDENTE_DOC ou APTA

5. Corrigir pendências (se houver)
   └→ Cadastrar docs faltantes → Reavaliar → Status atualiza

6. Acompanhar
   └→ Atualizar status manualmente: ENVIADA → EM_DISPUTA → GANHA / PERDIDA
```

**Uma entidade, um fluxo, uma tela.**

---

## Stack

| Tecnologia | Uso |
|---|---|
| Node.js 20+ / TypeScript | Runtime + linguagem (ESM strict) |
| Express 5 | HTTP server |
| PostgreSQL (Neon) | Banco de dados |
| Prisma 7 + adapter-pg | ORM com driver adapter |
| @nlpjs/lang-pt | Tokenização, stemming e stopwords PT-BR |
| pdf-parse | Extração de texto de PDFs de editais |
| BrasilAPI | Consulta CNPJ (gratuita, sem auth) |
| PNCP | Portal Nacional de Contratações Públicas |
| React 19 + Vite 7 | Frontend SPA |
| Tailwind CSS 4 | Estilização |
| Lucide React | Ícones |
| React Router 7 | Navegação |

---

## Setup

```bash
# 1. Instalar dependências (backend + frontend)
npm install
cd frontend && npm install && cd ..

# 2. Configurar variáveis de ambiente
cp .env.example .env.development
# Editar .env.development com sua DATABASE_URL

# 3. Iniciar backend (porta 3000)
npm run dev

# 4. Iniciar frontend (porta 5173 com proxy para API)
npm run dev:front
```

### Produção
```bash
npm run build:all   # Compila backend + frontend
npm run start       # Express serve API + frontend estático
```

---

## Frontend — 5 Páginas

| Página | Rota | Funcionalidades |
|---|---|---|
| **Dashboard** | `/` | Cards de resumo, top matches, participações recentes |
| **Empresas** | `/empresas` | Lista, cadastro por CNPJ |
| **Empresa Detalhe** | `/empresas/:id` | Dados, CNAEs, NLP, preferências, **documentos (CRUD)**, matches |
| **Matches** | `/matches` | Empresa×licitação, score breakdown, favoritar/descartar |
| **Participações** | `/participacoes` | Lista com stats, filtros por empresa/status, criar participação |
| **Participação Detalhe** | `/participacoes/:id` | Status, prazos, conformidade documental, docs exigidos, editar, reprocessar |

---

## Endpoints — Referência

### Health Check
| Método | Endpoint | Descrição |
|---|---|---|
| GET | `/health` | Status da API |

### Empresas — `/empresas`
| Método | Endpoint | Descrição |
|---|---|---|
| POST | `/empresas/cnpj` | Cadastra via BrasilAPI. Gera stems NLP. |
| PATCH | `/empresas/:id/preferencias` | Atualiza preferências. Recalcula matches. |
| GET | `/empresas` | Lista todas. |
| GET | `/empresas/:id` | Detalhe completo. |
| GET | `/empresas/:id/matches` | Matches por score. |
| GET | `/empresas/:id/documentos` | Lista documentos da empresa. |
| POST | `/empresas/:id/documentos` | Cadastra documento (tipo, nome, validade, emissor). |
| PATCH | `/empresas/:id/documentos/:docId` | Atualiza documento. |
| DELETE | `/empresas/:id/documentos/:docId` | Remove documento. |

### Licitações — `/licitacoes`
| Método | Endpoint | Descrição |
|---|---|---|
| POST | `/licitacoes/importar` | Importação score-first do PNCP. |
| GET | `/licitacoes` | Filtros: `uf`, `modalidade`, `esfera`, `situacao`, etc. |
| GET | `/licitacoes/:id` | Detalhe com matches por empresa. |

### Participações — `/participacoes` (fluxo unificado)
| Método | Endpoint | Descrição |
|---|---|---|
| POST | `/participacoes` | **Cria participação + análise automática do edital.** Body: `empresaId`, `licitacaoId`, `editalUrl?`, `valorProposta?`, `observacoes?`. |
| GET | `/participacoes` | Lista com filtros: `empresaId`, `status`. |
| GET | `/participacoes/:id` | Detalhe completo com documentosExigidos, conformidades, prazos. |
| PATCH | `/participacoes/:id` | Atualiza status/valor/observações. |
| DELETE | `/participacoes/:id` | Remove (cascade: docs exigidos, conformidade, prazos). |
| POST | `/participacoes/:id/reprocessar` | Reavalia conformidade documental (após cadastrar novos docs). |

### Status da Participação (ciclo de vida)
```
ANALISANDO → PENDENTE_DOC → APTA → ENVIADA → EM_DISPUTA → GANHA
                                                         → PERDIDA
```

| Status | Significado | Quem define |
|---|---|---|
| `ANALISANDO` | Baixando edital e processando | Automático |
| `PENDENTE_DOC` | Faltam documentos de habilitação | Automático |
| `APTA` | Todos os documentos obrigatórios OK | Automático |
| `ENVIADA` | Proposta submetida ao portal | Manual |
| `EM_DISPUTA` | Participando do certame | Manual |
| `GANHA` | Licitação vencida | Manual |
| `PERDIDA` | Não venceu | Manual |

---

## Score Composto

```
scoreTotal = scoreTextual × 0.60 + scoreGeográfico × 0.25 + scoreValor × 0.15
```

| Componente | Peso | Lógica |
|---|---|---|
| **Textual** | 60% | Jaccard entre stems empresa (CNAEs + keywords) e stems objeto da licitação |
| **Geográfico** | 25% | 1.0 (UF match) / 0.3 (sem preferência) / 0.0 (fora das UFs) |
| **Valor** | 15% | 1.0 (na faixa) / decaimento proporcional / 0.5 (desconhecido) |

---

## Estrutura do Projeto

```
licitaBack/
├── prisma/
│   └── schema.prisma                    # 8 models + 5 enums
├── src/
│   ├── config/                          # load-env.ts + env.ts
│   ├── lib/                             # prisma.ts (singleton)
│   ├── clients/
│   │   ├── brasilApiClient.ts           # Consulta CNPJ
│   │   └── pncpClient.ts               # PNCP com paginação + retry
│   ├── utils/
│   │   ├── text.ts                      # NLP pipeline PT-BR
│   │   └── score.ts                     # Score composto
│   ├── repositories/                    # CRUD (empresa, licitacao, match, participacao)
│   ├── services/                        # Lógica (empresa, licitacao, participacao, empresaDocumento)
│   ├── controllers/                     # Validação HTTP
│   ├── routes/                          # empresa, licitacao, participacao
│   ├── middleware/                       # Error handler
│   ├── modules/
│   │   └── licitacaoExec/               # Utilitários de análise de edital
│   │       ├── types/                   # Interfaces
│   │       ├── utils/                   # Regex para parsing de editais brasileiros
│   │       ├── repositories/            # docs exigidos, conformidade, prazos
│   │       └── services/                # parser, requisitos, prazos, conformidade, checklist
│   ├── app.ts                           # Express app
│   └── server.ts                        # Entry point
├── frontend/
│   ├── src/
│   │   ├── components/                  # Modal, Toast, TagInput, PageHeader, etc.
│   │   ├── pages/                       # 6 páginas (Dashboard, Empresas, Matches, Participações...)
│   │   ├── hooks/                       # useToast
│   │   ├── lib/                         # api.ts, constants.ts
│   │   └── types.ts                     # Tipos alinhados com Prisma schema
│   └── vite.config.ts                   # Proxy /api → localhost:3000
└── README.md
```

---

## Variáveis de Ambiente

| Variável | Obrigatória | Descrição |
|---|---|---|
| `DATABASE_URL` | Sim | PostgreSQL connection string |
| `PORT` | Não (3000) | Porta do servidor |
| `NODE_ENV` | Não (development) | Ambiente |
| `PNCP_BASE_URL` | Não | URL base PNCP |
| `BRASILAPI_BASE_URL` | Não | URL base BrasilAPI |

---

## Roadmap

```
Concluído
├── ✅  Fundação (setup, schema, NLP, score)
├── ✅  Módulo Empresas (BrasilAPI, CRUD, matches)
├── ✅  Módulo Licitações (PNCP, importação score-first)
├── ✅  Documentos da Empresa (CRUD, tipos, validade)
├── ✅  Participação unificada (análise automática de edital + conformidade)
├── ✅  Frontend completo (Dashboard, Empresas, Matches, Participações com detalhe)
└── ✅  Fluxo unificado: Participar → Análise → Conformidade → Acompanhar

Próximos passos
├── ⬜ Autenticação (login, multi-usuário)
├── ⬜ Upload de arquivos de documentos (S3/MinIO)
├── ⬜ Integração real com portais (BLL, BNC, ComprasNet via RPA)
├── ⬜ OCR para editais escaneados
├── ⬜ Melhoria na extração de prazos (NLP contextual)
├── ⬜ Notificações (prazos vencendo, docs expirando)
└── ⬜ Dashboard de métricas (taxa de ganho, funil)
```
