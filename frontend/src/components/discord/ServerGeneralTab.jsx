import React, { useState, useRef } from 'react';
import { Upload, Image as ImageIcon, Save, Loader2 } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export default function ServerGeneralTab({ server, onServerUpdated, token }) {
  const [name, setName] = useState(server?.name || '');
  const [description, setDescription] = useState(server?.description || '');
  const [iconUrl, setIconUrl] = useState(server?.icon_url || '');
  const [bannerUrl, setBannerUrl] = useState(server?.banner_url || '');
  const [saving, setSaving] = useState(false);
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);

  const iconInputRef = useRef(null);
  const bannerInputRef = useRef(null);
  const { addToast } = useToast();

  const handleSaveInfo = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      addToast('O nome do servidor é obrigatório.', 'error');
      return;
    }

    try {
      setSaving(true);
      const res = await fetch(`/api/v1/discord/servers/${server.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          icon_url: iconUrl || null,
          banner_url: bannerUrl || null,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Falha ao salvar servidor');
      }

      const updated = await res.json();
      onServerUpdated && onServerUpdated(updated);
      addToast('Configurações do servidor salvas com sucesso!', 'success');
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleIconUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      setUploadingIcon(true);
      const res = await fetch(`/api/v1/discord/servers/${server.id}/icon`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Erro ao carregar ícone');
      }

      const data = await res.json();
      setIconUrl(data.icon_url);
      onServerUpdated && onServerUpdated({ ...server, icon_url: data.icon_url });
      addToast('Ícone do servidor atualizado!', 'success');
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setUploadingIcon(false);
    }
  };

  const handleBannerUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      setUploadingBanner(true);
      const res = await fetch(`/api/v1/discord/servers/${server.id}/banner`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Erro ao carregar banner');
      }

      const data = await res.json();
      setBannerUrl(data.banner_url);
      onServerUpdated && onServerUpdated({ ...server, banner_url: data.banner_url });
      addToast('Banner do servidor atualizado!', 'success');
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setUploadingBanner(false);
    }
  };

  const serverInitial = (name || server?.name || 'S').charAt(0).toUpperCase();

  return (
    <div className="server-tab-content" data-testid="server-general-tab">
      <h3 className="server-tab-title">Visão Geral do Servidor</h3>
      <p className="server-tab-desc">Altere o nome e personalize o visual do seu servidor.</p>

      <form onSubmit={handleSaveInfo} className="server-settings-form">
        {/* Imagens do Servidor: Ícone e Banner */}
        <div className="server-images-row">
          {/* Ícone */}
          <div className="server-image-box">
            <span className="server-field-label">Ícone do Servidor</span>
            <div className="server-icon-preview-wrap">
              {iconUrl ? (
                <img src={iconUrl} alt="Ícone do servidor" className="server-icon-preview-img" data-testid="server-icon-preview" />
              ) : (
                <div className="server-icon-preview-placeholder" data-testid="server-icon-placeholder">
                  {serverInitial}
                </div>
              )}
              <button
                type="button"
                className="server-upload-btn"
                onClick={() => iconInputRef.current?.click()}
                disabled={uploadingIcon}
                data-testid="upload-icon-btn"
              >
                {uploadingIcon ? <Loader2 size={14} className="spin-icon" /> : <Upload size={14} />}
                {uploadingIcon ? 'Enviando...' : 'Mudar Ícone'}
              </button>
              <input
                ref={iconInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleIconUpload}
                data-testid="icon-file-input"
              />
            </div>
          </div>

          {/* Banner */}
          <div className="server-image-box" style={{ flex: 1 }}>
            <span className="server-field-label">Banner do Servidor</span>
            <div className="server-banner-preview-wrap">
              {bannerUrl ? (
                <img src={bannerUrl} alt="Banner do servidor" className="server-banner-preview-img" data-testid="server-banner-preview" />
              ) : (
                <div className="server-banner-preview-placeholder" data-testid="server-banner-placeholder">
                  <ImageIcon size={28} opacity={0.6} />
                  <span>Nenhum banner configurado</span>
                </div>
              )}
              <button
                type="button"
                className="server-upload-btn"
                onClick={() => bannerInputRef.current?.click()}
                disabled={uploadingBanner}
                data-testid="upload-banner-btn"
              >
                {uploadingBanner ? <Loader2 size={14} className="spin-icon" /> : <Upload size={14} />}
                {uploadingBanner ? 'Enviando...' : 'Mudar Banner'}
              </button>
              <input
                ref={bannerInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleBannerUpload}
                data-testid="banner-file-input"
              />
            </div>
          </div>
        </div>

        {/* Nome do Servidor */}
        <div className="server-input-group">
          <label className="server-field-label" htmlFor="server-name-input">Nome do Servidor *</label>
          <input
            id="server-name-input"
            type="text"
            className="discord-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            required
            data-testid="server-name-input"
          />
        </div>

        {/* Descrição */}
        <div className="server-input-group">
          <label className="server-field-label" htmlFor="server-desc-input">Descrição do Servidor</label>
          <textarea
            id="server-desc-input"
            className="discord-input"
            style={{ minHeight: '70px', resize: 'vertical' }}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={255}
            placeholder="Conte um pouco sobre a sua comunidade..."
            data-testid="server-desc-input"
          />
        </div>

        <div className="server-form-footer">
          <button
            type="submit"
            className="discord-btn discord-btn-primary"
            disabled={saving}
            data-testid="save-general-btn"
          >
            {saving ? <Loader2 size={16} className="spin-icon" /> : <Save size={16} />}
            {saving ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </div>
      </form>
    </div>
  );
}
