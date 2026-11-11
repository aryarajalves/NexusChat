import React, { useState } from 'react';
import { Radio, Mic, MicOff, Hand, HandMetal, Check, X, Users, VolumeX, ShieldAlert } from 'lucide-react';

export default function StageModerationBar({
  channel,
  isStage = false,
  isModerator = false,
  isSpeaker = false,
  handRaised = false,
  handsRaised = [],
  grantedSpeakers = [],
  participants = [],
  currentUser,
  onRaiseHand,
  onGrantSpeak,
  onRevokeSpeak,
}) {
  const [showHandsModal, setShowHandsModal] = useState(false);

  if (!isStage && channel?.type !== 'STAGE') {
    return null;
  }

  // Identifica alunos com mão levantada
  const raisedStudents = participants.filter((p) => {
    const uid = Number(p.user_id || p.id);
    return handsRaised.map(Number).includes(uid);
  });

  return (
    <div className="stage-moderation-bar" data-testid="stage-moderation-bar">
      {/* Lado Esquerdo: Identificação do Canal de Aula */}
      <div className="stage-mod-badge">
        <Radio size={16} className="stage-mod-radio-icon" />
        <span className="stage-mod-title">Palco / Aula</span>
        {isModerator ? (
          <span className="stage-role-pill moderator">Professor / Admin</span>
        ) : isSpeaker ? (
          <span className="stage-role-pill speaker">Orador Autorizado</span>
        ) : (
          <span className="stage-role-pill audience">Ouvinte</span>
        )}
      </div>

      {/* Centro / Ações do Aluno */}
      {!isModerator && !isSpeaker && (
        <div className="stage-audience-action">
          <button
            type="button"
            className={`stage-raise-hand-btn ${handRaised ? 'raised' : ''}`}
            onClick={onRaiseHand}
            data-testid="stage-raise-hand-btn"
          >
            <Hand size={16} />
            <span>{handRaised ? '✋ Abaixar Mão' : '✋ Pedir para Falar'}</span>
          </button>
          {handRaised && (
            <span className="stage-hand-waiting-label" data-testid="stage-waiting-label">
              Aguardando o professor liberar a palavra...
            </span>
          )}
        </div>
      )}

      {/* Centro / Aluno no Palco */}
      {!isModerator && isSpeaker && (
        <div className="stage-speaker-notice" data-testid="stage-speaker-notice">
          <Mic size={15} color="#23a55a" />
          <span>Você está no palco! O microfone está liberado para você falar.</span>
        </div>
      )}

      {/* Lado Direito: Moderação do Professor */}
      {isModerator && (
        <div className="stage-moderator-controls">
          {handsRaised.length > 0 ? (
            <button
              type="button"
              className="stage-hands-queue-btn active"
              onClick={() => setShowHandsModal((p) => !p)}
              data-testid="stage-hands-queue-btn"
              title="Alunos pedindo para falar"
            >
              <Hand size={16} />
              <span>{handsRaised.length} na fila de dúvidas</span>
            </button>
          ) : (
            <span className="stage-no-hands-label">Nenhum aluno com a mão levantada</span>
          )}

          {/* Popover / Modal da Fila de Mãos Levantadas */}
          {showHandsModal && (
            <div className="stage-hands-popover" data-testid="stage-hands-popover">
              <div className="stage-hands-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Hand size={16} color="#faa61a" />
                  <strong>Pedidos para Falar ({raisedStudents.length})</strong>
                </div>
                <button
                  type="button"
                  className="stage-popover-close"
                  onClick={() => setShowHandsModal(false)}
                >
                  <X size={14} />
                </button>
              </div>

              <div className="stage-hands-list">
                {raisedStudents.length === 0 ? (
                  <div className="stage-empty-hands">Nenhum pedido pendente no momento.</div>
                ) : (
                  raisedStudents.map((st) => {
                    const uid = Number(st.user_id || st.id);
                    return (
                      <div key={uid} className="stage-hand-item" data-testid={`stage-hand-item-${uid}`}>
                        <div className="stage-hand-user-info">
                          {st.avatar_url ? (
                            <img src={st.avatar_url} alt="" className="stage-hand-avatar" />
                          ) : (
                            <div className="stage-hand-avatar-fallback">
                              {(st.user_name || 'A').charAt(0).toUpperCase()}
                            </div>
                          )}
                          <span className="stage-hand-name">{st.user_name || st.name}</span>
                        </div>
                        <div className="stage-hand-item-actions">
                          <button
                            type="button"
                            className="stage-btn-allow"
                            onClick={() => {
                              onGrantSpeak?.(uid);
                              if (raisedStudents.length <= 1) setShowHandsModal(false);
                            }}
                            title="Permitir que este aluno fale"
                            data-testid={`stage-allow-speak-${uid}`}
                          >
                            <Mic size={14} />
                            <span>Permitir</span>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
