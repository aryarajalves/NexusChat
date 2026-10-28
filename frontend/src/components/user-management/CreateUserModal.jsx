import React, { useState, useEffect } from 'react';
import { X, UserPlus, Eye, EyeOff, Loader2 } from 'lucide-react';
import { createUserManualApi } from './userManagementApi';
import { useToast } from '../../context/ToastContext';

export default function CreateUserModal({ isOpen, onClose, onSuccess }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('user');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { addToast } = useToast();

  const resetForm = () => {
    setName('');
    setEmail('');
    setRole('user');
    setPassword('');
    setPasswordConfirm('');
    setShowPassword(false);
    setError('');
  };

  // Garante que o formulário sempre abra 100% limpo e sem resquícios
  useEffect(() => {
    if (isOpen) {
      resetForm();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Validação em tempo real dos requisitos de senha
  const passwordRules = {
    length: password.length >= 12,
    hasUpper: /[A-Z]/.test(password),
    hasLower: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecial: /[!@#$%^&*(),.?":{}|<>_\-+=[\]\\/`~]/.test(password),
  };

  const isPasswordValid = Object.values(passwordRules).every(Boolean);
  const doPasswordsMatch = password && passwordConfirm && password === passwordConfirm;

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Por favor, informe o nome do usuário.');
      return;
    }
    if (!email.trim()) {
      setError('Por favor, informe o e-mail do usuário.');
      return;
    }
    if (!isPasswordValid) {
      setError('A senha deve cumprir todos os requisitos de segurança abaixo.');
      return;
    }
    if (password !== passwordConfirm) {
      setError('As senhas digitadas não coincidem.');
      return;
    }

    setLoading(true);
    const token = localStorage.getItem('auth_token');

    try {
      const newUser = await createUserManualApi(
        {
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
          password_confirm: passwordConfirm,
          role,
        },
        token
      );

      addToast(`Conta criada com sucesso para ${newUser.name}!`, 'success');
      resetForm();
      if (onSuccess) {
        onSuccess(newUser);
      }
      onClose();
    } catch (err) {
      setError(err.message || 'Erro ao criar conta de usuário.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" data-testid="create-user-modal-overlay">
      <div
        className="modal-content"
        style={{
          maxWidth: '520px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          padding: '20px 24px',
        }}
      >
        {/* Cabeçalho Fixo do Modal */}
        <div className="modal-header" style={{ marginBottom: '14px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <UserPlus size={20} color="#0284c7" />
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>Criar Conta de Usuário</h3>
          </div>
          <button
            type="button"
            className="close-modal-btn"
            onClick={handleClose}
            data-testid="close-create-user-modal-btn"
            disabled={loading}
          >
            <X size={18} />
          </button>
        </div>

        {/* Formulário com rolagem independente se necessário */}
        <form
          onSubmit={handleSubmit}
          className="modal-form"
          autoComplete="off"
          data-testid="create-user-form"
          style={{
            overflowY: 'auto',
            paddingRight: '4px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            flex: 1,
          }}
        >
          {/* Iscas anti-preenchimento automático para navegadores (Chrome/Edge) */}
          <input
            type="text"
            name="prevent_browser_autofill_user"
            tabIndex="-1"
            style={{ position: 'absolute', opacity: 0, height: 0, width: 0, pointerEvents: 'none' }}
            aria-hidden="true"
            autoComplete="off"
          />
          <input
            type="password"
            name="prevent_browser_autofill_pwd"
            tabIndex="-1"
            style={{ position: 'absolute', opacity: 0, height: 0, width: 0, pointerEvents: 'none' }}
            aria-hidden="true"
            autoComplete="new-password"
          />

          {error && <div className="auth-error-banner" data-testid="create-user-error-banner">{error}</div>}

          {/* Nome */}
          <div className="form-group" style={{ gap: '4px' }}>
            <label htmlFor="create-user-name" style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
              Nome Completo
            </label>
            <input
              id="create-user-name"
              name="create_user_fullname_field"
              type="text"
              placeholder="Ex: João Silva"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={loading}
              autoComplete="off"
              data-testid="create-user-name-input"
            />
          </div>

          {/* E-mail */}
          <div className="form-group" style={{ gap: '4px' }}>
            <label htmlFor="create-user-email" style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
              E-mail
            </label>
            <input
              id="create-user-email"
              name="create_user_email_field"
              type="email"
              placeholder="Ex: joao@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              autoComplete="off"
              data-testid="create-user-email-input"
            />
          </div>

          {/* Perfil */}
          <div className="form-group" style={{ gap: '4px' }}>
            <label htmlFor="create-user-role" style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
              Perfil de Acesso
            </label>
            <select
              id="create-user-role"
              name="create_user_role_field"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              disabled={loading}
              data-testid="create-user-role-select"
            >
              <option value="user">Usuário comum</option>
              <option value="admin">Administrador (Admin)</option>
            </select>
            <small className="help-text" style={{ fontSize: '11.5px', color: '#64748b' }}>
              * O perfil Super Admin é exclusivo e não pode ser criado manualmente por aqui.
            </small>
          </div>

          {/* Senha */}
          <div className="form-group" style={{ gap: '4px' }}>
            <label htmlFor="create-user-password" style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
              Senha de Acesso
            </label>
            <div className="input-wrapper" style={{ position: 'relative' }}>
              <input
                id="create-user-password"
                name="create_user_password_field"
                type={showPassword ? 'text' : 'password'}
                placeholder="Digite uma senha forte"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                autoComplete="new-password"
                data-testid="create-user-password-input"
                style={{ paddingRight: '40px' }}
              />
              <button
                type="button"
                className="toggle-password-btn"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex="-1"
                data-testid="toggle-create-password-btn"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {/* Checklist Compacto de Requisitos de Senha */}
            <div className="password-rules-card" style={{ marginTop: '6px', padding: '8px 12px' }}>
              <span className="rules-title" style={{ marginBottom: '6px' }}>Requisitos de Segurança:</span>
              <ul
                className="rules-list"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
                  gap: '4px 8px',
                }}
              >
                <li className={passwordRules.length ? 'rule-met' : 'rule-unmet'} data-testid="rule-length">
                  <span className="rule-bullet">{passwordRules.length ? '✓' : '•'}</span>
                  <span>Mínimo de 12 caracteres</span>
                </li>
                <li className={passwordRules.hasUpper ? 'rule-met' : 'rule-unmet'} data-testid="rule-upper">
                  <span className="rule-bullet">{passwordRules.hasUpper ? '✓' : '•'}</span>
                  <span>Ao menos 1 maiúscula (A-Z)</span>
                </li>
                <li className={passwordRules.hasLower ? 'rule-met' : 'rule-unmet'} data-testid="rule-lower">
                  <span className="rule-bullet">{passwordRules.hasLower ? '✓' : '•'}</span>
                  <span>Ao menos 1 minúscula (a-z)</span>
                </li>
                <li className={passwordRules.hasNumber ? 'rule-met' : 'rule-unmet'} data-testid="rule-number">
                  <span className="rule-bullet">{passwordRules.hasNumber ? '✓' : '•'}</span>
                  <span>Ao menos 1 número (0-9)</span>
                </li>
                <li className={passwordRules.hasSpecial ? 'rule-met' : 'rule-unmet'} data-testid="rule-special">
                  <span className="rule-bullet">{passwordRules.hasSpecial ? '✓' : '•'}</span>
                  <span>1 caractere especial (!@#$...)</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Confirmar Senha */}
          <div className="form-group" style={{ gap: '4px' }}>
            <label htmlFor="create-user-password-confirm" style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
              Confirmar Senha
            </label>
            <input
              id="create-user-password-confirm"
              name="create_user_confirm_password_field"
              type={showPassword ? 'text' : 'password'}
              placeholder="Digite a senha novamente"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              required
              disabled={loading}
              autoComplete="new-password"
              data-testid="create-user-password-confirm-input"
            />
            {passwordConfirm && (
              <span className={doPasswordsMatch ? 'confirm-match-text' : 'confirm-mismatch-text'} data-testid="password-match-status">
                {doPasswordsMatch ? '✓ As senhas coincidem' : '✕ As senhas não coincidem'}
              </span>
            )}
          </div>

          {/* Ações do Modal */}
          <div className="modal-actions" style={{ marginTop: '12px', flexShrink: 0 }}>
            <button
              type="button"
              onClick={handleClose}
              className="cancel-btn"
              disabled={loading}
              data-testid="cancel-create-user-btn"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="primary-btn"
              disabled={loading || !isPasswordValid || !doPasswordsMatch || !name || !email}
              data-testid="submit-create-user-btn"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="spin-animation" />
                  <span>Criando Conta...</span>
                </>
              ) : (
                <>
                  <UserPlus size={16} />
                  <span>Criar Conta</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
