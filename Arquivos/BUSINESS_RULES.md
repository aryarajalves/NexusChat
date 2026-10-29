# Regras de Negócio do Projeto (BUSINESS_RULES.md)

Este documento centraliza as regras de negócio oficiais do sistema e as decisões arquiteturais do produto.

---

## 🎮 Módulo: Discord Clone (Servidores, Canais e Mensagens)

### Regras Estabelecidas
- **Autenticação:** Toda interação com servidores, canais e mensagens exige usuário autenticado via JWT.
- **Hierarquia:** Todo servidor possui um `owner_id` (criador). Canais pertencem obrigatoriamente a um servidor.
- **Criação de Servidores & Upload de Ícone:**
  - O modal de criação de servidor disponibiliza upload direto de imagens para o ícone (suporta PNG, JPG, WEBP e GIF até 10 MB), sem necessidade de colar links externos.
  - Exibe prévia circular interativa no estilo nativo do Discord: caso nenhuma imagem tenha sido selecionada, renderiza dinamicamente a letra inicial do nome do servidor à medida que o usuário digita, acompanhada de badge para carregar imagem.
  - Disponibiliza botões para selecionar, trocar e remover a imagem pré-visualizada antes de submeter o formulário.
  - O arquivo de imagem é transmitido e associado automaticamente ao servidor criado.
- **Tipos de Canais:** Canais podem ser do tipo `TEXT` (mensagens de texto e anexos) ou `VOICE` (canais de áudio/streaming).
- **Tempo Real:** As mensagens trafegam via WebSocket assíncrono com persistência imediata no PostgreSQL.
- **Limite de Servidores:** Definido no perfil/convite do usuário (pode ser ilimitado ou com teto numérico, ex: 100 servidores).
- **Limites de Mensagem:** Máximo de 2.000 caracteres por mensagem de texto e anexos de mídia de até 50 MB.
- **Retenção de Mensagens:** Histórico de mensagens é persistido de forma permanente no banco de dados.
- **Visibilidade de Canais:** Todos os membros participantes de um servidor têm visibilidade e acesso a todos os canais daquele servidor.
- **Formatação de Horário:** As mensagens no chat exibem a data e o horário no fuso Horário de Brasília (`America/Sao_Paulo`), no padrão `DD/MM/YYYY, HH:mm`.
- **Ações em Mensagens:** No hover da mensagem são disponibilizadas opções de reagir com emoji, responder mensagem específica, encaminhar para outro canal via modal, copiar texto e editar o texto (exclusivo para o autor, marcando `(editado)`).
- **Respostas a Mensagens (Reply):** No hover de qualquer mensagem, o menu de 3 pontinhos ('Mais opções') e o botão direto permitem responder à mensagem específica. O input exibe um banner indicando o autor e prévia do texto original com opção de cancelar. Ao enviar, a mensagem é vinculada via `reply_to_id`, exibindo no feed a indicação visual em curva (spine), autor de referência e atalho que rola e destaca a mensagem original.
- **Mensagens Diretas (DMs Privadas):**
  - Usuários podem iniciar conversas privadas bilaterais (1x1) com qualquer usuário registrado no sistema.
  - O acesso às DMs é feito através do botão inicial no topo da barra de servidores ou diretamente clicando em um membro na lista de membros de um servidor.
  - Cada conversa é única entre os dois participantes (`user1_id` e `user2_id`).
  - As mensagens diretas herdam os mesmos recursos dos canais (tempo real via WebSocket, anexos de até 50 MB, legendas, reações, respostas a mensagens, edição e exclusão pelo autor).
- **Busca de Mensagens (Search Bar):**
  - Disponível no cabeçalho superior de canais de texto e de mensagens diretas (DMs).
  - Permite pesquisar por termos de texto (busca case-insensitive) e filtrar rapidamente mensagens que contenham anexos/arquivos (`has_attachment`).
  - Painel de resultados flutuante exibe a contagem total, snippets com destaque em amarelo (*highlight*) da palavra pesquisada, carimbo de data/hora no Horário de Brasília e botão "Ir para mensagem", rolando o feed e destacando o item original.
- **Mensagens de Áudio (Voice Notes):**
  - Usuários podem gravar áudios diretamente no chat através do botão de microfone posicionado ao lado do campo de texto (disponível tanto em canais de texto quanto em mensagens diretas / DMs).
  - Durante a gravação, a barra de texto transiciona para o modo de gravação, exibindo indicador luminoso vermelho pulsante, cronômetro em tempo real, visualizador de ondas sonoras animado (equalizador), botão de descarte/cancelar e botão de envio imediato.
  - Os áudios são persistidos de forma segura no servidor de arquivos e renderizados automaticamente no histórico com player de áudio nativo integrado ao design system do Discord.
- **Mensagens Fixadas (Pinned Messages):**
  - Usuários podem fixar e desafixar mensagens importantes tanto em canais de texto quanto em mensagens diretas (DMs) através do menu de 3 pontinhos ("Mais opções").
  - Mensagens fixadas exibem um badge visual dourado de alfinete ("Fixada") no cabeçalho ao lado do autor e horário.
  - O cabeçalho do canal/DM conta com um botão de alfinete e contador numérico que abre uma gaveta lateral com a listagem de todas as mensagens fixadas, com atalho "Ir para mensagem" (scroll suave com destaque visual) e botão de desafixar.
  - A ação de fixar/desafixar sincroniza instantaneamente para todos os membros conectados via WebSockets (`message:pin` e `message_pin`).
- **Contador de Mensagens Não Lidas (Unread Badges):**
  - O sistema rastreia o estado da última mensagem lida por usuário em cada canal (`channel_read_states`) e conversa privada (`dm_read_states`).
  - Quando mensagens chegam em canais ou DMs enquanto o usuário está em outro contexto:
    - O canal exibe texto destacado em branco e um badge vermelho (`#f23f43`) com a contagem de mensagens pendentes (limitado a `99+` se exceder 99).
    - O ícone do servidor na barra vertical exibe um badge numérico com a somatória de mensagens não lidas de todos os seus canais, além de um indicador em pílula branca na borda esquerda.
    - A conversa privada na listagem de DMs exibe o badge vermelho com a contagem pendente.
    - O botão de DMs no topo da barra de servidores exibe o total acumulado de mensagens diretas não lidas.
  - Ao clicar e visualizar o canal ou DM, as mensagens são imediatamente marcadas como lidas na interface e confirmadas no backend via endpoint `/ack`, zerando os contadores correspondentes.
  - Atualizações de contadores trafegam em tempo real via evento WebSocket `unread:update`.
- **Seletor Completo de Emojis (Emoji Picker Popover):**
  - O sistema disponibiliza um seletor completo de emojis organizado em categorias (Recentes, Smileys & Emoções, Pessoas & Gestos, Animais & Natureza, Comidas & Bebidas, Atividades & Esportes, Objetos & Símbolos).
  - Inclui barra de pesquisa em tempo real com busca por termos/palavras-chave em português e inglês e navegação rápida por abas de categorias.
  - Exibe no rodapé o preview ampliado do emoji com seu nome descritivo e atalho ao passar o mouse.
  - Salva os emojis selecionados no armazenamento local (`localStorage`) do navegador para acesso imediato na seção de Recentes.
  - Integrado tanto no campo de envio de mensagens (`ChatInputForm`) para inserção no cursor do texto quanto no menu de reações de mensagens (`ChatMessageItem`) para reagir a qualquer mensagem.
- **Menções com @ e Notificação (Mentions & Autocomplete):**
  - Ao digitar `@` no campo de texto de qualquer canal de servidor ou conversa direta (DM), abre um menu suspenso de autocompletar acima da barra de texto.
  - O menu lista atalhos especiais (`@everyone`, `@here`) e os membros do canal/servidor com avatar, nome de exibição e badge de cargo.
  - Suporta navegação completa via teclado (Setas Cima/Baixo para navegar, Enter/Tab para selecionar, Escape para fechar).
  - A seleção insere `@Nome ` na posição exata do cursor no campo de texto.
  - No feed de mensagens, as menções são renderizadas como pílulas (*chips*) destacadas.
  - Mensagens que mencionam o usuário logado (ou `@everyone` / `@here`) recebem destaque visual com fundo âmbar/dourado translúcido (`rgba(250, 166, 26, 0.1)`) e borda lateral esquerda dourada (`#faa61a`).
- **Efeitos Sonoros do Discord (Sound Effects / Web Audio):**
  - O sistema conta com gerador de efeitos sonoros nativos sintetizados via Web Audio API (sem dependência de arquivos de áudio externos).
  - Inclui os sons característicos do Discord:
    - Mensagem recebida em canal ou DM (dois tons suaves harmônicos).
    - Menção direta (@Você ou @everyone / @here) (arpeggio brilhante em sino).
    - Conexão em canal de voz (três notas ascendentes de entrada).
    - Desconexão de canal de voz (duas notas descendentes de saída).
    - Mudo / Desmudo de áudio (cliques sutis de alternância).
  - Permite silenciar todos os efeitos sonoros através do botão de fones de ouvido no rodapé do usuário, persistindo a preferência no `localStorage`.
- **Configurações do Servidor & Gestão de Cargos (Roles & Permissions):**
  - O cabeçalho do servidor na barra lateral conta com um menu dropdown (seta para baixo) com atalhos de gerenciamento.
  - Apenas o Dono (`owner_id`) e Administradores do servidor têm acesso ao painel de **Configurações do Servidor**.
  - O painel de configurações permite:
    - **Visão Geral:** Atualizar o nome do servidor, descrição e fazer upload de imagem para o **Ícone** e para o **Banner** do servidor.
    - **Cargos (Roles):** Criar, editar e excluir cargos personalizados, definindo nome, cor (paleta oficial do Discord ou seletor customizado), agrupamento na lista de membros (`hoist`) e privilégio de administrador (`is_admin`).
    - **Atribuição de Cargos:** Visualizar todos os membros participantes do servidor e atribuir ou revogar cargos livremente.
  - A cor do cargo colore o nome do membro de forma consistente na lista lateral de membros e nas mensagens do chat.
- **Modal Completo de Configurações do Usuário (User Settings Modal):**
  - Acesso através do botão de engrenagem no rodapé do usuário na barra lateral de canais ou de DMs, com suporte a tecla ESC para fechar.
  - Interface em tela cheia no estilo característico do Discord com navegação por abas laterais (Minha Conta, Voz & Efeitos Sonoros, Aparência).
  - **Minha Conta / Perfil:** Exibição de card de perfil, upload e prévia de avatar personalizado (suporta até 10 MB), atualização de nome de exibição e troca de senha com checklist visual de validação em tempo real (mínimo de 12 caracteres, letras maiúsculas, minúsculas, números e caracteres especiais).
  - **Voz & Efeitos Sonoros:** Seleção de microfone e alto-falante via MediaDevices API, controle de volume dos sintetizadores sonoros, opção de silenciar e botões de teste interativos para audição prévia dos 4 sintetizadores Web Audio.
  - **Aparência:** Seleção de densidade do chat (Confortável com avatares destacados vs. Compacto em linha única), ajuste do tamanho de fonte (Pequena 14px, Padrão 16px, Grande 18px) com prévia interativa ao vivo e persistência local no `localStorage`.
- **Persistência de Navegação e Estado da Sessão (Page Reload / F5):**
  - Ao recarregar a página no navegador (`F5`), o sistema restaura automaticamente a última aba, servidor, canal ou conversa privada (DM) em que o usuário estava navegando.
  - Chaves persistidas de forma reativa no `localStorage`:
    - `active_tab`: aba principal da aplicação (`discord`, `users`, `backup`, `logs`, `infrastructure`).
    - `discord_active_server_id`: servidor ativo selecionado ou `'dms'` para a tela de mensagens diretas bilaterais.
    - `discord_active_channel_id` e `discord_active_channel_<serverId>`: canal de texto ou voz ativo por servidor.
    - `discord_active_dm_id`: conversa privada de DM selecionada.
  - Validação de integridade automática: caso o servidor, canal ou DM salvo não exista mais (ou o usuário não tenha mais acesso), o sistema realiza fallback seguro para o primeiro item disponível.
  - Ao confirmar logout, todas as chaves de navegação são limpas para garantir isolamento e segurança entre diferentes contas.
- **Gravação e Exportação de Canais de Voz (Voice & Video Recording):**
  - Usuários conectados a um canal de voz contam com a opção de gravar a conversa e atividades da sala diretamente no dock inferior de controles.
  - Modos disponíveis:
    - **Gravar Apenas Áudio:** Captura a fala e o áudio da conversa do canal via `MediaRecorder` em formato WebM Audio (codec Opus).
    - **Gravar Vídeo com Áudio:** Captura a tela/transmissão ao vivo combinada com o áudio do canal em formato WebM Video.
    - **Gravação de Tela com Webcam PiP Móvel (Picture-in-Picture):** Quando a câmera de vídeo estiver ligada, a gravação de tela permite incluir a webcam do usuário como overlay visual sobreposto. O usuário pode posicionar o quadro da webcam nos 4 cantos da tela (Inferior Direito, Inferior Esquerdo, Superior Direito, Superior Esquerdo) ou arrastar livremente com o mouse (Drag & Drop) durante a transmissão. A posição em tempo real é refletida tanto na pré-visualização em tela quanto na composição gravada no arquivo final exportado.
  - Durante a gravação, o dock exibe um indicador luminoso pulsante em vermelho (`● REC`), o modo ativo e um cronômetro em tempo real com botão de parada imediata.
  - Ao finalizar a gravação, abre-se automaticamente um modal com prévia (player de vídeo ou áudio), duração e tamanho do arquivo, com botão de **Exportar / Baixar** que salva o arquivo com data e hora diretamente no computador do usuário.



---

## 📋 Perguntas Registradas e Respostas Oficiais

- [x] Qual será o limite máximo de servidores que um usuário pode criar ou participar? (Ex: Ilimitado ou limite por usuário?)
  - **Resposta:** É configurável na hora de criar o convite/usuário se terá acesso a servidores ilimitados ou com um teto específico (ex: 100 servidores). O padrão padrão inicial é teto de 100 ou ilimitado conforme definido no registro.
- [x] Qual será o tamanho máximo de texto por mensagem e o limite de upload de anexos/imagens no chat? (Ex: 2.000 caracteres como no Discord e 10MB por arquivo?)
  - **Resposta:** Limite rígido de 2.000 caracteres por mensagem e upload de mídia de até 50 MB.
- [x] O histórico de mensagens de canais de texto deve ser armazenado indefinidamente ou deve possuir expurgo/retenção automática?
  - **Resposta:** O armazenamento é permanente.
- [x] Na Fase 1, todo canal criado dentro de um servidor será visível para todos os membros ou já precisaremos de canais privados por permissão/cargo?
  - **Resposta:** Por enquanto todos os membros enxergam todos os canais do servidor.
- [x] O sistema deve implementar subsistema de API Keys, Bots externos e Webhooks neste momento?
  - **Resposta:** Não. O sistema ainda não possui bots nem webhooks e essa funcionalidade não é desejada no momento. Toda a autenticação permanece centralizada via sessão JWT para os usuários da aplicação.
