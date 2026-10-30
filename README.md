# NexusChat (Discord Clone Completo & Escalável)

Plataforma completa de comunicação e colaboração em tempo real inspirada no Discord, desenvolvida com **FastAPI (Backend)**, **React + Vite (Frontend)**, banco de dados **PostgreSQL**, barramento de eventos **Redis Pub/Sub**, orquestração de áudio e vídeo **LiveKit SFU**, armazenamento de mídias em nuvem **Backblaze B2 / AWS S3** e monitoramento avançado de infraestrutura orquestrados via **Docker**.

---

## ✨ Principais Funcionalidades

### 🎮 1. Ecossistema Discord (Comunicação em Tempo Real)
- **Servidores e Canais:**
  - Criação de servidores com upload de ícone/avatar customizado (PNG, JPG, WEBP e GIF até 10 MB) e prévia interativa nativa;
  - Canais de Texto (`TEXT`) com mensagens instantâneas e canais de Voz (`VOICE`) com sinalização WebRTC;
  - Canais Públicos e Privados com controle granular de acesso por cargos específicos do servidor e bloqueio automático de acesso não autorizado;
  - Gestão de Cargos e Permissões do Servidor (Dono e Administradores) com cores customizadas e agrupamento de membros (`hoist`).
- **Mensagens e Interações no Chat:**
  - Suporte a envio de texto (até 2.000 caracteres), links e anexos de mídia de até 50 MB;
  - Respostas a mensagens específicas (*Reply*) com citação visual e atalho de rolagem;
  - Edição e exclusão de mensagens pelo próprio autor em tempo real;
  - Reações com emojis em mensagens e seletor completo de emojis organizado em categorias e histórico recente;
  - Sistema de menções inteligentes (`@nome`, `@everyone`, `@here`) com menu suspenso de autocompletar e destaque visual;
  - Mensagens fixadas (*Pinned Messages*) com gaveta lateral e atalhos rápidos;
  - Gravação e envio de notas de voz nativas no chat com equalizador de ondas sonoras;
  - Busca global e filtragem de mensagens por texto e por arquivos anexados (`has_attachment`).
- **Mensagens Diretas Bilaterais (DMs 1x1):**
  - Conversas privadas entre quaisquer usuários cadastrados com sincronização em tempo real e compartilhamento de mídias;
  - Paginação eficiente de contatos (20 contatos por página) tanto na barra lateral de DMs quanto no modal de nova conversa privada;
  - Suporte completo a avatares e fotos de perfil dos contatos;
  - Contadores visuais e badges de mensagens não lidas (*Unreads*) sincronizados via WebSockets em servidores, canais e DMs.
- **Voz, Vídeo & Gravação com Webcam PiP:**
  - Canais de voz em grupo com controle de mudo e ensurdecer;
  - Gravação de áudio e vídeo da transmissão via `MediaRecorder`;
  - Gravação com webcam sobreposta em *Picture-in-Picture* (PiP) móvel via Drag & Drop;
  - Efeitos sonoros característicos sintetizados via Web Audio API (mensagens, menções, conexão e desconexão de voz);
  - Modal completo de configurações de usuário (perfil, microfone/alto-falante, volume de efeitos e aparência visual).

---

### ⚡ 2. Arquitetura de Alta Escala
- **Redis Pub/Sub:** Barramento distribuído para WebSockets conectando múltiplos workers/containers Uvicorn em alta disponibilidade;
- **LiveKit SFU:** Servidor SFU dedicado para áudio, vídeo e compartilhamento de tela de altíssima escala;
- **PgBouncer (Connection Pooling):** Pooler de conexões PostgreSQL para suportar milhares de conexões simultâneas com baixo consumo de memória;
- **Particionamento Declarativo de Mensagens:** Suporte arquitetural a particionamento de tabelas de mensagens por data;
- **Armazenamento Híbrido S3 (Backblaze B2):** Upload de anexos e mídias para bucket Backblaze B2 com cache local sob demanda e geração de URLs pré-assinadas.

---

### 🛡️ 3. Segurança Avançada & Defesa em Profundidade
- **Criptografia de Senhas:** Hashing de alta resistência com **Argon2id** reforçado com chave secreta do servidor (**Pepper HMAC-SHA256**);
- **Rate Limiting Distribuído:** Middleware em Redis (com fallback em memória) que bloqueia ataques de força bruta no Login, Cadastro e Recuperação de Senha (HTTP 429 com `Retry-After`), além de proteção anti-flood no envio de mensagens e uploads;
- **Cabeçalhos de Segurança HTTP:** Injeção automática de `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin` e `Permissions-Policy`;
- **Sanitização de Uploads:** Blacklist de extensões executáveis (`.exe`, `.bat`, `.php`, `.js`), detecção preventiva de Stored XSS em arquivos SVG e cabeçalho `Content-Disposition` defensivo forçando download para documentos.

---

### 💾 4. Gestão, Backups e Monitoramento
- **Gestão de Usuários & Convites:** Cadastro manual direto pelo Super Admin ou via links de convite com tempo de expiração e códigos OTP via e-mail;
- **Backups Automáticos no S3:** Agendamento periódico de dumps compactados do PostgreSQL para o Backblaze B2 com retenção FIFO;
- **Terminal de Logs Docker:** Monitoramento ao vivo dos contêineres Docker da aplicação com filtragem por data, nível de log e timestamps no Horário de Brasília;
- **Métricas de Infraestrutura:** Acompanhamento de CPU, RAM, conexões ativas do pool de banco de dados e alertas automatizados via Webhook.

---

## 📁 Estrutura do Projeto

```text
NexusChat/
├── backend/                  # API em Python com FastAPI
│   ├── app/
│   │   ├── api/v1/endpoints/ # Rotas da aplicação (discord, dms, roles, users, backups, etc.)
│   │   ├── core/             # Rate Limiter, Security Headers, Upload Security, Config e DB
│   │   ├── models/           # Modelos de dados SQLAlchemy (Discord, User, Backup, Infra)
│   │   ├── schemas/          # Schemas Pydantic de validação e DTOs
│   │   ├── services/         # SocketManager, LiveKit, Storage B2, Email e Backups
│   │   └── main.py           # Entrypoint da aplicação FastAPI
│   ├── gateway.py            # Microserviço dedicado de Gateway WebSocket
│   ├── tests/                # Suíte de testes unitários com pytest
│   ├── Dockerfile
│   └── requirements.txt
│
├── frontend/                 # Interface React + Vite (Design System Glassmorphism)
│   ├── src/
│   │   ├── components/discord/ # Componentes do clone do Discord (Chat, Voice, Modais, etc.)
│   │   ├── components/       # Componentes de infraestrutura, logs e gestão
│   │   ├── styles/           # Folhas de estilo CSS modulares (< 500 linhas)
│   │   ├── context/          # Contextos de autenticação, toasts e sons
│   │   └── App.jsx           # Layout mestre e persistência de navegação
│   ├── Dockerfile
│   ├── nginx.conf
│   └── package.json
│
├── docker/                   # Orquestração de contêineres
│   ├── docker-compose-local.yml # db, redis, pgbouncer, livekit, backend, frontend
│   └── livekit.yaml          # Configurações do LiveKit SFU
└── scripts/
    └── audit_security.py     # Auditoria unificada de segurança (pip-audit + npm audit)
```

---

## 🚀 Como Executar com Docker

Para inicializar todo o ecossistema (PostgreSQL, Redis, PgBouncer, LiveKit, Backend e Frontend):

```bash
docker compose -f docker/docker-compose-local.yml up -d --build
```

- **Frontend (NexusChat)**: `http://localhost:3005`
- **Backend API**: `http://localhost:8035`
- **Documentação Interativa (Swagger)**: `http://localhost:8035/docs`
- **LiveKit SFU**: `ws://localhost:7880`
- **PgBouncer (Pool de Conexões)**: `localhost:6432`
- **PostgreSQL**: `localhost:5731`
- **Redis**: `localhost:6379`

---

## 🧪 Suíte de Testes Automatizados

### Backend (Pytest)
```bash
python -m pytest backend/tests
```

### Frontend (Vitest)
```bash
cd frontend
npm test -- --run
```
