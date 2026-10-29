import React, { useState, useRef } from 'react';
import { Upload, User, Key, Check, X, Loader2, Save } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export default function UserAccountTab({ currentUser, onUserUpdated, token }) {
  const [name, setName] = useState(currentUser?.name || '');
  const [avatarUrl, setAvatarUrl] = useState(currentUser?.avatar_url || '');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  // Senha
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const fileInputRef = useRef(null);
  const { addToast } = useToast();

  // Validação de requisitos de senha em tempo real
  const rules = {
    length: newPassword.length >= 12,
    upper: /[A-Z]/.test(newPassword),
    lower: /[a-z]/.test(newPassword),
    number: /\d/.test(newPassword),
    special: /[\W_]/.test(newPassword),
    match: newPassword.length > 0 && newPassword === confirmPassword,
  };
  const isPasswordValid = rules.length && rules.upper && rules.lower && rules.number && rules.special && rules.match;

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      addToast('O nome não pode estar em branco.', 'error');
      return;
    }

    try {
      setSavingProfile(true);
      const res = await fetch('/api/v1/auth/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          avatar_url: avatarUrl || null,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Falha ao atualizar perfil');
      }

      const updated = await res.json();
      onUserUpdated && onUserUpdated(updated);
      addToast('Perfil atualizado com sucesso!', 'success');
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      setUploadingAvatar(true);
      const res = await fetch('/api/v1/auth/avatar', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Erro ao carregar avatar');
      }

      const data = await res.json();
      setAvatarUrl(data.avatar_url);
      onUserUpdated && onUserUpdated({ ...currentUser, avatar_url: data.avatar_url });
      addToast('Foto de perfil atualizada!', 'success');
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!currentPassword) {
      addToast('Informe a senha atual.', 'error');
      return;
    }
    if (!isPasswordValid) {
      addToast('A nova senha não atende a todos os critérios de segurança.', 'error');
      return;
    }

    try {
      setChangingPassword(true);
      const res = await fetch('/api/v1/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Erro ao alterar senha');
      }

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      addToast('Senha alterada com sucesso!', 'success');
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setChangingPassword(false);
    }
  };

  const userInitial = (name || currentUser?.name || 'U').charAt(0).toUpperCase();

  return (
    <div className="server-tab-content" data-testid="user-account-tab">
      <h3 className="server-tab-title">Minha Conta</h3>
      <p className="server-tab-desc">Gerencie suas informações de perfil, foto e segurança da conta.</p>

      {/* Cartão de Perfil */}
      <div className="user-profile-banner-card">
        <div className="user-profile-top-banner" />
        <div className="user-profile-main-box">
          <div className="user-avatar-upload-wrap">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="user-profile-avatar-img" data-testid="user-avatar-preview" />
            ) : (
              <div className="user-profile-avatar-placeholder" data-testid="user-avatar-placeholder">
                {userInitial}
              </div>
            )}
            <button
              type="button"
              className="user-avatar-edit-overlay"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingAvatar}
              title="Trocar avatar"
              data-testid="upload-avatar-btn"
            >
              {uploadingAvatar ? <Loader2 size={16} className="spin-icon" /> : <Upload size={16} />}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleAvatarUpload}
              data-testid="avatar-file-input"
            />
          </div>

          <div className="user-profile-header-text">
            <span className="user-profile-display-name">{name || 'Usuário'}</span>
            <span className="user-profile-email-badge">{currentUser?.email}</span>
          </div>
        </div>
      </div>

      {/* Formulário de Perfil */}
      <form onSubmit={handleSaveProfile} className="server-settings-form" style={{ marginTop: '20px' }}>
        <div className="server-input-group">
          <label className="server-field-label" htmlFor="user-name-input">Nome de Exibição *</label>
          <input
            id="user-name-input"
            type="text"
            className="discord-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            required
            data-testid="user-name-input"
          />
        </div>

        <div className="server-form-footer" style={{ justifyContent: 'flex-start' }}>
          <button
            type="submit"
            className="discord-btn discord-btn-primary"
            disabled={savingProfile}
            data-testid="save-profile-btn"
          >
            {savingProfile ? <Loader2 size={16} className="spin-icon" /> : <Save size={16} />}
            {savingProfile ? 'Salvando...' : 'Salvar Perfil'}
          </button>
        </div>
      </form>

      {/* Seção de Troca de Senha */}
      <div className="user-password-section" style={{ marginTop: '36px' }}>
        <h4 className="server-editor-title">Segurança & Alteração de Senha</h4>
        <form onSubmit={handleChangePassword} className="server-settings-form">
          <div className="server-input-group">
            <label className="server-field-label" htmlFor="current-pass-input">Senha Atual *</label>
            <input
              id="current-pass-input"
              type="password"
              className="discord-input"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Digite sua senha atual"
              required
              data-testid="current-password-input"
            />
          </div>

          <div className="server-images-row">
            <div className="server-input-group" style={{ flex: 1 }}>
              <label className="server-field-label" htmlFor="new-pass-input">Nova Senha *</label>
              <input
                id="new-pass-input"
                type="password"
                className="discord-input"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 12 caracteres"
                required
                data-testid="new-password-input"
              />
            </div>

            <div className="server-input-group" style={{ flex: 1 }}>
              <label className="server-field-label" htmlFor="confirm-pass-input">Confirmar Nova Senha *</label>
              <input
                id="confirm-pass-input"
                type="password"
                className="discord-input"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita a nova senha"
                required
                data-testid="confirm-password-input"
              />
            </div>
          </div>

          {/* Checklist de Segurança da Senha */}
          {newPassword && (
            <div className="password-rules-box" data-testid="password-rules-checklist">
              <span className={`pass-rule ${rules.length ? 'valid' : 'invalid'}`}>
                {rules.length ? <Check size={12} /> : <X size={12} />} Mínimo 12 caracteres
              </span>
              <span className={`pass-rule ${rules.upper ? 'valid' : 'invalid'}`}>
                {rules.upper ? <Check size={12} /> : <X size={12} />} Pelo menos 1 maiúscula
              </span>
              <span className={`pass-rule ${rules.lower ? 'valid' : 'invalid'}`}>
                {rules.lower ? <Check size={12} /> : <X size={12} />} Pelo menos 1 minúscula
              </span>
              <span className={`pass-rule ${rules.number ? 'valid' : 'invalid'}`}>
                {rules.number ? <Check size={12} /> : <X size={12} />} Pelo menos 1 número
              </span>
              <span className={`pass-rule ${rules.special ? 'valid' : 'invalid'}`}>
                {rules.special ? <Check size={12} /> : <X size={12} />} Pelo menos 1 caractere especial
              </span>
              <span className={`pass-rule ${rules.match ? 'valid' : 'invalid'}`}>
                {rules.match ? <Check size={12} /> : <X size={12} />} Senhas coincidem
              </span>
            </div>
          )}

          <div className="server-form-footer" style={{ justifyContent: 'flex-start' }}>
            <button
              type="submit"
              className="discord-btn discord-btn-primary"
              disabled={changingPassword || !isPasswordValid}
              data-testid="change-password-btn"
            >
              {changingPassword ? <Loader2 size={16} className="spin-icon" /> : <Key size={16} />}
              {changingPassword ? 'Atualizando...' : 'Atualizar Senha'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
