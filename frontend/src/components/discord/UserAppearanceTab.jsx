import React, { useState } from 'react';
import { Layout, Check, Type } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export default function UserAppearanceTab() {
  const [density, setDensity] = useState(() => {
    try {
      return localStorage.getItem('discord_chat_density') || 'cozy';
    } catch {
      return 'cozy';
    }
  });

  const [fontSize, setFontSize] = useState(() => {
    try {
      return localStorage.getItem('discord_font_size') || '16';
    } catch {
      return '16';
    }
  });

  const { addToast } = useToast();

  const handleDensityChange = (newDensity) => {
    setDensity(newDensity);
    try {
      localStorage.setItem('discord_chat_density', newDensity);
      document.documentElement.setAttribute('data-chat-density', newDensity);
    } catch {}
    addToast(
      `Densidade alterada para: ${newDensity === 'cozy' ? 'Confortável' : 'Compacto'}`,
      'success'
    );
  };

  const handleFontSizeChange = (newSize) => {
    setFontSize(newSize);
    try {
      localStorage.setItem('discord_font_size', newSize);
      document.documentElement.style.setProperty('--chat-font-size', `${newSize}px`);
    } catch {}
    addToast(`Tamanho da fonte ajustado para ${newSize}px.`, 'success');
  };

  return (
    <div className="server-tab-content" data-testid="user-appearance-tab">
      <h3 className="server-tab-title">Aparência do Chat</h3>
      <p className="server-tab-desc">Personalize o espaçamento, a densidade das mensagens e o tamanho da fonte.</p>

      {/* Densidade das Mensagens */}
      <div style={{ marginTop: '16px' }}>
        <span className="server-field-label">Exibição de Mensagens</span>
        <div className="appearance-density-grid" data-testid="density-options">
          {/* Confortável */}
          <div
            className={`channel-type-card ${density === 'cozy' ? 'selected' : ''}`}
            onClick={() => handleDensityChange('cozy')}
            data-testid="density-cozy-card"
          >
            <div className="channel-type-card-left">
              <Layout size={22} color={density === 'cozy' ? '#5865f2' : '#949ba4'} />
              <div className="channel-type-card-info">
                <span className="channel-type-title">Confortável (Cozy)</span>
                <span className="channel-type-desc">Visual moderno com foto de perfil grande e espaçamento relaxado.</span>
              </div>
            </div>
            <div className="channel-type-radio-outer">
              {density === 'cozy' && <div className="channel-type-radio-inner" />}
            </div>
          </div>

          {/* Compacto */}
          <div
            className={`channel-type-card ${density === 'compact' ? 'selected' : ''}`}
            onClick={() => handleDensityChange('compact')}
            data-testid="density-compact-card"
          >
            <div className="channel-type-card-left">
              <Type size={22} color={density === 'compact' ? '#5865f2' : '#949ba4'} />
              <div className="channel-type-card-info">
                <span className="channel-type-title">Compacto (Compact)</span>
                <span className="channel-type-desc">Estilo clássico mais denso para visualizar muito mais mensagens na tela.</span>
              </div>
            </div>
            <div className="channel-type-radio-outer">
              {density === 'compact' && <div className="channel-type-radio-inner" />}
            </div>
          </div>
        </div>
      </div>

      {/* Tamanho da Fonte */}
      <div style={{ marginTop: '30px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span className="server-field-label">Tamanho da Fonte das Mensagens</span>
          <span style={{ color: '#dbdee1', fontSize: '13px', fontWeight: 600 }} data-testid="font-size-label">
            {fontSize}px
          </span>
        </div>

        <div className="font-size-buttons-row" style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
          {[
            { size: '14', label: 'Pequena (14px)' },
            { size: '16', label: 'Média / Padrão (16px)' },
            { size: '18', label: 'Grande (18px)' },
          ].map((item) => (
            <button
              key={item.size}
              type="button"
              className={`discord-btn ${fontSize === item.size ? 'discord-btn-primary' : 'discord-btn-secondary'}`}
              onClick={() => handleFontSizeChange(item.size)}
              data-testid={`font-size-${item.size}-btn`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Preview em Tempo Real */}
      <div style={{ marginTop: '32px' }}>
        <span className="server-field-label">Pré-visualização</span>
        <div
          className="appearance-chat-preview"
          style={{ fontSize: `${fontSize}px` }}
          data-testid="appearance-preview"
        >
          <div className={`chat-message-item ${density === 'compact' ? 'compact-preview' : ''}`} style={{ background: 'transparent' }}>
            <div className="chat-message-main-content">
              {density === 'cozy' && (
                <div className="chat-author-avatar" style={{ width: '36px', height: '36px', fontSize: '15px' }}>
                  A
                </div>
              )}
              <div className="chat-message-body">
                <div className="chat-message-meta">
                  <span className="chat-author-name" style={{ color: '#5865f2', fontWeight: 600 }}>Arya</span>
                  <span className="chat-timestamp-brasilia">Hoje às 14:30</span>
                </div>
                <div className="chat-message-text" style={{ fontSize: `${fontSize}px` }}>
                  Este é um exemplo de como suas mensagens serão renderizadas no feed de conversas!
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
