import React, { useState, useEffect, useRef } from 'react';
import { Smile, Upload, Trash2, AlertTriangle, Loader2, Sparkles, Check, Image as ImageIcon } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { useServerEmojis } from '../../context/ServerEmojisContext';
import '../../styles/discord-emojis.css';

export default function ServerEmojisTab({ server, currentUser }) {
  const [emojis, setEmojis] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [emojiName, setEmojiName] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const { refreshEmojis } = useServerEmojis();

  // Popup de exclusão
  const [emojiToDelete, setEmojiToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fileInputRef = useRef(null);

  let addToast = () => {};
  try {
    const toastCtx = useToast();
    if (toastCtx?.addToast) addToast = toastCtx.addToast;
  } catch {}

  const token = localStorage.getItem('auth_token') || localStorage.getItem('token') || '';

  const fetchEmojis = async () => {
    if (!server?.id || !token) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/v1/discord/servers/${server.id}/emojis`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setEmojis(data || []);
      }
    } catch {
      addToast('Não foi possível carregar os emojis do servidor.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmojis();
  }, [server?.id]);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
    if (!allowed.includes(file.type)) {
      addToast('Formato inválido. Selecione PNG, JPG, GIF ou WEBP.', 'warning');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      addToast('O arquivo não pode ultrapassar 5 MB.', 'warning');
      return;
    }

    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    // Sugere nome baseado no nome do arquivo se campo estiver vazio
    if (!emojiName) {
      const baseName = file.name.split('.')[0].toLowerCase().replace(/[^a-z0-9_]/g, '_');
      setEmojiName(baseName.slice(0, 32));
    }
  };

  const handleUploadEmoji = async (e) => {
    e.preventDefault();
    const cleanName = emojiName.trim().replace(/:/g, '').toLowerCase();
    if (!cleanName || cleanName.length < 2) {
      addToast('O nome do emoji deve ter no mínimo 2 caracteres.', 'warning');
      return;
    }

    if (!selectedFile) {
      addToast('Selecione uma imagem para o emoji.', 'warning');
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('name', cleanName);
      formData.append('file', selectedFile);

      const res = await fetch(`/api/v1/discord/servers/${server.id}/emojis`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || 'Erro ao cadastrar emoji.');
      }

      const newEmoji = await res.json();
      setEmojis((prev) => [...prev, newEmoji]);
      setEmojiName('');
      setSelectedFile(null);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      if (fileInputRef.current) fileInputRef.current.value = '';

      if (typeof refreshEmojis === 'function') refreshEmojis();
      addToast(`Emoji :${cleanName}: adicionado com sucesso!`, 'success');
    } catch (err) {
      addToast(err.message || 'Falha ao cadastrar emoji.', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!emojiToDelete) return;
    try {
      setDeleting(true);
      const res = await fetch(`/api/v1/discord/servers/${server.id}/emojis/${emojiToDelete.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || 'Erro ao excluir emoji.');
      }

      setEmojis((prev) => prev.filter((e) => e.id !== emojiToDelete.id));
      if (typeof refreshEmojis === 'function') refreshEmojis();
      addToast(`Emoji :${emojiToDelete.name}: removido com sucesso!`, 'success');
      setEmojiToDelete(null);
    } catch (err) {
      addToast(err.message || 'Falha ao excluir emoji.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="server-emojis-tab" data-testid="server-emojis-tab">
      <div className="server-emojis-header">
        <div>
          <h3 className="server-tab-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Smile size={20} color="#5865f2" /> Emojis do Servidor
          </h3>
          <p className="server-tab-desc">
            Adicione até 50 emojis customizados que qualquer membro pode usar nos canais deste servidor digitando :nome_do_emoji:.
          </p>
        </div>
      </div>

      {/* Formulário de Upload */}
      <form onSubmit={handleUploadEmoji} className="server-emoji-upload-card" data-testid="upload-emoji-form">
        <div className="server-emoji-upload-grid">
          {/* Seletor / Dropzone da Imagem */}
          <div
            className="server-emoji-dropzone"
            onClick={() => fileInputRef.current?.click()}
            data-testid="emoji-file-dropzone"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".png,.jpg,.jpeg,.gif,.webp"
              style={{ display: 'none' }}
              onChange={handleFileChange}
              data-testid="emoji-file-input"
            />
            {previewUrl ? (
              <div className="server-emoji-preview-box">
                <img src={previewUrl} alt="Preview" className="server-emoji-preview-img" data-testid="emoji-preview-img" />
                <span className="server-emoji-preview-text">Trocar imagem</span>
              </div>
            ) : (
              <div className="server-emoji-dropzone-empty">
                <Upload size={24} color="#5865f2" />
                <span>Carregar Imagem (PNG, JPG, GIF, WEBP)</span>
                <small>Máximo 5 MB</small>
              </div>
            )}
          </div>

          {/* Nome e Ação */}
          <div className="server-emoji-inputs-col">
            <label className="server-field-label">Nome do Emoji (Atalho)</label>
            <div className="server-emoji-name-wrapper">
              <span className="server-emoji-colon">:</span>
              <input
                type="text"
                className="server-input server-emoji-name-input"
                placeholder="nome_do_emoji"
                value={emojiName}
                onChange={(e) => setEmojiName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                maxLength={32}
                data-testid="emoji-name-input"
              />
              <span className="server-emoji-colon">:</span>
            </div>
            <small style={{ color: '#949ba4', fontSize: '11px', marginTop: 4 }}>
              Exemplo: digite <strong>hype</strong> para usar <strong>:hype:</strong> no chat.
            </small>

            <button
              type="submit"
              className="discord-btn discord-btn-primary"
              style={{ marginTop: 14, width: 'fit-content' }}
              disabled={uploading || !selectedFile || !emojiName.trim()}
              data-testid="submit-emoji-btn"
            >
              {uploading ? <Loader2 size={16} className="spin-anim" /> : <Upload size={16} />}
              <span>{uploading ? 'Carregando...' : 'Adicionar Emoji'}</span>
            </button>
          </div>
        </div>
      </form>

      {/* Lista de Emojis Existentes */}
      <div className="server-emojis-list-section">
        <h4 className="server-emojis-subheading">
          Emojis Disponíveis ({emojis.length})
        </h4>

        {loading ? (
          <div className="server-emojis-loading" data-testid="emojis-loading">
            <Loader2 size={24} className="spin-anim" color="#5865f2" />
            <span>Carregando emojis do servidor...</span>
          </div>
        ) : emojis.length === 0 ? (
          <div className="server-emojis-empty" data-testid="emojis-empty">
            <Smile size={32} color="#5865f2" />
            <strong>Nenhum emoji personalizado ainda</strong>
            <p>Faça upload de emojis divertidos, logos ou memes para animar o chat da sua comunidade.</p>
          </div>
        ) : (
          <div className="server-emojis-grid" data-testid="emojis-grid">
            {emojis.map((emoji) => (
              <div key={emoji.id} className="server-emoji-card" data-testid={`emoji-card-${emoji.id}`}>
                <div className="server-emoji-card-preview">
                  <img src={emoji.image_url} alt={emoji.name} className="server-emoji-card-img" />
                </div>
                <div className="server-emoji-card-info">
                  <strong className="server-emoji-card-name" title={`:${emoji.name}:`}>
                    :{emoji.name}:
                  </strong>
                </div>
                <button
                  type="button"
                  className="server-emoji-delete-btn"
                  onClick={() => setEmojiToDelete(emoji)}
                  title="Excluir Emoji"
                  data-testid={`delete-emoji-btn-${emoji.id}`}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de Confirmação de Deleção Centralizado (Regra de Popups) */}
      {emojiToDelete && (
        <div className="modal-backdrop" data-testid="delete-emoji-backdrop">
          <div className="delete-confirm-popup" data-testid="delete-emoji-modal">
            <h4 className="delete-confirm-title">
              <AlertTriangle size={20} />
              Excluir Emoji :{emojiToDelete.name}:?
            </h4>
            <p className="delete-confirm-message">
              Tem certeza de que deseja apagar o emoji <strong>":{emojiToDelete.name}:"</strong>? Os membros não poderão mais utilizá-lo nas mensagens deste servidor.
            </p>
            <div className="delete-confirm-footer">
              <button
                type="button"
                className="discord-btn discord-btn-secondary"
                onClick={() => setEmojiToDelete(null)}
                disabled={deleting}
                data-testid="cancel-delete-emoji-btn"
              >
                <span>Cancelar</span>
              </button>
              <button
                type="button"
                className="discord-btn discord-btn-danger"
                onClick={handleConfirmDelete}
                disabled={deleting}
                data-testid="confirm-delete-emoji-btn"
              >
                {deleting ? <Loader2 size={16} className="spin-anim" /> : <Trash2 size={16} />}
                <span>{deleting ? 'Excluindo...' : 'Sim, Excluir'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
