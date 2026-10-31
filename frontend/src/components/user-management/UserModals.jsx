import React from 'react';
import { X, ShieldCheck, Check, Copy, KeyRound, Mail, UserCog } from 'lucide-react';

export function CreateInviteModal({
  isOpen,
  onClose,
  onSubmit,
  error,
  inviteRole,
  setInviteRole,
  expireHours,
  setExpireHours,
  generatedInvite,
  copied,
  onCopy,
  onFinish,
  onRedirect,
}) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-content">
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div className="modal-header-badge">
              <Mail size={20} />
            </div>
            <div>
              <h3>Gerar Link de Convite</h3>
              <p style={{ fontSize: '12.5px', color: '#949ba4', margin: '2px 0 0 0' }}>
                Crie um convite seguro com perfil e tempo de expiração definidos.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="close-modal-btn"
            onClick={onClose}
            data-testid="close-modal-btn"
          >
            <X size={18} />
          </button>
        </div>

        {!generatedInvite ? (
          <form onSubmit={onSubmit} className="modal-form">
            {error && <div className="auth-error-banner">{error}</div>}

            <div className="form-group">
              <label htmlFor="invite-role">Tipo de Usuário</label>
              <select
                id="invite-role"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                data-testid="invite-role-select"
              >
                <option value="user">Usuário comum</option>
                <option value="admin">Administrador (Admin)</option>
              </select>
              <small className="help-text">
                * O perfil Super Admin não pode ser criado via convite.
              </small>
            </div>

            <div className="form-group">
              <label htmlFor="expire-hours">Tempo para expirar</label>
              <select
                id="expire-hours"
                value={expireHours}
                onChange={(e) => setExpireHours(e.target.value)}
                data-testid="expire-hours-select"
              >
                <option value="1">1 hora</option>
                <option value="6">6 horas</option>
                <option value="12">12 horas</option>
                <option value="24">24 horas (1 dia)</option>
                <option value="48">48 horas (2 dias)</option>
                <option value="168">7 dias</option>
              </select>
            </div>

            <div className="modal-actions">
              <button
                type="button"
                onClick={onClose}
                className="cancel-btn"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="primary-btn"
                data-testid="generate-invite-submit-btn"
              >
                Gerar Convite
              </button>
            </div>
          </form>
        ) : (
          <div className="generated-invite-view">
            <div className="invite-success-badge">
              <ShieldCheck size={28} />
              <h4>Link de convite criado com sucesso!</h4>
              <p>
                Perfil: <strong>{generatedInvite.role === 'admin' ? 'Admin' : 'Usuário'}</strong> | 
                Expira em <strong>{expireHours} hora(s)</strong>
              </p>
            </div>

            <div className="invite-link-box">
              <input
                type="text"
                readOnly
                value={generatedInvite.fullUrl}
                data-testid="generated-link-input"
              />
              <button
                type="button"
                onClick={onCopy}
                className="copy-btn"
                data-testid="copy-invite-btn"
              >
                {copied ? <Check size={18} /> : <Copy size={18} />}
                <span>{copied ? 'Copiado!' : 'Copiar'}</span>
              </button>
            </div>

            <div className="modal-actions">
              <a
                href={generatedInvite.fullUrl}
                className="primary-btn redirect-link-btn"
                data-testid="open-invite-page-link"
                onClick={onRedirect}
              >
                Acessar Tela de Cadastro
              </a>
              <button
                type="button"
                onClick={onFinish}
                className="cancel-btn"
                data-testid="close-invite-modal-btn"
              >
                Fechar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function EditUserRoleModal({
  isOpen,
  onClose,
  editingUser,
  selectedRole,
  setSelectedRole,
  onSave,
}) {
  if (!isOpen || !editingUser) return null;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-content">
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div className="modal-header-badge">
              <UserCog size={20} />
            </div>
            <div>
              <h3>Alterar Perfil de Acesso</h3>
              <p style={{ fontSize: '12.5px', color: '#949ba4', margin: '2px 0 0 0' }}>
                Modifique as permissões de acesso deste usuário.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="close-modal-btn"
            onClick={onClose}
            data-testid="close-edit-modal-btn"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={onSave} className="modal-form">
          <div className="user-details-summary">
            <p><strong>Nome:</strong> {editingUser.name}</p>
            <p><strong>E-mail:</strong> {editingUser.email}</p>
          </div>

          <div className="form-group">
            <label htmlFor="user-role-select">Tipo de Usuário</label>
            <select
              id="user-role-select"
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              data-testid="edit-role-select"
            >
              <option value="user">Usuário comum</option>
              <option value="admin">Administrador (Admin)</option>
            </select>
            <small className="help-text">
              * O perfil Super Admin não pode ser atribuído a outros usuários.
            </small>
          </div>

          <div className="modal-actions">
            <button
              type="button"
              onClick={onClose}
              className="cancel-btn"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="primary-btn"
              data-testid="save-role-btn"
            >
              Salvar Alteração
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function ResetPasswordModal({
  isOpen,
  onClose,
  resetData,
  resetCopied,
  onCopyResetLink,
  onRedirect,
}) {
  if (!isOpen || !resetData) return null;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-content">
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div className="modal-header-badge">
              <KeyRound size={20} />
            </div>
            <div>
              <h3>Link de Redefinição de Senha</h3>
              <p style={{ fontSize: '12.5px', color: '#949ba4', margin: '2px 0 0 0' }}>
                Envie este link seguro para o usuário redefinir sua senha.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="close-modal-btn"
            onClick={onClose}
            data-testid="close-reset-modal-btn"
          >
            <X size={18} />
          </button>
        </div>

        <div className="generated-invite-view">
          <div className="invite-success-badge">
            <KeyRound size={28} />
            <h4>Link de redefinição gerado com sucesso!</h4>
            <p>
              Usuário: <strong>{resetData.user_name}</strong> ({resetData.user_email})
            </p>
            <small>Este link é seguro e expira em 24 horas.</small>
          </div>

          <div className="invite-link-box">
            <input
              type="text"
              readOnly
              value={resetData.fullUrl}
              data-testid="generated-reset-link-input"
            />
            <button
              type="button"
              onClick={onCopyResetLink}
              className="copy-btn"
              data-testid="copy-reset-link-btn"
            >
              {resetCopied ? <Check size={18} /> : <Copy size={18} />}
              <span>{resetCopied ? 'Copiado!' : 'Copiar'}</span>
            </button>
          </div>

          <div className="modal-actions">
            <a
              href={resetData.fullUrl}
              className="primary-btn redirect-link-btn"
              data-testid="open-reset-page-link"
              onClick={onRedirect}
            >
              Acessar Tela de Redefinição
            </a>
            <button
              type="button"
              onClick={onClose}
              className="cancel-btn"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
