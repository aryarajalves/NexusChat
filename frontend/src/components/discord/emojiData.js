// emojiData.js - Dicionário e Utilitários de Emojis categorizados para o Discord Clone

export const EMOJI_CATEGORIES = [
  { id: 'recent', name: 'Recentes', icon: '🕒' },
  { id: 'smileys', name: 'Smileys & Emoções', icon: '😀' },
  { id: 'people', name: 'Pessoas & Gestos', icon: '👍' },
  { id: 'nature', name: 'Animais & Natureza', icon: '🐶' },
  { id: 'food', name: 'Comidas & Bebidas', icon: '🍔' },
  { id: 'activity', name: 'Atividades & Esportes', icon: '⚽' },
  { id: 'objects', name: 'Objetos & Símbolos', icon: '💡' },
];

export const EMOJI_LIST = [
  // Smileys & Emoções
  { emoji: '😀', name: 'Sorriso Aberto', category: 'smileys', keywords: ['sorriso', 'feliz', 'smile', 'alegria', 'grinning'] },
  { emoji: '😃', name: 'Rosto Sorridente', category: 'smileys', keywords: ['sorrindo', 'olhos grandes', 'happy'] },
  { emoji: '😄', name: 'Rosto Sorridente Olhos Fechados', category: 'smileys', keywords: ['feliz', 'animado', 'alegre'] },
  { emoji: '😁', name: 'Sorriso Radiante', category: 'smileys', keywords: ['dentes', 'radiante', 'grin'] },
  { emoji: '😆', name: 'Gargalhada', category: 'smileys', keywords: ['gargalhada', 'risada', 'rir', 'laugh'] },
  { emoji: '😅', name: 'Sorriso com Suor', category: 'smileys', keywords: ['suor', 'alivio', 'nervoso', 'sweat'] },
  { emoji: '😂', name: 'Chorando de Rir', category: 'smileys', keywords: ['rir', 'choro', 'lagrimas', 'rofl', 'lol', 'joy'] },
  { emoji: '🤣', name: 'Rolando de Rir', category: 'smileys', keywords: ['rolando', 'gargalhando', 'haha'] },
  { emoji: '😊', name: 'Sorridente Agradável', category: 'smileys', keywords: ['timido', 'fofo', 'meigo', 'blush'] },
  { emoji: '😇', name: 'Anjinho', category: 'smileys', keywords: ['anjo', 'inocente', 'aureola', 'angel'] },
  { emoji: '🙂', name: 'Sorriso Leve', category: 'smileys', keywords: ['leve', 'calmo', 'ok'] },
  { emoji: '😉', name: 'Piscadinha', category: 'smileys', keywords: ['piscar', 'cumplice', 'wink'] },
  { emoji: '😌', name: 'Aliviado', category: 'smileys', keywords: ['paz', 'tranquilo', 'zen'] },
  { emoji: '😍', name: 'Olhos de Coração', category: 'smileys', keywords: ['amor', 'apaixonado', 'love', 'heart'] },
  { emoji: '🥰', name: 'Rosto Apaixonado com Corações', category: 'smileys', keywords: ['amor', 'carinho', 'adore'] },
  { emoji: '😘', name: 'Mandando Beijo', category: 'smileys', keywords: ['beijo', 'amor', 'kiss'] },
  { emoji: '😋', name: 'Delicioso', category: 'smileys', keywords: ['gostoso', 'lingua', 'comida', 'yum'] },
  { emoji: '😛', name: 'Mostrando a Língua', category: 'smileys', keywords: ['brincadeira', 'zoeira'] },
  { emoji: '😜', name: 'Língua Piscando', category: 'smileys', keywords: ['brincalhao', 'louco', 'crazy'] },
  { emoji: '🤪', name: 'Rosto Maluco', category: 'smileys', keywords: ['maluco', 'doido', 'zany'] },
  { emoji: '😎', name: 'Óculos Escuros', category: 'smileys', keywords: ['descolado', 'top', 'cool', 'sunglasses'] },
  { emoji: '🤓', name: 'Nerd', category: 'smileys', keywords: ['oculos', 'estudo', 'inteligente', 'geek'] },
  { emoji: '🧐', name: 'Monóculo Investigador', category: 'smileys', keywords: ['curioso', 'investigar', 'duvida'] },
  { emoji: '🤔', name: 'Pensativo', category: 'smileys', keywords: ['pensando', 'duvida', 'humm', 'think'] },
  { emoji: '🤫', name: 'Silêncio', category: 'smileys', keywords: ['shh', 'segredo', 'quiet'] },
  { emoji: '🤐', name: 'Boca Fechada com Zíper', category: 'smileys', keywords: ['segredo', 'mudo', 'bico'] },
  { emoji: '🤨', name: 'Sobrancelha Levantada', category: 'smileys', keywords: ['desconfiado', 'serio', 'skeptical'] },
  { emoji: '😐', name: 'Neutro', category: 'smileys', keywords: ['neutro', 'sem graca', 'indiferente'] },
  { emoji: '😑', name: 'Sem Expressão', category: 'smileys', keywords: ['cansado', 'tédio', 'aff'] },
  { emoji: '🙄', name: 'Revirando os Olhos', category: 'smileys', keywords: ['revirar', 'ironia', 'de novo', 'eyeroll'] },
  { emoji: '😬', name: 'Tenso / Careta', category: 'smileys', keywords: ['eita', 'vergonha', 'tenso', 'grimace'] },
  { emoji: '🤥', name: 'Pinóquio Nariz Comprido', category: 'smileys', keywords: ['mentira', 'fake', 'liar'] },
  { emoji: '😴', name: 'Dormindo', category: 'smileys', keywords: ['sono', 'dormir', 'zz', 'sleep'] },
  { emoji: '🤢', name: 'Enjoado', category: 'smileys', keywords: ['enjoo', 'verde', 'eca'] },
  { emoji: '🤮', name: 'Vomitando', category: 'smileys', keywords: ['vomito', 'nojo', 'puke'] },
  { emoji: '🥵', name: 'Com Calor', category: 'smileys', keywords: ['calor', 'quente', 'suor', 'hot'] },
  { emoji: '🥶', name: 'Com Frio', category: 'smileys', keywords: ['frio', 'gelado', 'congelando', 'cold'] },
  { emoji: '🤯', name: 'Cabeça Explodindo', category: 'smileys', keywords: ['mente', 'explodir', 'chocado', 'mindblown'] },
  { emoji: '🥳', name: 'Festa e Celebração', category: 'smileys', keywords: ['festa', 'parabens', 'comemorar', 'party'] },
  { emoji: '🥺', name: 'Olhar Pidão / Fofo', category: 'smileys', keywords: ['por favor', 'triste', 'emocionado', 'pleading'] },
  { emoji: '😢', name: 'Lágrima Solitária', category: 'smileys', keywords: ['triste', 'choro', 'sad', 'cry'] },
  { emoji: '😭', name: 'Chorando Muito', category: 'smileys', keywords: ['desespero', 'choro forte', 'soluço', 'sob'] },
  { emoji: '😱', name: 'Grito de Pavor', category: 'smileys', keywords: ['medo', 'susto', 'chocado', 'scream'] },
  { emoji: '😡', name: 'Muito Bravo', category: 'smileys', keywords: ['raiva', 'bravo', 'vermelho', 'rage'] },
  { emoji: '💀', name: 'Caveira', category: 'smileys', keywords: ['morte', 'morri', 'skull', 'dead'] },
  { emoji: '💩', name: 'Cocô Sorridente', category: 'smileys', keywords: ['coco', 'bosta', 'poop'] },
  { emoji: '🤡', name: 'Palhaço', category: 'smileys', keywords: ['palhaco', 'clown', 'bobagem'] },
  { emoji: '👻', name: 'Fantasma', category: 'smileys', keywords: ['fantasma', 'ghost', 'boo'] },
  { emoji: '🤖', name: 'Robô', category: 'smileys', keywords: ['robo', 'bot', 'inteligencia'] },

  // Pessoas & Gestos
  { emoji: '👋', name: 'Aceno de Mão', category: 'people', keywords: ['ola', 'tchau', 'aceno', 'wave', 'hello'] },
  { emoji: '👌', name: 'Sinal de OK', category: 'people', keywords: ['ok', 'perfeito', 'certo'] },
  { emoji: '🤌', name: 'Gesto Italiano', category: 'people', keywords: ['o que quer', 'italiano', 'gesto'] },
  { emoji: '✌️', name: 'Paz e Amor / Vitória', category: 'people', keywords: ['paz', 'vitoria', 'dois', 'peace'] },
  { emoji: '🤞', name: 'Dedos Cruzados', category: 'people', keywords: ['sorte', 'torcida', 'esperança'] },
  { emoji: '🤟', name: 'Te Amo em Sinais', category: 'people', keywords: ['amor', 'sinais', 'love'] },
  { emoji: '🤘', name: 'Rock / Chifres', category: 'people', keywords: ['rock', 'metal', 'guitarra'] },
  { emoji: '🤙', name: 'Hang Loose / Shaka', category: 'people', keywords: ['tranquilo', 'liga nois', 'surf'] },
  { emoji: '👈', name: 'Apontando para Esquerda', category: 'people', keywords: ['esquerda', 'apontar', 'olha'] },
  { emoji: '👉', name: 'Apontando para Direita', category: 'people', keywords: ['direita', 'apontar', 'aqui'] },
  { emoji: '👆', name: 'Apontando para Cima', category: 'people', keywords: ['cima', 'topo', 'up'] },
  { emoji: '👇', name: 'Apontando para Baixo', category: 'people', keywords: ['baixo', 'olha la', 'down'] },
  { emoji: '👍', name: 'Polegar para Cima / Joinha', category: 'people', keywords: ['joinha', 'positivo', 'like', 'thumbs up', 'bom'] },
  { emoji: '👎', name: 'Polegar para Baixo', category: 'people', keywords: ['deslike', 'ruim', 'negativo', 'thumbs down'] },
  { emoji: '✊', name: 'Punho Levantado', category: 'people', keywords: ['forca', 'punho', 'luta'] },
  { emoji: '👊', name: 'Soco de Frente', category: 'people', keywords: ['soquinho', 'parceria', 'fist'] },
  { emoji: '👏', name: 'Palmas / Aplausos', category: 'people', keywords: ['palmas', 'parabens', 'bravo', 'clap'] },
  { emoji: '🙌', name: 'Mãos Levantadas', category: 'people', keywords: ['celebrar', 'aleluia', 'uhul'] },
  { emoji: '🤝', name: 'Aperto de Mãos', category: 'people', keywords: ['acordo', 'negocio', 'parceria', 'handshake'] },
  { emoji: '🙏', name: 'Mãos em Oração / Gratidão', category: 'people', keywords: ['obrigado', 'amem', 'rezar', 'pray', 'thanks'] },
  { emoji: '💪', name: 'Músculo / Força', category: 'people', keywords: ['forte', 'treino', 'academia', 'musculo', 'biceps'] },
  { emoji: '👀', name: 'Olhos Atentos', category: 'people', keywords: ['olhando', 'atencao', 'de olho', 'eyes'] },
  { emoji: '🧠', name: 'Cérebro', category: 'people', keywords: ['mente', 'inteligente', 'brain', 'pensar'] },

  // Animais & Natureza
  { emoji: '🐶', name: 'Cachorrinho', category: 'nature', keywords: ['cachorro', 'cao', 'dog', 'filhote'] },
  { emoji: '🐱', name: 'Gatinho', category: 'nature', keywords: ['gato', 'felino', 'cat', 'miau'] },
  { emoji: '🐭', name: 'Ratinho', category: 'nature', keywords: ['rato', 'mouse'] },
  { emoji: '🐰', name: 'Coelhinho', category: 'nature', keywords: ['coelho', 'pascoa', 'bunny'] },
  { emoji: '🦊', name: 'Raposa', category: 'nature', keywords: ['raposa', 'fox'] },
  { emoji: '🐻', name: 'Ursinho', category: 'nature', keywords: ['urso', 'bear'] },
  { emoji: '🐼', name: 'Panda', category: 'nature', keywords: ['panda', 'bambu'] },
  { emoji: '🦁', name: 'Leão', category: 'nature', keywords: ['leao', 'rei', 'lion'] },
  { emoji: '🐯', name: 'Tigre', category: 'nature', keywords: ['tigre', 'tiger'] },
  { emoji: '🐸', name: 'Sapo', category: 'nature', keywords: ['sapo', 'frog'] },
  { emoji: '🐵', name: 'Macaco', category: 'nature', keywords: ['macaco', 'monkey'] },
  { emoji: '🦆', name: 'Pato', category: 'nature', keywords: ['pato', 'duck'] },
  { emoji: '🦅', name: 'Águia', category: 'nature', keywords: ['aguia', 'eagle'] },
  { emoji: '🦉', name: 'Coruja', category: 'nature', keywords: ['coruja', 'sabedoria', 'owl'] },
  { emoji: '🐺', name: 'Lobo', category: 'nature', keywords: ['lobo', 'wolf'] },
  { emoji: '🦄', name: 'Unicórnio', category: 'nature', keywords: ['unicornio', 'magia', 'unicorn'] },
  { emoji: '🐝', name: 'Abelha', category: 'nature', keywords: ['abelha', 'mel', 'bee'] },
  { emoji: '🦋', name: 'Borboleta', category: 'nature', keywords: ['borboleta', 'natureza', 'butterfly'] },
  { emoji: '🐙', name: 'Polvo', category: 'nature', keywords: ['polvo', 'mar', 'octopus'] },
  { emoji: '🐬', name: 'Golfinho', category: 'nature', keywords: ['golfinho', 'mar', 'dolphin'] },
  { emoji: '🦈', name: 'Tubarão', category: 'nature', keywords: ['tubarao', 'shark'] },
  { emoji: '🌸', name: 'Flor de Cerejeira', category: 'nature', keywords: ['flor', 'rosa', 'primavera', 'sakura'] },
  { emoji: '🌹', name: 'Rosa Vermelha', category: 'nature', keywords: ['rosa', 'flor', 'amor', 'rose'] },
  { emoji: '🌻', name: 'Girassol', category: 'nature', keywords: ['girassol', 'sol', 'amarelo'] },
  { emoji: '🍀', name: 'Trevo de 4 Folhas', category: 'nature', keywords: ['sorte', 'trevo', 'lucky'] },
  { emoji: '☀️', name: 'Sol Radiante', category: 'nature', keywords: ['sol', 'dia', 'calor', 'sun'] },
  { emoji: '🌙', name: 'Lua Crescente', category: 'nature', keywords: ['lua', 'noite', 'moon'] },
  { emoji: '⭐', name: 'Estrela Brilhante', category: 'nature', keywords: ['estrela', 'star', 'favorito'] },
  { emoji: '⚡', name: 'Raio de Trovão', category: 'nature', keywords: ['raio', 'eletricidade', 'trovao', 'flash'] },
  { emoji: '🔥', name: 'Fogo / Chama', category: 'nature', keywords: ['fogo', 'chama', 'quente', 'fire', 'brabo'] },
  { emoji: '💧', name: 'Gota de Água', category: 'nature', keywords: ['agua', 'gota', 'chuva', 'water'] },

  // Comidas & Bebidas
  { emoji: '🍏', name: 'Maçã Verde', category: 'food', keywords: ['maca', 'fruta', 'verde', 'apple'] },
  { emoji: '🍎', name: 'Maçã Vermelha', category: 'food', keywords: ['maca', 'fruta', 'vermelha'] },
  { emoji: '🍌', name: 'Banana', category: 'food', keywords: ['banana', 'fruta'] },
  { emoji: '🍉', name: 'Melancia', category: 'food', keywords: ['melancia', 'verao'] },
  { emoji: '🍇', name: 'Uva', category: 'food', keywords: ['uva', 'vinho'] },
  { emoji: '🍓', name: 'Morango', category: 'food', keywords: ['morango', 'fruta', 'doce'] },
  { emoji: '🥑', name: 'Abacate', category: 'food', keywords: ['abacate', 'avocado', 'saudavel'] },
  { emoji: '🥐', name: 'Croissant', category: 'food', keywords: ['croissant', 'cafe', 'padaria'] },
  { emoji: '🍞', name: 'Pão de Forma', category: 'food', keywords: ['pao', 'padaria', 'bread'] },
  { emoji: '🧀', name: 'Queijo', category: 'food', keywords: ['queijo', 'cheese'] },
  { emoji: '🍳', name: 'Ovo Frito', category: 'food', keywords: ['ovo', 'frito', 'cafe'] },
  { emoji: '🥞', name: 'Panquecas', category: 'food', keywords: ['panqueca', 'doce', 'cafe'] },
  { emoji: '🍔', name: 'Hambúrguer', category: 'food', keywords: ['hamburguer', 'lanche', 'burger', 'fast food'] },
  { emoji: '🍟', name: 'Batata Frita', category: 'food', keywords: ['batata', 'frita', 'fries'] },
  { emoji: '🍕', name: 'Fatia de Pizza', category: 'food', keywords: ['pizza', 'queijo', 'italiana'] },
  { emoji: '🌭', name: 'Cachorro Quente', category: 'food', keywords: ['hot dog', 'lanche'] },
  { emoji: '🌮', name: 'Taco Mexicano', category: 'food', keywords: ['taco', 'mexico'] },
  { emoji: '🍝', name: 'Espaguete / Macarrão', category: 'food', keywords: ['massa', 'macarrao', 'pasta'] },
  { emoji: '🍣', name: 'Sushi Japonês', category: 'food', keywords: ['sushi', 'japones', 'peixe'] },
  { emoji: '🍦', name: 'Sorvete de Casquinha', category: 'food', keywords: ['sorvete', 'gelado', 'ice cream'] },
  { emoji: '🎂', name: 'Bolo de Aniversário', category: 'food', keywords: ['bolo', 'aniversario', 'parabens', 'cake'] },
  { emoji: '🍫', name: 'Barra de Chocolate', category: 'food', keywords: ['chocolate', 'doce'] },
  { emoji: '🍿', name: 'Pipoca de Cinema', category: 'food', keywords: ['pipoca', 'cinema', 'filme', 'popcorn'] },
  { emoji: '🍩', name: 'Rosquinha / Donut', category: 'food', keywords: ['donut', 'doce'] },
  { emoji: '☕', name: 'Café Quente', category: 'food', keywords: ['cafe', 'coffee', 'manha', 'quente'] },
  { emoji: '🍺', name: 'Cerveja Caneca', category: 'food', keywords: ['cerveja', 'chope', 'beer'] },
  { emoji: '🍻', name: 'Brinde de Cervejas', category: 'food', keywords: ['brinde', 'cervejas', 'cheers'] },
  { emoji: '🥂', name: 'Taças de Champanhe', category: 'food', keywords: ['champanhe', 'comemorar', 'brinde'] },
  { emoji: '🍷', name: 'Taça de Vinho', category: 'food', keywords: ['vinho', 'wine'] },

  // Atividades & Esportes
  { emoji: '⚽', name: 'Bola de Futebol', category: 'activity', keywords: ['futebol', 'bola', 'gol', 'soccer'] },
  { emoji: '🏀', name: 'Basquete', category: 'activity', keywords: ['basquete', 'bola', 'nba'] },
  { emoji: '🏈', name: 'Futebol Americano', category: 'activity', keywords: ['nfl', 'bola', 'touchdown'] },
  { emoji: '🎾', name: 'Tênis', category: 'activity', keywords: ['tenis', 'raquete'] },
  { emoji: '🏐', name: 'Vôlei', category: 'activity', keywords: ['volei', 'quadra'] },
  { emoji: '🏆', name: 'Troféu de Campeão', category: 'activity', keywords: ['trofeu', 'campeao', 'vitoria', 'gold', 'winner'] },
  { emoji: '🥇', name: 'Medalha de Ouro', category: 'activity', keywords: ['ouro', 'primeiro', 'medal'] },
  { emoji: '🎯', name: 'Alvo com Dardo', category: 'activity', keywords: ['alvo', 'tiro', 'cravou', 'bullseye'] },
  { emoji: '🎮', name: 'Controle de Videogame', category: 'activity', keywords: ['videogame', 'jogo', 'game', 'gamer', 'play'] },
  { emoji: '🎲', name: 'Dado de Jogo', category: 'activity', keywords: ['dado', 'sorte', 'rpg', 'dice'] },
  { emoji: '🎸', name: 'Guitarra Elétrica', category: 'activity', keywords: ['guitarra', 'som', 'musica', 'rock'] },
  { emoji: '🎧', name: 'Fones de Ouvido', category: 'activity', keywords: ['fone', 'musica', 'som', 'headphone'] },
  { emoji: '🎤', name: 'Microfone de Cantar', category: 'activity', keywords: ['microfone', 'musica', 'karaoke'] },
  { emoji: '🎬', name: 'Claquete de Cinema', category: 'activity', keywords: ['filme', 'cinema', 'acao', 'movie'] },

  // Objetos & Símbolos
  { emoji: '❤️', name: 'Coração Vermelho', category: 'objects', keywords: ['amor', 'coracao', 'love', 'red heart'] },
  { emoji: '🧡', name: 'Coração Laranja', category: 'objects', keywords: ['amor', 'coracao', 'laranja'] },
  { emoji: '💛', name: 'Coração Amarelo', category: 'objects', keywords: ['amizade', 'coracao', 'amarelo'] },
  { emoji: '💚', name: 'Coração Verde', category: 'objects', keywords: ['esperança', 'coracao', 'verde'] },
  { emoji: '💙', name: 'Coração Azul', category: 'objects', keywords: ['lealdade', 'coracao', 'azul'] },
  { emoji: '💜', name: 'Coração Roxo', category: 'objects', keywords: ['afeto', 'coracao', 'roxo'] },
  { emoji: '🖤', name: 'Coração Preto', category: 'objects', keywords: ['dark', 'coracao', 'preto'] },
  { emoji: '🤍', name: 'Coração Branco', category: 'objects', keywords: ['paz', 'coracao', 'branco'] },
  { emoji: '💔', name: 'Coração Partido', category: 'objects', keywords: ['triste', 'termino', 'quebrado'] },
  { emoji: '✨', name: 'Brilhos Mágicos', category: 'objects', keywords: ['brilho', 'magia', 'top', 'sparkles', 'estrela'] },
  { emoji: '🎉', name: 'Cone de Confete', category: 'objects', keywords: ['festa', 'comemorar', 'parabens', 'tada'] },
  { emoji: '🚀', name: 'Foguete Espacial', category: 'objects', keywords: ['foguete', 'voar', 'subir', 'rocket', 'moon'] },
  { emoji: '💯', name: 'Nota 100 / Cem', category: 'objects', keywords: ['cem', '100', 'perfeito', 'top'] },
  { emoji: '💡', name: 'Lâmpada de Ideia', category: 'objects', keywords: ['ideia', 'luz', 'lampada', 'insight'] },
  { emoji: '💰', name: 'Saco de Dinheiro', category: 'objects', keywords: ['dinheiro', 'grana', 'rico', 'money'] },
  { emoji: '💎', name: 'Diamante Precioso', category: 'objects', keywords: ['diamante', 'joia', 'precioso', 'gem'] },
  { emoji: '📌', name: 'Alfinete de Fixar', category: 'objects', keywords: ['fixar', 'alfinete', 'lembrete', 'pin'] },
  { emoji: '🔒', name: 'Cadeado Fechado', category: 'objects', keywords: ['seguranca', 'privado', 'fechado', 'lock'] },
  { emoji: '🔔', name: 'Sino de Notificação', category: 'objects', keywords: ['notificacao', 'sino', 'aviso', 'bell'] },
  { emoji: '✅', name: 'Marca de Verificação', category: 'objects', keywords: ['check', 'confirmado', 'correto', 'certo', 'ok'] },
  { emoji: '❌', name: 'X Vermelho', category: 'objects', keywords: ['x', 'errado', 'cancelar', 'fechar'] },
  { emoji: '⚠️', name: 'Sinal de Alerta', category: 'objects', keywords: ['aviso', 'alerta', 'cuidado', 'warning'] },
];

const RECENT_KEY = 'discord_recent_emojis';
const DEFAULT_RECENTS = ['😀', '😂', '😍', '👍', '🔥', '🎉', '❤️', '✨', '🚀', '👀', '💯', '👏'];

export function getRecentEmojis() {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return DEFAULT_RECENTS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_RECENTS;
  } catch {
    return DEFAULT_RECENTS;
  }
}

export function saveRecentEmoji(emoji) {
  try {
    const current = getRecentEmojis().filter((e) => e !== emoji);
    const updated = [emoji, ...current].slice(0, 24);
    localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return DEFAULT_RECENTS;
  }
}

export function searchEmojis(query) {
  if (!query || !query.trim()) return EMOJI_LIST;
  const q = query.trim().toLowerCase();
  return EMOJI_LIST.filter((item) => {
    if (item.name.toLowerCase().includes(q)) return true;
    if (item.emoji === q) return true;
    return item.keywords.some((k) => k.toLowerCase().includes(q));
  });
}
