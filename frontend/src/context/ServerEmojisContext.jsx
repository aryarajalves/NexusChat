import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

const ServerEmojisContext = createContext({
  emojis: [],
  emojisMap: {},
  loading: false,
  refreshEmojis: () => {},
});

export function ServerEmojisProvider({ children, serverId }) {
  const [emojis, setEmojis] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchEmojis = useCallback(async () => {
    if (!serverId) {
      setEmojis([]);
      return;
    }
    const token = localStorage.getItem('auth_token');
    try {
      setLoading(true);
      const res = await fetch(`/api/v1/discord/servers/${serverId}/emojis`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setEmojis(Array.isArray(data) ? data : []);
      }
    } catch {
      // Ignora erro de rede silenciosamente
    } finally {
      setLoading(false);
    }
  }, [serverId]);

  useEffect(() => {
    fetchEmojis();
  }, [fetchEmojis]);

  const emojisMap = useMemo(() => {
    const map = {};
    if (Array.isArray(emojis)) {
      emojis.forEach((e) => {
        if (e && e.name) {
          map[e.name.toLowerCase()] = e;
        }
      });
    }
    return map;
  }, [emojis]);

  const value = useMemo(
    () => ({
      emojis,
      emojisMap,
      loading,
      refreshEmojis: fetchEmojis,
    }),
    [emojis, emojisMap, loading, fetchEmojis]
  );

  return (
    <ServerEmojisContext.Provider value={value}>
      {children}
    </ServerEmojisContext.Provider>
  );
}

export function useServerEmojis() {
  return useContext(ServerEmojisContext);
}
