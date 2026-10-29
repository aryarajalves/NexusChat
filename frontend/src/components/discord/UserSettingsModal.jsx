import React, { useState, useEffect } from 'react';
import { User, Volume2, Palette, LogOut, X } from 'lucide-react';
import UserAccountTab from './UserAccountTab';
import UserVoiceAudioTab from './UserVoiceAudioTab';
import UserAppearanceTab from './UserAppearanceTab';

export default function UserSettingsModal({
  isOpen,
  onClose,
  currentUser,
  onUserUpdated,
  onLogout,
}) {
  const [activeTab, setActiveTab] = useState('account'); // 'account' | 'voice_audio' | 'appearance'
  const token = localStorage.getItem('auth_token');

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" data-testid="user-settings-modal-backdrop">
      <div className="server-settings-dialog" data-testid="user-settings-modal">
        {/* Barra Lateral do Modal (Configurações de Usuário) */}
        <aside className="server-settings-sidebar">
          <div className="server-settings-sidebar-header">
            <span className="server-settings-server-name">Configurações de Usuário</span>
          </div>

          <nav className="server-settings-nav">
            <button
              type="button"
              className={`server-settings-nav-btn ${activeTab === 'account' ? 'active' : ''}`}
              onClick={() => setActiveTab('account')}
              data-testid="tab-user-account-btn"
            >
              <User size={16} /> Minha Conta
            </button>
            <button
              type="button"
              className={`server-settings-nav-btn ${activeTab === 'voice_audio' ? 'active' : ''}`}
              onClick={() => setActiveTab('voice_audio')}
              data-testid="tab-user-voice-audio-btn"
            >
              <Volume2 size={16} /> Voz & Áudio
            </button>
            <button
              type="button"
              className={`server-settings-nav-btn ${activeTab === 'appearance' ? 'active' : ''}`}
              onClick={() => setActiveTab('appearance')}
              data-testid="tab-user-appearance-btn"
            >
              <Palette size={16} /> Aparência
            </button>

            {onLogout && (
              <>
                <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '10px 0' }} />
                <button
                  type="button"
                  className="server-settings-nav-btn"
                  style={{ color: '#f23f43' }}
                  onClick={onLogout}
                  data-testid="user-logout-btn"
                >
                  <LogOut size={16} /> Sair da Conta
                </button>
              </>
            )}
          </nav>
        </aside>

        {/* Área Central / Conteúdo da Aba */}
        <main className="server-settings-main">
          {activeTab === 'account' && (
            <UserAccountTab
              currentUser={currentUser}
              onUserUpdated={onUserUpdated}
              token={token}
            />
          )}

          {activeTab === 'voice_audio' && <UserVoiceAudioTab />}

          {activeTab === 'appearance' && <UserAppearanceTab />}
        </main>

        {/* Botão de Fechar / ESC no Canto Superior Direito */}
        <div className="server-settings-close-box">
          <button
            type="button"
            className="server-settings-close-circle"
            onClick={onClose}
            title="Fechar (ESC)"
            data-testid="close-user-settings-btn"
          >
            <X size={18} />
          </button>
          <span className="server-settings-esc-hint">ESC</span>
        </div>
      </div>
    </div>
  );
}
