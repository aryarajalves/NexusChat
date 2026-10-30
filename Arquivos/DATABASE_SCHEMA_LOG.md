# Log de Integridade e Histórico de Esquema do Banco de Dados

Registro de migrações e atualizações estruturais do banco de dados (PostgreSQL/SQLite) do **Projeto Base**.

---

### [24/09/2026] - Criação Inicial do Esquema de Usuários e Autenticação
- **Tabelas Criadas:**
  - `users`: Armazena os usuários do sistema com criptografia Argon2id + Pepper.
  - `invites`: Gerenciamento de convites com tempo de expiração e role.
  - `password_reset_tokens`: Tokens seguros para redefinição de senha com validade de 24h.
  - `registration_verifications`: Verificação OTP de 6 dígitos via Brevo API para validação de e-mail.

---

### [24/09/2026] - Sistema de Backup Automático e Histórico (Backblaze B2 / S3)
- **Tabelas Criadas:**
  - `backup_schedules`: Armazena a rotina de agendamento automático de backups (`is_active`, `frequency`, `destination_folder`, `retention_max`, `last_run_at`, `next_run_at`, `updated_at`).
  - `backup_histories`: Histórico de dumps gerados, baixados, restaurados e importados (`filename`, `s3_key`, `file_size_bytes`, `backup_type`, `status`, `error_message`, `created_at`).
- **Script de Migração:** `backend/scripts/migrate_backup_tables.py`

---

### [27/10/2026] - Sistema de Monitoramento de Infraestrutura e Recursos do Servidor
- **Tabelas Criadas:**
  - `system_alert_configs`: Configurações de limites (RAM, CPU, Pool de Conexões), cooldown e webhook de alerta.
  - `system_peak_metrics`: Registro histórico de maiores picos de hardware e conexões nas últimas 24h.
  - `system_connection_histories`: Histórico horário de conexões ativas e ocupação do pool PostgreSQL.
- **Script de Migração:** `backend/scripts/migrate_infrastructure_tables.py`

---

### [28/10/2026] - Módulo Discord Clone (Servidores, Canais, Membros, Mensagens e Convites)
- **Tabelas Criadas:**
  - `servers`: Armazena servidores criados (`id`, `name`, `icon_url`, `description`, `owner_id`, `created_at`).
  - `channels`: Canais de texto e voz vinculados a um servidor (`id`, `server_id`, `name`, `type`, `category`, `position`, `created_at`).
  - `server_members`: Associação de usuários a servidores com cargos (`id`, `server_id`, `user_id`, `nickname`, `role`, `joined_at`).
  - `messages`: Mensagens enviadas em canais com suporte a anexos e reply (`id`, `channel_id`, `author_id`, `content`, `attachment_url`, `attachment_type`, `attachment_size`, `reply_to_id`, `is_edited`, `created_at`, `updated_at`).
  - `server_invites`: Códigos de convite com contadores de uso e expiração (`id`, `server_id`, `code`, `created_by_id`, `max_uses`, `current_uses`, `expires_at`, `created_at`).
- **Colunas Adicionadas:**
  - `users.max_servers`: Teto máximo de servidores que o usuário pode participar/criar (-1 para ilimitado, padrão 100).
  - `invites.max_servers`: Configuração de cota de servidores atribuída ao usuário registrado pelo convite.
- **Script de Migração:** `backend/scripts/migrate_discord_schema.py`

---

### [28/10/2026] - Reações de Emojis em Mensagens do Discord
- **Tabelas Criadas:**
  - `message_reactions`: Armazena as reações com emojis atribuídas por usuários a mensagens específicas (`id`, `message_id`, `user_id`, `emoji`, `created_at`). Cascading delete configurado na mensagem.
- **Script de Migração:** `backend/scripts/migrate_discord_reactions_schema.py`

---

### [28/10/2026] - Sistema de Mensagens Diretas (DMs Privadas)
- **Tabelas Criadas:**
  - `dm_conversations`: Armazena a conversa privada entre dois usuários (`id`, `user1_id`, `user2_id`, `created_at`, `updated_at`) com índice único por par de usuários (`uq_dm_conversation_users`).
  - `dm_messages`: Histórico de mensagens enviadas na conversa direta (`id`, `conversation_id`, `author_id`, `content`, `attachment_url`, `attachment_type`, `attachment_size`, `reply_to_id`, `is_edited`, `created_at`, `updated_at`).
  - `dm_message_reactions`: Reações com emojis adicionadas em mensagens da DM (`id`, `message_id`, `user_id`, `emoji`, `created_at`).
- **Script de Migração:** `backend/scripts/migrate_discord_dms_schema.py`

---

### [28/10/2026] - Sistema de Mensagens Fixadas (Pinned Messages)
- **Colunas Adicionadas:**
  - `messages.is_pinned`: Campo booleano (`BOOLEAN NOT NULL DEFAULT FALSE`) indicando se a mensagem está fixada no canal.
  - `dm_messages.is_pinned`: Campo booleano (`BOOLEAN NOT NULL DEFAULT FALSE`) indicando se a mensagem direta está fixada na conversa privada.
- **Script de Migração:** `backend/scripts/migrate_discord_pins_schema.py`

---

### [28/10/2026] - Sistema de Mensagens Não Lidas (Unread Badges)
- **Tabelas Criadas:**
  - `channel_read_states`: Armazena o ID da última mensagem lida por usuário em cada canal (`id`, `user_id`, `channel_id`, `last_read_message_id`, `updated_at`). Constraint única por `(user_id, channel_id)`.
  - `dm_read_states`: Armazena o ID da última mensagem lida por usuário em cada conversa privada (`id`, `user_id`, `conversation_id`, `last_read_message_id`, `updated_at`). Constraint única por `(user_id, conversation_id)`.
- **Script de Migração:** `backend/scripts/migrate_discord_unreads_schema.py`

---

### [29/10/2026] - Sistema de Configurações do Servidor e Gestão de Cargos (Roles & Permissions)
- **Tabelas Criadas:**
  - `server_roles`: Armazena os cargos personalizados de cada servidor (`id`, `server_id`, `name`, `color`, `position`, `is_admin`, `hoist`, `created_at`). Cascata ao deletar servidor.
- **Colunas Adicionadas:**
  - `servers.banner_url`: URL ou caminho da imagem do banner do servidor (`VARCHAR(500)`).
  - `server_members.role_id`: Chave estrangeira para `server_roles.id` com `ON DELETE SET NULL`, indicando o cargo atribuído ao membro.
- **Script de Migração:** `backend/scripts/migrate_discord_roles_schema.py`

---

### [29/10/2026] - Sistema de Perfil do Usuário e Avatar (User Settings)
- **Colunas Adicionadas:**
  - `users.avatar_url`: URL ou caminho da imagem do avatar personalizado do usuário (`VARCHAR(500)`).
- **Script de Migração:** `backend/scripts/migrate_user_avatar_schema.py`

---

### [29/10/2026] - Otimização de Escalabilidade: Índices Compostos de Alta Concorrência
- **Índices Criados:**
  - `idx_messages_channel_id_id`: Índice composto na tabela `messages` nas colunas `(channel_id, id DESC)` para acelerar paginação por cursor e consultas de histórico.
  - `idx_dm_messages_conversation_id_id`: Índice composto na tabela `dm_messages` nas colunas `(conversation_id, id DESC)` para acelerar a busca de mensagens diretas.
- **Script de Migração:** `backend/scripts/migrate_discord_composite_indexes.py`

---

### [30/10/2026] - Sistema de Canais Privados e Restrições por Cargo (Role-Based Channel Permissions)
- **Colunas Adicionadas:**
  - `channels.is_private`: Campo booleano (`BOOLEAN NOT NULL DEFAULT FALSE`) indicando se o canal é restrito a cargos específicos.
- **Tabelas Criadas:**
  - `channel_role_permissions`: Tabela de associação de permissões (`id`, `channel_id`, `role_id`, `created_at`) com chave única `uq_channel_role` e chaves estrangeiras com `ON DELETE CASCADE`.
- **Índices Criados:**
  - `idx_channel_role_channel_id`: Índice para busca rápida de cargos permitidos por canal.
  - `idx_channel_role_role_id`: Índice para consulta reversa de canais acessíveis por cargo.
- **Script de Migração:** `backend/scripts/migrate_private_channels.py`


---

### [29/10/2026] - Fase 3 (Discord-Scale): Particionamento Declarativo de Mensagens
- **Tabelas e Partições Criadas:**
  - `messages_partitioned`: Tabela com particionamento nativo por `RANGE (created_at)` no PostgreSQL.
  - Partições mensais automáticas (`messages_y2026m10`, `messages_y2026m11`, `messages_y2026m12`, `messages_default`).
  - Índice composto local `idx_part_messages_channel_id_id` em cada partição individual.
- **Script de Migração:** `backend/scripts/migrate_messages_partitioning.py`






