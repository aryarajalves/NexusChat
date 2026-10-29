import { useState, useEffect, useCallback } from 'react';

export function useDiscordNavigation({ token, servers, setServers, channels, setChannels, setMembers }) {
  // 1. activeServerId: null = DMs, number = server ID
  const [activeServerId, setActiveServerId] = useState(() => {
    const saved = localStorage.getItem('discord_active_server_id');
    if (!saved || saved === 'dms') return null;
    const num = parseInt(saved, 10);
    return isNaN(num) ? null : num;
  });

  // 2. activeChannelId: number = channel ID
  const [activeChannelId, setActiveChannelId] = useState(() => {
    const savedServer = localStorage.getItem('discord_active_server_id');
    const saved = savedServer && savedServer !== 'dms'
      ? (localStorage.getItem(`discord_active_channel_${savedServer}`) || localStorage.getItem('discord_active_channel_id'))
      : localStorage.getItem('discord_active_channel_id');
    if (!saved) return null;
    const num = parseInt(saved, 10);
    return isNaN(num) ? null : num;
  });

  // Handler para selecionar servidor (ou DMs se null)
  const handleSelectServer = useCallback((serverId) => {
    setActiveServerId(serverId);
    if (serverId === null) {
      localStorage.setItem('discord_active_server_id', 'dms');
    } else {
      localStorage.setItem('discord_active_server_id', String(serverId));
      const savedChannel = localStorage.getItem(`discord_active_channel_${serverId}`);
      if (savedChannel) {
        const num = parseInt(savedChannel, 10);
        if (!isNaN(num)) {
          setActiveChannelId(num);
          localStorage.setItem('discord_active_channel_id', String(num));
        }
      }
    }
  }, []);

  // Handler para selecionar canal
  const handleSelectChannel = useCallback((channelId, onVoiceConnect) => {
    const ch = channels.find((c) => c.id === channelId);
    if (ch && ch.type === 'VOICE' && onVoiceConnect) {
      onVoiceConnect(channelId);
    }
    setActiveChannelId(channelId);
    localStorage.setItem('discord_active_channel_id', String(channelId));
    if (activeServerId !== null) {
      localStorage.setItem(`discord_active_channel_${activeServerId}`, String(channelId));
    }
  }, [channels, activeServerId]);

  // Carrega servidores e sincroniza servidor ativo persistido
  useEffect(() => {
    if (!token) return;
    fetch('/api/v1/discord/servers', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        setServers(data);
        const savedServer = localStorage.getItem('discord_active_server_id');
        if (savedServer === 'dms') {
          setActiveServerId(null);
        } else if (savedServer) {
          const parsedId = parseInt(savedServer, 10);
          if (data.some((s) => s.id === parsedId)) {
            setActiveServerId(parsedId);
          } else if (data.length > 0) {
            setActiveServerId(data[0].id);
            localStorage.setItem('discord_active_server_id', String(data[0].id));
          } else {
            setActiveServerId(null);
          }
        } else if (data.length > 0) {
          setActiveServerId(data[0].id);
          localStorage.setItem('discord_active_server_id', String(data[0].id));
        }
      })
      .catch((err) => console.error('Erro ao buscar servidores:', err));
  }, [token, setServers]);

  // Carrega canais e membros do servidor ativo com restauração de canal
  useEffect(() => {
    if (!activeServerId) {
      setChannels([]);
      setActiveChannelId(null);
      setMembers([]);
      return;
    }
    Promise.all([
      fetch(`/api/v1/discord/servers/${activeServerId}/channels`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`/api/v1/discord/servers/${activeServerId}/members`, { headers: { Authorization: `Bearer ${token}` } }),
    ]).then(async ([chRes, memRes]) => {
      if (chRes.ok) {
        const chData = await chRes.json();
        setChannels(chData);
        if (chData.length > 0) {
          const savedChId = localStorage.getItem(`discord_active_channel_${activeServerId}`)
            || localStorage.getItem('discord_active_channel_id');
          const parsedChId = savedChId ? parseInt(savedChId, 10) : null;
          const matchingCh = parsedChId ? chData.find((c) => c.id === parsedChId) : null;
          if (matchingCh) {
            setActiveChannelId(matchingCh.id);
          } else {
            const defaultCh = (chData.find((c) => c.type === 'TEXT') || chData[0]);
            setActiveChannelId(defaultCh.id);
            localStorage.setItem('discord_active_channel_id', String(defaultCh.id));
            localStorage.setItem(`discord_active_channel_${activeServerId}`, String(defaultCh.id));
          }
        }
      }
      if (memRes.ok) setMembers(await memRes.json());
    }).catch((err) => console.error('Erro ao carregar canais/membros:', err));
  }, [activeServerId, token, setChannels, setMembers]);

  return {
    activeServerId,
    setActiveServerId,
    activeChannelId,
    setActiveChannelId,
    handleSelectServer,
    handleSelectChannel,
  };
}
