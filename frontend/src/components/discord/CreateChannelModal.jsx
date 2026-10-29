import React, { useState } from 'react';
import { Hash, Volume2, Loader2 } from 'lucide-react';

export default function CreateChannelModal({ isOpen, onClose, onCreateChannel }) {
  const [name, setName] = useState('');
  const [type, setType] = useState('TEXT');
  const [category, setCategory] = useState('Canais de Texto');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Por favor, informe o nome do canal.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');
      await onCreateChannel({
        name: name.trim(),
        type,
        category: category.trim() || (type === 'TEXT' ? 'Canais de Texto' : 'Canais de Voz'),
      });
      setName('');
      setType('TEXT');
      onClose();
    } catch (err) {
      setError(err.message || 'Falha ao criar canal.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="discord-modal-backdrop"
      data-testid="create-channel-modal"
      role="dialog"
      aria-modal="true"
    >
      <div className="discord-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Hash size={22} color="#5865f2" />
            <h3 className="discord-modal-title">Criar Canal</h3>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="form-error-banner">{error}</div>}

            <div className="form-group">
              <label className="form-label">Tipo de Canal</label>
              <div className="channel-type-selector">
                {/* Opção 1: Canal de Texto */}
                <div
                  className={`channel-type-card ${type === 'TEXT' ? 'selected' : ''}`}
                  onClick={() => {
                    setType('TEXT');
                    setCategory('Canais de Texto');
                  }}
                  data-testid="channel-type-text"
                  role="button"
                  tabIndex={0}
                >
                  <div className="channel-type-card-left">
                    <Hash size={24} className="channel-type-icon" />
                    <div className="channel-type-card-info">
                      <span className="channel-type-title">Texto</span>
                      <span className="channel-type-desc">Poste mensagens, imagens e anexos</span>
                    </div>
                  </div>
                  <div className="channel-type-radio-outer">
                    {type === 'TEXT' && <div className="channel-type-radio-inner" />}
                  </div>
                  <input
                    type="radio"
                    name="channelType"
                    value="TEXT"
                    checked={type === 'TEXT'}
                    onChange={() => {
                      setType('TEXT');
                      setCategory('Canais de Texto');
                    }}
                    className="visually-hidden"
                  />
                </div>

                {/* Opção 2: Canal de Voz */}
                <div
                  className={`channel-type-card ${type === 'VOICE' ? 'selected' : ''}`}
                  onClick={() => {
                    setType('VOICE');
                    setCategory('Canais de Voz');
                  }}
                  data-testid="channel-type-voice"
                  role="button"
                  tabIndex={0}
                >
                  <div className="channel-type-card-left">
                    <Volume2 size={24} className="channel-type-icon" />
                    <div className="channel-type-card-info">
                      <span className="channel-type-title">Voz</span>
                      <span className="channel-type-desc">Converse por áudio, microfone e tela</span>
                    </div>
                  </div>
                  <div className="channel-type-radio-outer">
                    {type === 'VOICE' && <div className="channel-type-radio-inner" />}
                  </div>
                  <input
                    type="radio"
                    name="channelType"
                    value="VOICE"
                    checked={type === 'VOICE'}
                    onChange={() => {
                      setType('VOICE');
                      setCategory('Canais de Voz');
                    }}
                    className="visually-hidden"
                  />
                </div>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Nome do Canal *</label>
              <div className="channel-name-input-wrapper">
                <span className="channel-name-prefix">
                  {type === 'TEXT' ? '#' : '🔊'}
                </span>
                <input
                  type="text"
                  className="form-input channel-input-with-prefix"
                  placeholder="novo-canal"
                  value={name}
                  onChange={(e) => setName(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                  maxLength={100}
                  required
                  disabled={isSubmitting}
                  data-testid="channel-name-input"
                  autoFocus
                />
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="discord-modal-btn btn-secondary"
              onClick={onClose}
              disabled={isSubmitting}
              data-testid="channel-cancel-btn"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="discord-modal-btn btn-primary"
              disabled={isSubmitting || !name.trim()}
              data-testid="channel-submit-btn"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="spinner" />
                  <span>Criando...</span>
                </>
              ) : (
                <span>Criar Canal</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
