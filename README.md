# Projeto Base

Template base e robusto para sistemas modernos com **FastAPI (Backend)**, **React + Vite (Frontend)**, banco de dados **PostgreSQL**, integração de **Backups em Nuvem (Backblaze B2 / S3)** e **Gerenciamento de Logs de Contêineres** orquestrados via **Docker**.

---

## ✨ Principais Funcionalidades

- 🔐 **Autenticação Segura JWT**: Sistema de login completo com perfis (Superadmin, Admin e Usuário), validação e expiração automática de token com logout instantâneo.
- 👥 **Gestão de Usuários e Convites**:
  - **Criação Manual Direta de Contas:** Criação direta de contas pelo Super Admin sem necessidade de link de convite, com checklist visual em tempo real de requisitos de senha forte e proteção contra preenchimento automático indevido do navegador;
  - **Convites Expiráveis:** Criação de convites com link expirável, redefinição de senha e gestão de permissões;
  - Edição de perfis e exclusão em massa com popup de confirmação centralizado e seguro.
- 💾 **Backup Automático & Manual no S3**:
  - Geração de dumps compactados (`.dump.gz`) do PostgreSQL;
  - Suporte a nomes customizados de backup com timestamp no **Horário Oficial de Brasília (UTC-3)**;
  - Renomeação de backups existentes diretamente no S3/B2 e banco de dados;
  - Agendador automático periódico (APScheduler) com política de retenção FIFO configurável;
  - Restauração de banco de dados e download seguro.
- 🖥️ **Gerenciamento Avançado de Logs**:
  - Visualização em tempo real dos logs dos contêineres Docker da aplicação (`backend` e `frontend`) via socket Unix nativo;
  - Timestamps padronizados automaticamente no **Horário de Brasília (America/Sao_Paulo - UTC-3)** para todos os contêineres;
  - **Filtro por Data e Horário:** Seleção de dias específicos e janelas horárias com resgate histórico via `since` e `until` da Docker API;
  - **Classificação Visual e Separação por Tipo:** Filtros rápidos com contadores e badges coloridos (`Todos`, `Info`, `Avisos`, `Erros`, `HTTP 2xx/3xx/4xx/5xx`);
  - Busca e filtro textual dinâmico, seletor de quantidade de linhas (`--tail`), auto-refresh a cada 4s e botão de cópia de logs formatados.
- ⚡ **Infraestrutura & Recursos do Servidor**:
  - **Recursos do Servidor (RAM & CPU):** Monitoramento em tempo real de memória RAM do VPS, processo da API, vCPUs, taxa de utilização de CPU e histórico de picos máximos nas últimas 24h;
  - **Conexões & Banco (PostgreSQL):** Medição de conexões ativas simultâneas, capacidade total do pool SQLAlchemy (base + overflow), conexões ociosas e histórico de picos por hora no Horário Oficial de Brasília (UTC-3);
  - **Central de Notificações e Webhooks:** Configuração personalizada de limiares (sliders de porcentagem para RAM, CPU e Pool de conexões), intervalo anti-spam (cooldown), teste de conectividade de webhook e disparo automático de alertas críticos e de tráfego normalizado.

---

## 📁 Estrutura de Pastas

```text
Projeto Base/
├── backend/                  # API em Python com FastAPI
│   ├── app/
│   │   ├── api/v1/endpoints/ # Rotas (users, backups, logs)
│   │   ├── core/             # Configurações, segurança, database e logger
│   │   ├── models/           # Modelos SQLAlchemy
│   │   ├── schemas/          # Schemas Pydantic
│   │   ├── services/         # Regras de negócio (storage, backups, logs)
│   │   └── main.py           # Entrypoint da aplicação
│   ├── tests/                # Testes unitários com pytest
│   ├── Dockerfile
│   └── requirements.txt
│
├── frontend/                 # Interface React + Vite
│   ├── src/
│   │   ├── components/       # Componentes reutilizáveis
│   │   │   ├── automated-backup/ # Modais e abas de backup
│   │   │   ├── infrastructure/   # Painel de Infraestrutura e Recursos
│   │   │   ├── user-management/  # Gestão de usuários e modal de criação manual
│   │   │   ├── LogManagement.jsx # Terminal de logs dos contêineres
│   │   │   └── Sidebar.jsx       # Menu de navegação lateral (280px, sem quebra de texto)
│   │   ├── styles/           # Folhas de estilo modulares (< 500 linhas)
│   │   ├── context/          # ToastContext e autenticação
│   │   ├── services/         # authInterceptor e utilitários
│   │   └── App.jsx
│   ├── Dockerfile
│   ├── nginx.conf
│   └── package.json
│
└── docker/                   # Orquestração de contêineres
    └── docker-compose-local.yml
```

---

## 🚀 Como Executar com Docker

Para subir todo o ecossistema (PostgreSQL, Backend FastAPI e Frontend Nginx):

```bash
docker compose -f docker/docker-compose-local.yml up -d --build
```

- **Frontend**: `http://localhost:3000`
- **Backend API**: `http://localhost:8030`
- **Documentação Swagger**: `http://localhost:8030/docs`
- **PostgreSQL**: `localhost:5436`

---

## 🧪 Como Rodar os Testes Unitários

### Frontend (Vitest + React Testing Library)
```bash
cd frontend
npm test -- --run
```

### Backend (Pytest)
```bash
docker compose -f docker/docker-compose-local.yml exec backend pytest
# ou localmente:
cd backend
pytest
```
