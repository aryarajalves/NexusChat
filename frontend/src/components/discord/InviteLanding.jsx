import React, { useState, useEffect } from 'react';
import { Users, Loader2, AlertCircle, LogIn, CheckCircle2 } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export default function InviteLanding({
  inviteCode,
  currentUser,
  token,
  onJoinSuccess,
  onNavigateLogin,
}) {
  const [inviteInfo, setInviteInfo] = useState(null);
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');
  const { addToast } = useToast();

  useEffect(() => {
    let isMounted = true;

    const fetchInviteDetails = async () => {
      try {
        setLoadingInfo(true);
        setError('');
        const res = await fetch(`/api/v1/discord/invites/${inviteCode}`);
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.detail || 'Convite inválido ou expirado');
        }
        const data = await res.json();
        if (isMounted) {
          setInviteInfo(data);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'Não foi possível carregar os detalhes do convite.');
        }
      } finally {
        if (isMounted) {
          setLoadingInfo(false);
        }
      }
    };

    if (inviteCode) {
      fetchInviteDetails();
    }

    return () => {
      isMounted = false;
    };
  }, [inviteCode]);

  const handleJoinServer = async () => {
    if (!token) {
      if (onNavigateLogin) {
        onNavigateLogin();
      }
      return;
    }

    try {
      setJoining(true);
      const res = await fetch(`/api/v1/discord/invites/${inviteCode}/join`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || 'Não foi possível entrar no servidor');
      }

      const joinedServer = await res.json();
      addToast(`Você entrou em ${joinedServer.name}!`, 'success');
      sessionStorage.removeItem('pending_server_invite');
      if (onJoinSuccess) {
        onJoinSuccess(joinedServer);
      }
    } catch (err) {
      addToast(err.message || 'Erro ao aceitar convite.', 'error');
    } finally {
      setJoining(false);
    }
  };

  const getInitial = (name) => {
    return (name || 'S').trim().charAt(0).toUpperCase();
  };

  return (
    <div
      className="invite-landing-page"
      style={{
        minHeight: '100vh',
        width: '100vw',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#111214',
        backgroundImage: 'radial-gradient(circle at 50% 30%, #1e1f24 0%, #0f1012 100%)',
        padding: '20px',
        boxSizing: 'border-box',
      }}
      data-testid="invite-landing-container"
    >
      <div
        className="invite-card"
        style={{
          background: '#313338',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '16px',
          padding: '36px 32px',
          width: '100%',
          maxWidth: '460px',
          textAlign: 'center',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.65)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          animation: 'modal-pop 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {loadingInfo ? (
          <div style={{ padding: '40px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
            <Loader2 size={36} className="spin-animation" color="#5865f2" />
            <span style={{ color: '#949ba4', fontSize: '14px' }}>Carregando dados do convite...</span>
          </div>
        ) : error ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'rgba(242, 63, 67, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#f23f43',
              }}
            >
              <AlertCircle size={32} />
            </div>
            <h3 style={{ color: '#f2f3f5', fontSize: '20px', fontWeight: 700, margin: 0 }} data-testid="invite-error-title">
              Convite Inválido
            </h3>
            <p style={{ color: '#949ba4', fontSize: '14px', lineHeight: '1.5', margin: 0 }} data-testid="invite-error-desc">
              {error}
            </p>
            <button
              type="button"
              className="primary-btn"
              style={{ marginTop: '10px' }}
              onClick={() => {
                window.location.href = '/';
              }}
              data-testid="back-to-home-btn"
            >
              Voltar ao Início
            </button>
          </div>
        ) : (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {/* Ícone do Servidor */}
            <div style={{ marginBottom: '16px' }}>
              {inviteInfo.server_icon ? (
                <img
                  src={inviteInfo.server_icon}
                  alt={inviteInfo.server_name}
                  style={{
                    width: '80px',
                    height: '80px',
                    borderRadius: '24px',
                    objectFit: 'cover',
                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
                  }}
                />
              ) : (
                <div
                  style={{
                    width: '80px',
                    height: '80px',
                    borderRadius: '24px',
                    backgroundColor: '#5865f2',
                    color: '#ffffff',
                    fontSize: '32px',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 8px 24px rgba(88, 101, 242, 0.35)',
                  }}
                  data-testid="server-initial-avatar"
                >
                  {getInitial(inviteInfo.server_name)}
                </div>
              )}
            </div>

            {/* Chamada do convite */}
            <span
              style={{
                fontSize: '13px',
                fontWeight: 600,
                color: '#949ba4',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginBottom: '4px',
              }}
            >
              Você foi convidado para entrar em
            </span>

            <h2
              style={{
                fontSize: '24px',
                fontWeight: 800,
                color: '#f2f3f5',
                margin: '0 0 10px 0',
                wordBreak: 'break-word',
              }}
              data-testid="server-invite-title"
            >
              {inviteInfo.server_name}
            </h2>

            {/* Informações de membros */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                background: 'rgba(0, 0, 0, 0.25)',
                padding: '6px 14px',
                borderRadius: '20px',
                fontSize: '13px',
                color: '#dbdee1',
                marginBottom: '28px',
              }}
            >
              <Users size={16} color="#23a55a" />
              <span>{inviteInfo.members_count || 1} Membro(s)</span>
            </div>

            {/* Ação Principal */}
            {currentUser && token ? (
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <button
                  type="button"
                  onClick={handleJoinServer}
                  disabled={joining || inviteInfo.is_expired}
                  className="primary-btn"
                  style={{
                    width: '100%',
                    justifyContent: 'center',
                    padding: '13px',
                    fontSize: '15px',
                    borderRadius: '8px',
                  }}
                  data-testid="accept-invite-btn"
                >
                  {joining ? (
                    <>
                      <Loader2 size={18} className="spin-animation" />
                      <span>Entrando no servidor...</span>
                    </>
                  ) : inviteInfo.is_expired ? (
                    <span>Este convite expirou</span>
                  ) : (
                    <>
                      <CheckCircle2 size={18} />
                      <span>Aceitar Convite</span>
                    </>
                  )}
                </button>

                <div style={{ fontSize: '12.5px', color: '#949ba4' }}>
                  Conectado como <strong style={{ color: '#f2f3f5' }}>{currentUser.name}</strong>
                </div>
              </div>
            ) : (
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <button
                  type="button"
                  onClick={handleJoinServer}
                  className="primary-btn"
                  style={{
                    width: '100%',
                    justifyContent: 'center',
                    padding: '13px',
                    fontSize: '15px',
                    borderRadius: '8px',
                  }}
                  data-testid="login-to-join-btn"
                >
                  <LogIn size={18} />
                  <span>Fazer Login para Entrar</span>
                </button>
                <span style={{ fontSize: '13px', color: '#949ba4' }}>
                  Você precisa estar logado para aceitar este convite.
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
