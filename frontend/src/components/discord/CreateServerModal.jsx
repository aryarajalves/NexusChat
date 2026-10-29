import React, { useState, useRef, useEffect } from 'react';
import { Server, Camera, Upload, Trash2, Plus, Loader2 } from 'lucide-react';

export default function CreateServerModal({ isOpen, onClose, onCreateServer }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [iconFile, setIconFile] = useState(null);
  const [iconPreviewUrl, setIconPreviewUrl] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const fileInputRef = useRef(null);

  // Limpa o object URL ao desmontar ou trocar de imagem
  useEffect(() => {
    return () => {
      if (iconPreviewUrl) {
        URL.revokeObjectURL(iconPreviewUrl);
      }
    };
  }, [iconPreviewUrl]);

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Por favor, selecione um arquivo de imagem válido (PNG, JPG, GIF ou WEBP).');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('A imagem do ícone não pode ultrapassar 10 MB.');
      return;
    }

    setError('');
    if (iconPreviewUrl) {
      URL.revokeObjectURL(iconPreviewUrl);
    }

    const preview = URL.createObjectURL(file);
    setIconFile(file);
    setIconPreviewUrl(preview);
  };

  const handleRemoveIcon = () => {
    if (iconPreviewUrl) {
      URL.revokeObjectURL(iconPreviewUrl);
    }
    setIconFile(null);
    setIconPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Por favor, informe o nome do servidor.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');
      if (iconFile) {
        await onCreateServer(
          {
            name: name.trim(),
            description: description.trim() || undefined,
            icon_file: iconFile,
          },
          iconFile
        );
      } else {
        await onCreateServer({
          name: name.trim(),
          description: description.trim() || undefined,
        });
      }
      setName('');
      setDescription('');
      handleRemoveIcon();
      onClose();
    } catch (err) {
      setError(err.message || 'Falha ao criar servidor.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const initial = name.trim().charAt(0).toUpperCase();

  return (
    <div
      className="discord-modal-backdrop"
      data-testid="create-server-modal"
      role="dialog"
      aria-modal="true"
    >
      <div className="discord-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Server size={22} color="#5865f2" />
            <h3 className="discord-modal-title">Criar seu Servidor</h3>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="form-error-banner" data-testid="form-error-banner">{error}</div>}

            <p className="discord-modal-subtitle" style={{ margin: '0 0 6px 0', textAlign: 'center' }}>
              Seu servidor é onde você e seus amigos se reúnem. Personalize o nome e adicione um ícone com upload de imagem.
            </p>

            {/* Upload Visual Circular de Ícone (Estilo Discord) */}
            <div className="server-icon-upload-wrapper">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={handleFileChange}
                style={{ display: 'none' }}
                data-testid="server-icon-file-input"
              />

              <div
                className="server-icon-preview-circle"
                onClick={() => fileInputRef.current?.click()}
                title="Clique para escolher uma imagem de ícone"
                data-testid="server-icon-preview-circle"
              >
                {iconPreviewUrl ? (
                  <img
                    src={iconPreviewUrl}
                    alt="Pré-visualização do Ícone"
                    className="server-icon-preview-img"
                    data-testid="server-icon-preview-img"
                  />
                ) : initial ? (
                  <div className="server-icon-initial">{initial}</div>
                ) : (
                  <div className="server-icon-placeholder">
                    <Camera size={26} />
                    <span className="server-icon-placeholder-text">Upload</span>
                  </div>
                )}

                <div className="server-icon-badge-add" title="Upload de Imagem">
                  <Plus size={13} strokeWidth={3} />
                </div>
              </div>

              <div className="server-icon-actions">
                <button
                  type="button"
                  className="server-icon-choose-btn"
                  onClick={() => fileInputRef.current?.click()}
                  data-testid="choose-icon-btn"
                >
                  <Upload size={13} />
                  <span>{iconPreviewUrl ? 'Trocar Imagem' : 'Escolher Imagem'}</span>
                </button>

                {iconPreviewUrl && (
                  <button
                    type="button"
                    className="server-icon-remove-btn"
                    onClick={handleRemoveIcon}
                    title="Remover imagem selecionada"
                    data-testid="remove-icon-btn"
                  >
                    <Trash2 size={13} />
                    <span>Remover</span>
                  </button>
                )}
              </div>

              <span className="server-icon-hint">
                Tamanho recomendado: 512x512 (PNG, JPG ou WEBP)
              </span>
            </div>

            <div className="form-group">
              <label className="form-label">Nome do Servidor *</label>
              <input
                type="text"
                className="form-input"
                placeholder="Ex: Comunidade Dev"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
                required
                disabled={isSubmitting}
                data-testid="server-name-input"
                autoFocus
              />
            </div>

            <div className="form-group">
              <label className="form-label">Descrição (Opcional)</label>
              <input
                type="text"
                className="form-input"
                placeholder="Sobre o que é este servidor?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={255}
                disabled={isSubmitting}
                data-testid="server-desc-input"
              />
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="discord-modal-btn btn-secondary"
              onClick={onClose}
              disabled={isSubmitting}
              data-testid="server-cancel-btn"
            >
              Cancelar
            </button>

            <button
              type="submit"
              className="discord-modal-btn btn-primary"
              disabled={isSubmitting || !name.trim()}
              data-testid="server-submit-btn"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="spinner" />
                  <span>Criando...</span>
                </>
              ) : (
                <span>Criar Servidor</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
