import React from 'react';
import { MessageSquare, Users, Server, Terminal, Database, ArrowRight, Sparkles } from 'lucide-react';

/**
 * Tela de boas-vindas exibida na área principal quando a barra lateral está aberta
 * e nenhuma aba secundária foi selecionada, substituindo o fundo preto vazio
 * por uma apresentação visual moderna e refinada no estilo Glassmorphism / Neon.
 */
export default function DashboardWelcome({ user, onSelectTab }) {
  const isSuperAdmin = user?.role === 'superadmin';
  const userName = user?.name || 'Usuário';

  const quickActions = isSuperAdmin
    ? [
        { id: 'users', label: 'Gestão de Usuários', desc: 'Controle de contas e convites', icon: Users, color: '#3b82f6' },
        { id: 'infrastructure', label: 'Infraestrutura', desc: 'Hardware, banco e métricas', icon: Server, color: '#10b981' },
        { id: 'logs', label: 'Logs do Sistema', desc: 'Auditoria e diagnósticos em tempo real', icon: Terminal, color: '#f59e0b' },
        { id: 'backup', label: 'Backups', desc: 'Snapshots locais e nuvem B2', icon: Database, color: '#8b5cf6' },
      ]
    : [];

  return (
    <div
      className="dashboard-welcome-container"
      data-testid="dashboard-welcome-container"
      style={{
        width: '100%',
        height: '100%',
        minHeight: '100vh',
        backgroundColor: '#0f1012',
        backgroundImage: 'radial-gradient(circle at 50% 30%, rgba(88, 101, 242, 0.12) 0%, transparent 65%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 24px',
        boxSizing: 'border-box',
        color: '#f2f3f5',
        overflowY: 'auto',
      }}
    >
      <div
        className="dashboard-welcome-card"
        data-testid="dashboard-welcome-card"
        style={{
          width: '100%',
          maxWidth: '680px',
          backgroundColor: 'rgba(26, 27, 30, 0.75)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '20px',
          padding: '40px 36px',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.6), 0 0 40px rgba(88, 101, 242, 0.08)',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        {/* Badge superior */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 14px',
            borderRadius: '999px',
            backgroundColor: 'rgba(88, 101, 242, 0.12)',
            border: '1px solid rgba(88, 101, 242, 0.3)',
            color: '#818cf8',
            fontSize: '12px',
            fontWeight: 600,
            marginBottom: '20px',
            letterSpacing: '0.3px',
          }}
        >
          <Sparkles size={14} />
          <span>Plataforma NexusChat Ativa</span>
        </div>

        {/* Título e Boas-Vindas */}
        <h1
          style={{
            fontSize: '28px',
            fontWeight: 800,
            margin: '0 0 10px 0',
            background: 'linear-gradient(135deg, #ffffff 40%, #94a3b8 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            letterSpacing: '-0.5px',
          }}
        >
          Olá, {userName}!
        </h1>

        <p
          style={{
            fontSize: '14px',
            color: '#949ba4',
            lineHeight: 1.6,
            maxWidth: '520px',
            margin: '0 0 28px 0',
          }}
        >
          Seja bem-vindo à central do NexusChat. Você pode interagir em tempo real com as suas comunidades
          ou utilizar as ferramentas de administração e gestão no painel lateral.
        </p>

        {/* Botão de Destaque Principal: Ir para o Discord */}
        <button
          type="button"
          onClick={() => onSelectTab && onSelectTab('discord')}
          data-testid="welcome-enter-discord-btn"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            padding: '14px 28px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #5865f2 0%, #4752c4 100%)',
            color: '#ffffff',
            fontSize: '15px',
            fontWeight: 700,
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 8px 24px rgba(88, 101, 242, 0.35)',
            transition: 'all 0.2s ease',
            width: '100%',
            maxWidth: '340px',
            marginBottom: isSuperAdmin ? '32px' : '0',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 12px 28px rgba(88, 101, 242, 0.45)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 8px 24px rgba(88, 101, 242, 0.35)';
          }}
        >
          <MessageSquare size={18} />
          <span>Acessar Comunidades (Discord)</span>
          <ArrowRight size={16} />
        </button>

        {/* Atalhos rápidos para o Super Admin */}
        {isSuperAdmin && (
          <div style={{ width: '100%', borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '24px' }}>
            <span
              style={{
                display: 'block',
                fontSize: '11px',
                fontWeight: 700,
                color: '#64748b',
                textTransform: 'uppercase',
                letterSpacing: '0.8px',
                marginBottom: '14px',
              }}
            >
              Atalhos Rápidos de Gestão
            </span>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                gap: '12px',
                width: '100%',
              }}
            >
              {quickActions.map((action) => {
                const IconComponent = action.icon;
                return (
                  <button
                    key={action.id}
                    type="button"
                    onClick={() => onSelectTab && onSelectTab(action.id)}
                    data-testid={`quick-action-${action.id}`}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '14px 10px',
                      backgroundColor: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid rgba(255, 255, 255, 0.05)',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      color: '#dbdee1',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                      e.currentTarget.style.borderColor = action.color;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)';
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.05)';
                    }}
                  >
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        backgroundColor: `${action.color}15`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: action.color,
                      }}
                    >
                      <IconComponent size={16} />
                    </div>
                    <span style={{ fontSize: '12px', fontWeight: 600 }}>{action.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
