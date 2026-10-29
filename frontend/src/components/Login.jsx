import React, { useState } from 'react';
import { Eye, EyeOff, Lock, Mail, AlertCircle, ArrowRight } from 'lucide-react';
import loginBanner from '../assets/login-banner.jpg';
import { useToast } from '../context/ToastContext';

export default function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { addToast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMsg = data.detail || 'Email ou senha incorretos';
        addToast(errorMsg, 'error');
        throw new Error(errorMsg);
      }

      localStorage.setItem('auth_token', data.access_token);
      localStorage.setItem('auth_user', JSON.stringify(data.user));
      addToast(`Bem-vindo, ${data.user.name}!`, 'success');
      if (onLoginSuccess) {
        onLoginSuccess(data.user, data.access_token);
      }
    } catch (err) {
      setError(err.message || 'Erro ao realizar login.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-split-page">
      {/* Coluna da Esquerda: Formulário de Login */}
      <div className="login-form-side">
        <div className="login-form-container">
          <div className="auth-header text-left">
            <div className="auth-logo-badge">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
            <h2>NexusChat</h2>
            <p>Informe suas credenciais para acessar o painel</p>
          </div>

          {error && (
            <div className="auth-error-banner" data-testid="login-error">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label htmlFor="login-email">E-mail</label>
              <div className="input-wrapper">
                <Mail className="input-icon" size={18} />
                <input
                  id="login-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seuemail@exemplo.com"
                  data-testid="login-email-input"
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="login-password">Senha</label>
              <div className="input-wrapper">
                <Lock className="input-icon" size={18} />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Digite sua senha"
                  data-testid="login-password-input"
                />
                <button
                  type="button"
                  className="toggle-password-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  data-testid="toggle-password-visibility"
                  title={showPassword ? 'Ocultar senha' : 'Ver senha'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="auth-submit-btn"
              disabled={loading}
              data-testid="login-submit-btn"
            >
              {loading ? 'Entrando...' : (
                <>
                  <span>Entrar no Sistema</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Coluna da Direita: Banner Ilustrativo Moderno e Otimizado */}
      <div className="login-image-side">
        <div className="image-overlay-card">
          <img
            src={loginBanner}
            alt="NexusChat Dashboard"
            className="login-feature-img"
            loading="eager"
            fetchPriority="high"
            decoding="async"
          />
          <div className="image-caption">
            <h3>Gerenciamento Centralizado</h3>
            <p>Acesse suas ferramentas e gerencie sua equipe com segurança e alto desempenho.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
