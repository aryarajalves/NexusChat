# NexusChat (Discord Clone Completo & Escalável) - v1.1.4

Plataforma completa de comunicação e colaboração em tempo real inspirada no Discord, desenvolvida com **FastAPI (Backend)**, **React + Vite (Frontend)**, banco de dados **PostgreSQL**, barramento de eventos **Redis Pub/Sub**, orquestração de áudio e vídeo **LiveKit SFU**, armazenamento de mídias em nuvem **Backblaze B2 / AWS S3** e monitoramento avançado de infraestrutura orquestrados via **Docker**.

---

## ✨ Principais Funcionalidades

### 🎮 1. Ecossistema Discord (Comunicação em Tempo Real)
- **Servidores e Canais:**
  - Criação de servidores com upload de ícone/avatar customizado (PNG, JPG, WEBP e GIF até 10 MB) e prévia interativa nativa;
  - Exclusão segura de servidores pelo proprietário ou superadministrador com modal de confirmação dedicado e remoção em cascata (canais, mensagens, membros e cargos);
  - Canais de Texto (`TEXT`) com mensagens instantâneas e canais de Voz (`VOICE`) com sinalização WebRTC;
  - Canais Públicos e Privados com controle granular de acesso por cargos específicos do servidor e bloqueio automático de acesso não autorizado;
  - Gestão de Cargos e Permissões do Servidor (Dono e Administradores) com cores customizadas e agrupamento de membros (`hoist`).
- **Mensagens e Interações no Chat:**
  - Suporte a envio de texto (até 2.000 caracteres), links, quebras de parágrafo preservadas e anexos de mídia de até 50 MB;
  - Respostas a mensagens específicas (*Reply*) com citação visual e atalho de rolagem;
  - Edição e exclusão de mensagens pelo próprio autor em tempo real;
  - Reações com emojis em mensagens e seletor inteligente de emojis com prevenção de transbordamento de tela e histórico recente;
  - Sistema de menções inteligentes (`@nome`, `@everyone`, `@here`) com menu suspenso de autocompletar e destaque visual;
  - Mensagens fixadas (*Pinned Messages*) com renderização direta de mídias (áudio, vídeo e imagem) e paginação de 20 mensagens por página;
  - Gravação e envio de notas de voz nativas no chat com equalizador de ondas sonoras;
  - Busca global e filtragem de mensagens por texto e por arquivos anexados (`has_attachment`);
  - Rolagem inteligente no feed com ancoragem automática nas mensagens mais recentes na carga inicial e navegação fluida pelo histórico sem saltos.
- **Mensagens Diretas Bilaterais (DMs 1x1):**
  - Conversas privadas entre quaisquer usuários cadastrados com sincronização em tempo real e compartilhamento de mídias;
  - WebSocket unificado de eventos do usuário (`/ws/me`) transmitindo em tempo real novas DMs, edições, remoções e reações;
  - Badges verdes com brilho neon indicando mensagens não lidas em servidores, canais e avatares de contatos;
  - Paginação eficiente de contatos (20 contatos por página) tanto na barra lateral de DMs quanto no modal de nova conversa privada;
  - Suporte completo a avatares e fotos de perfil dos contatos;
- **Voz, Vídeo & Gravação com Webcam PiP:**
  - Canais de voz em grupo com controle de mudo e ensurdecer;
  - Player flutuante Picture-in-Picture (PiP) totalmente arrastável (Drag & Drop) com persistência de coordenadas, limitação na viewport e botão de maximizar com navegação direta inter-servidores para o canal de voz ativo;
  - Efeitos sonoros característicos ao entrar e sair de salas de voz sintetizados nativamente via Web Audio API;
  - Presença em tempo real de múltiplos participantes conectados nos canais de voz com separação estrita de presença;
  - Gravação de áudio e vídeo da transmissão via `MediaRecorder` com opção de exportação em **MP4** ou **WebM** e compressão inteligente sem perda de qualidade;
  - Gravação com webcam sobreposta em *Picture-in-Picture* (PiP) móvel nos 4 cantos da tela ou com livre arrasto;
  - Desfoque de fundo de câmera nativo com segmentação corporal (estilo Google Meet: Desativado, Leve e Intenso);
  - Compartilhamento de tela com controle opcional de captura de áudio do computador;
  - **Controle de Volume Individual por Contato:** Ajuste de volume de 0% a 200% para cada participante da sala no hover/botão direito, com silenciamento local e persistência por usuário;
  - **Chat de Texto Integrado no Canal de Voz:** Painel lateral de mensagens de texto dentro da própria chamada de voz para anotações, links e histórico em tempo real;
  - **Anotações Colaborativas na Tela:** Ferramentas de desenho livre, retângulos, setas e destaques sobrepostos à transmissão ao vivo com modo PiP para visualização de documentos;
  - **Galeria de Gravações com Filtros Inteligentes:** Busca avançada por sala específica, por autor da gravação, filtro exclusivo de administradores e por data específica no Backblaze B2, com paginação e exclusão em lote;
  - **Soundboard e Emojis Customizados:** Reprodução de efeitos sonoros com sintetizador Web Audio e upload de emojis personalizados por servidor;
  - Efeitos sonoros característicos sintetizados via Web Audio API (mensagens, menções, conexão e desconexão de voz);
  - Modal completo de configurações de usuário (perfil, microfone/alto-falante, volume de efeitos e aparência visual).
- **📱 Responsividade Mobile e Gavetas Deslizantes (Mobile Drawer Navigation):**
  - Layout adaptativo para celulares e telas divididas ($\le 768\text{px}$) com chat em tela inteira ($100\text{vw}$);
  - Gavetas deslizantes suaves para lista de servidores/canais (esquerda) e membros (direita) com backdrops translúcidos e fechamento automático ao selecionar conversa;
  - Cache imutável (`Cache-Control: public, max-age=31536000, immutable`) para mídias e eliminação de queries N+1 no banco de dados.

---

### ⚡ 2. Arquitetura de Alta Escala
- **Redis Pub/Sub:** Barramento distribuído para WebSockets conectando múltiplos workers/containers Uvicorn em alta disponibilidade;
- **WebSockets Resilientes:** Sistema com heartbeat periódico (*ping/pong* a cada 25s) e auto-reconexão inteligente para manter canais e DMs conectados sem quedas por inatividade;
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

### 💾 4. Gestão, Backups e Monitoramento Unificado
- **Módulo Unificado "Infraestrutura & Dados":** Painel centralizado com abas de navegação direta para Recursos de Hardware (CPU, RAM, disco e pool DB), Gerenciamento de Logs Docker e Backups Automáticos;
- **Gestão de Usuários & Convites:** Cadastro manual direto pelo Super Admin ou via links de convite com tempo de expiração e página pública de entrada com preview do servidor (`/invite/:code`);
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
