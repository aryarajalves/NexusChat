import React, { useState, useEffect } from 'react';
import { Sparkles, Hash, Save, Loader2 } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export const DEFAULT_WELCOME_TEMPLATE =
  'Olá {user}, seja muito bem-vindo(a) ao servidor **{server}**! 🎉';

export default function ServerWelcomeTab({
  server,
  channels = [],
  onServerUpdated,
  token,
}) {
  const textChannels = channels.filter((c) => c.type === 'TEXT');
  const fallbackChannelId = textChannels[0]?.id || '';

  const [welcomeEnabled, setWelcomeEnabled] = useState(Boolean(server?.welcome_enabled));
  const [welcomeChannelId, setWelcomeChannelId] = useState(
    server?.welcome_channel_id || fallbackChannelId
  );
  const [welcomeMessage, setWelcomeMessage] = useState(
    server?.welcome_message || DEFAULT_WELCOME_TEMPLATE
  );
  const [saving, setSaving] = useState(false);

  const { addToast } = useToast();

  useEffect(() => {
    setWelcomeEnabled(Boolean(server?.welcome_enabled));
    setWelcomeChannelId(server?.welcome_channel_id || textChannels[0]?.id || '');
    setWelcomeMessage(server?.welcome_message || DEFAULT_WELCOME_TEMPLATE);
  }, [server?.id, server?.welcome_enabled, server?.welcome_channel_id, server?.welcome_message]);

  const handleInsertVariable = (variableToken) => {
    setWelcomeMessage((prev) => {
      const base = prev || '';
      const spacer = base.length > 0 && !base.endsWith(' ') ? ' ' : '';
      return `${base}${spacer}${variableToken}`.slice(0, 2000);
    });
  };

  const selectedChannel =
    textChannels.find((ch) => Number(ch.id) === Number(welcomeChannelId)) || textChannels[0];

  const previewText = (() => {
    const raw = (welcomeMessage || '').trim() || DEFAULT_WELCOME_TEMPLATE;
    const sampleMention = '@NovoMembro';
    const rendered = raw
      .replace(/\{user\}/g, sampleMention)
      .replace(/\{server\}/g, server?.name || 'Servidor');
    return rendered.includes(sampleMention) ? rendered : `${sampleMention} ${rendered}`;
  })();

  const handleSaveWelcome = async (e) => {
    e.preventDefault();
    if (welcomeEnabled && !welcomeChannelId && !fallbackChannelId) {
      addToast('Crie ao menos um canal de texto para ativar as boas-vindas.', 'error');
      return;
    }

    try {
      setSaving(true);
      const targetChId = welcomeChannelId ? Number(welcomeChannelId) : (fallbackChannelId ? Number(fallbackChannelId) : null);
      const res = await fetch(`/api/v1/discord/servers/${server.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          welcome_enabled: Boolean(welcomeEnabled),
          welcome_channel_id: targetChId,
          welcome_message: (welcomeMessage || '').trim() || DEFAULT_WELCOME_TEMPLATE,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Falha ao salvar configurações de boas-vindas');
      }

      const updated = await res.json();
      onServerUpdated && onServerUpdated(updated);
      addToast(
        welcomeEnabled
          ? 'Sistema de boas-vindas ativado e salvo com sucesso!'
          : 'Configurações de boas-vindas salvas!',
        'success'
      );
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="server-tab-content" data-testid="server-welcome-tab">
      <h3 className="server-tab-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Sparkles size={20} style={{ color: '#5865f2' }} /> Sistema de Boas-Vindas
      </h3>
      <p className="server-tab-desc">
        Envie automaticamente uma mensagem marcando cada novo membro que entrar no servidor por link de convite.
      </p>

      <form onSubmit={handleSaveWelcome} className="server-settings-form">
        {/* Card Toggle Ativar / Desativar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            padding: '16px',
            borderRadius: '10px',
            backgroundColor: 'rgba(255, 255, 255, 0.04)',
            border: welcomeEnabled
              ? '1px solid rgba(88, 101, 242, 0.5)'
              : '1px solid rgba(255, 255, 255, 0.08)',
            marginBottom: '20px',
          }}
        >
          <div>
            <div style={{ color: '#f2f3f5', fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>
              Mensagem Automática de Boas-Vindas
            </div>
            <div style={{ color: '#949ba4', fontSize: '12px' }}>
              {welcomeEnabled
                ? 'Ativado — novos contatos serão marcados automaticamente ao entrar.'
                : 'Desativado — nenhuma mensagem automática será enviada ao entrar.'}
            </div>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={welcomeEnabled}
            data-testid="welcome-toggle-btn"
            onClick={() => setWelcomeEnabled((prev) => !prev)}
            style={{
              width: '48px',
              height: '26px',
              borderRadius: '999px',
              border: 'none',
              cursor: 'pointer',
              padding: '3px',
              backgroundColor: welcomeEnabled ? '#23a55a' : '#4e5058',
              display: 'flex',
              alignItems: 'center',
              justifyContent: welcomeEnabled ? 'flex-end' : 'flex-start',
              transition: 'background-color 0.2s ease',
              flexShrink: 0,
            }}
          >
            <span
              style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                backgroundColor: '#ffffff',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.35)',
              }}
            />
          </button>
        </div>

        {/* Seleção do Canal de Texto */}
        <div className="server-input-group" style={{ opacity: welcomeEnabled ? 1 : 0.65 }}>
          <label className="server-field-label" htmlFor="welcome-channel-select">
            Canal de Texto para Boas-Vindas
          </label>
          <div style={{ position: 'relative' }}>
            <select
              id="welcome-channel-select"
              className="discord-input"
              value={welcomeChannelId}
              onChange={(e) => setWelcomeChannelId(e.target.value)}
              data-testid="welcome-channel-select"
              style={{ width: '100%', cursor: 'pointer' }}
            >
              {textChannels.map((ch) => (
                <option key={ch.id} value={ch.id}>
                  #{ch.name}
                </option>
              ))}
            </select>
          </div>
          <span style={{ fontSize: '11px', color: '#949ba4', marginTop: '4px', display: 'block' }}>
            O novo membro será mencionado neste canal assim que aceitar o convite.
          </span>
        </div>

        {/* Template da Mensagem */}
        <div className="server-input-group" style={{ opacity: welcomeEnabled ? 1 : 0.65 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <label className="server-field-label" htmlFor="welcome-message-input" style={{ marginBottom: 0 }}>
              Mensagem de Boas-Vindas
            </label>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                onClick={() => handleInsertVariable('{user}')}
                data-testid="insert-var-user-btn"
                style={{
                  background: 'rgba(88, 101, 242, 0.18)',
                  color: '#93c5fd',
                  border: '1px solid rgba(88, 101, 242, 0.4)',
                  borderRadius: '6px',
                  padding: '2px 8px',
                  fontSize: '11px',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                + {'{user}'}
              </button>
              <button
                type="button"
                onClick={() => handleInsertVariable('{server}')}
                data-testid="insert-var-server-btn"
                style={{
                  background: 'rgba(88, 101, 242, 0.18)',
                  color: '#93c5fd',
                  border: '1px solid rgba(88, 101, 242, 0.4)',
                  borderRadius: '6px',
                  padding: '2px 8px',
                  fontSize: '11px',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                + {'{server}'}
              </button>
            </div>
          </div>

          <textarea
            id="welcome-message-input"
            className="discord-input"
            style={{ minHeight: '90px', resize: 'vertical' }}
            value={welcomeMessage}
            onChange={(e) => setWelcomeMessage(e.target.value)}
            maxLength={2000}
            placeholder={DEFAULT_WELCOME_TEMPLATE}
            data-testid="welcome-message-input"
          />
          <span style={{ fontSize: '11px', color: '#949ba4', marginTop: '4px', display: 'block' }}>
            Use <code>{'{user}'}</code> para marcar o novo membro e <code>{'{server}'}</code> para exibir o nome do servidor.
          </span>
        </div>

        {/* Pré-visualização em Tempo Real */}
        <div
          data-testid="welcome-preview-box"
          style={{
            padding: '14px 16px',
            borderRadius: '8px',
            backgroundColor: '#2b2d31',
            border: '1px solid rgba(255, 255, 255, 0.07)',
            marginBottom: '20px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#949ba4', marginBottom: '8px', textTransform: 'uppercase', fontWeight: 700 }}>
            <Hash size={13} /> Prévia em #{selectedChannel?.name || 'geral'}
          </div>
          <div style={{ color: '#dbdee1', fontSize: '14px', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
            {previewText}
          </div>
        </div>

        <div className="server-form-footer">
          <button
            type="submit"
            className="discord-btn discord-btn-primary"
            disabled={saving}
            data-testid="save-welcome-btn"
          >
            {saving ? <Loader2 size={16} className="spin-icon" /> : <Save size={16} />}
            {saving ? 'Salvando...' : 'Salvar Boas-Vindas'}
          </button>
        </div>
      </form>
    </div>
  );
}
