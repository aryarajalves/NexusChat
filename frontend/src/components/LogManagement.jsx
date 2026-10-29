import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Terminal, RefreshCw, Copy, Check, Filter, ArrowDown, Activity, Sun, Moon } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { LogTypeFilter, LogDateFilter, TerminalLogLine, classifyLogLine } from './log-management';

export default function LogManagement({ currentUser }) {
  // Apenas contêineres de backend e frontend (sem banco de dados postgres)
  const [services] = useState([
    { id: 'backend', name: 'Backend (FastAPI)', container: 'nexus_chat_backend' },
    { id: 'frontend', name: 'Frontend (Nginx / Vite)', container: 'nexus_chat_frontend' },
  ]);
  const [selectedService, setSelectedService] = useState('backend');
  const [tailLines, setTailLines] = useState(100);
  const [logs, setLogs] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [filterDate, setFilterDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const terminalEndRef = useRef(null);
  const { addToast } = useToast();

  const isDateFilterActive = Boolean(filterDate || startTime || endTime);

  const fetchLogs = async (silent = false, customParams = null) => {
    if (!silent) setLoading(true);
    const token = localStorage.getItem('auth_token');

    const dateParam = customParams ? customParams.filterDate : filterDate;
    const startParam = customParams ? customParams.startTime : startTime;
    const endParam = customParams ? customParams.endTime : endTime;

    let url = `/api/v1/logs/${selectedService}?tail=${tailLines}`;
    if (dateParam) url += `&date=${encodeURIComponent(dateParam)}`;
    if (startParam) url += `&start_time=${encodeURIComponent(startParam)}`;
    if (endParam) url += `&end_time=${encodeURIComponent(endParam)}`;

    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setLogs(data.logs || []);
      } else {
        throw new Error(data.detail || 'Erro ao carregar logs.');
      }
    } catch (err) {
      if (!silent) {
        addToast(err.message || 'Erro ao carregar logs.', 'error');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [selectedService, tailLines]);

  // Auto-refresh a cada 4 segundos se habilitado (apenas quando não há filtro de data histórica ativa)
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchLogs(true);
    }, 4000);
    return () => clearInterval(interval);
  }, [autoRefresh, selectedService, tailLines, filterDate, startTime, endTime]);

  const handleApplyDateFilter = () => {
    fetchLogs(false);
    addToast('Buscando logs pelo período especificado...', 'info');
  };

  const handleClearDateFilter = () => {
    setFilterDate('');
    setStartTime('');
    setEndTime('');
    fetchLogs(false, { filterDate: '', startTime: '', endTime: '' });
  };

  // Classifica todas as linhas e converte para Horário de Brasília
  const parsedLogs = useMemo(() => {
    return logs.map((line) => classifyLogLine(line, isDarkMode));
  }, [logs, isDarkMode]);

  // Contagens para os botões de separação por tipo
  const counts = useMemo(() => {
    const summary = { all: parsedLogs.length, info: 0, warning: 0, error: 0, http: 0 };
    parsedLogs.forEach((item) => {
      if (summary[item.type] !== undefined) {
        summary[item.type] += 1;
      }
    });
    return summary;
  }, [parsedLogs]);

  // Filtra por tipo e por termo de busca
  const filteredLogs = useMemo(() => {
    return parsedLogs.filter((item) => {
      const matchesType = selectedType === 'all' || item.type === selectedType;
      const matchesSearch = searchTerm
        ? item.formattedLine.toLowerCase().includes(searchTerm.toLowerCase())
        : true;
      return matchesType && matchesSearch;
    });
  }, [parsedLogs, selectedType, searchTerm]);

  const handleCopyLogs = () => {
    if (filteredLogs.length === 0) return;
    const textToCopy = filteredLogs.map((item) => item.formattedLine).join('\n');
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    addToast('Logs copiados para a área de transferência!', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  const scrollToBottom = () => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="backup-page-container" data-testid="log-management-page">
      {/* Cabeçalho */}
      <div className="backup-page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h1>Gerenciamento de logs</h1>
        </div>
        <p>Acompanhe e diagnostique logs por contêiner, data e horário de Brasília.</p>
      </div>

      {/* Seleção de Serviço / Contêiner (Sem PostgreSQL) */}
      <div className="sub-tabs-container">
        {services.map((srv) => (
          <button
            key={srv.id}
            type="button"
            className={`sub-tab-btn ${selectedService === srv.id ? 'active' : ''}`}
            onClick={() => {
              setSelectedService(srv.id);
              setSelectedType('all');
            }}
            data-testid={`tab-service-${srv.id}`}
          >
            <Terminal size={16} />
            <span>{srv.name}</span>
          </button>
        ))}
      </div>

      {/* Barra de Filtro de Data e Horário */}
      <LogDateFilter
        selectedDate={filterDate}
        onDateChange={setFilterDate}
        startTime={startTime}
        onStartTimeChange={setStartTime}
        endTime={endTime}
        onEndTimeChange={setEndTime}
        onApplyFilter={handleApplyDateFilter}
        onClearFilter={handleClearDateFilter}
        isActive={isDateFilterActive}
      />

      {/* Barra de Ferramentas / Controles do Log */}
      <div className="table-card" style={{ marginBottom: '12px', borderRadius: '10px', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)' }}>
        <div className="table-toolbar" style={{ flexWrap: 'wrap', gap: '12px' }}>
          {/* Busca de texto */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 250px' }}>
            <Filter size={15} color="#64748b" />
            <input
              type="text"
              placeholder="Filtrar por texto nos logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '7px 12px',
                borderRadius: '8px',
                border: '1px solid #3f4147',
                backgroundColor: '#1e1f22',
                color: '#f2f3f5',
                fontSize: '13px',
              }}
              data-testid="log-search-input"
            />
          </div>

          {/* Quantidade de Linhas */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label htmlFor="tail-select" style={{ fontSize: '13px', fontWeight: 600, color: '#dbdee1' }}>
              Linhas:
            </label>
            <select
              id="tail-select"
              value={tailLines}
              onChange={(e) => setTailLines(Number(e.target.value))}
              style={{
                padding: '6px 10px',
                borderRadius: '8px',
                border: '1px solid #3f4147',
                backgroundColor: '#1e1f22',
                color: '#f2f3f5',
                fontSize: '13px',
                fontWeight: 500,
              }}
              data-testid="log-tail-select"
            >
              <option value={50}>50 linhas</option>
              <option value={100}>100 linhas</option>
              <option value={200}>200 linhas</option>
              <option value={500}>500 linhas</option>
            </select>
          </div>

          {/* Auto Refresh Toggle */}
          <button
            type="button"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className="pagination-btn"
            style={autoRefresh ? { backgroundColor: '#dcfce7', borderColor: '#86efac', color: '#166534' } : {}}
            data-testid="toggle-autorefresh-btn"
            title="Atualização automática a cada 4s"
          >
            <Activity size={15} className={autoRefresh ? 'pulse-icon' : ''} />
            <span>{autoRefresh ? 'Auto (Ligado)' : 'Auto (Desligado)'}</span>
          </button>

          {/* Botão Alternar Tema do Terminal */}
          <button
            type="button"
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="pagination-btn"
            data-testid="toggle-terminal-theme-btn"
            title="Alternar entre modo claro e escuro"
          >
            {isDarkMode ? <Sun size={15} color="#d97706" /> : <Moon size={15} color="#64748b" />}
            <span>{isDarkMode ? 'Tema Claro' : 'Tema Escuro'}</span>
          </button>

          {/* Botão Atualizar Manual */}
          <button
            type="button"
            onClick={() => fetchLogs()}
            disabled={loading}
            className="pagination-btn"
            data-testid="refresh-logs-btn"
          >
            <RefreshCw size={15} className={loading ? 'spin-animation' : ''} />
            <span>Atualizar</span>
          </button>

          {/* Botão Copiar */}
          <button
            type="button"
            onClick={handleCopyLogs}
            disabled={filteredLogs.length === 0}
            className="pagination-btn"
            data-testid="copy-logs-btn"
          >
            {copied ? <Check size={15} color="#16a34a" /> : <Copy size={15} />}
            <span>{copied ? 'Copiado' : 'Copiar'}</span>
          </button>

          {/* Botão Rolar para o fim */}
          <button
            type="button"
            onClick={scrollToBottom}
            className="pagination-btn"
            data-testid="scroll-bottom-btn"
            title="Rolar para o final do terminal"
          >
            <ArrowDown size={15} />
            <span>Fim</span>
          </button>
        </div>
      </div>

      {/* Separação por Tipo de Log */}
      <LogTypeFilter
        currentFilter={selectedType}
        onSelectFilter={setSelectedType}
        counts={counts}
      />

      {/* Terminal View Container */}
      <div
        className="terminal-view-card"
        data-testid="terminal-container"
        style={{
          backgroundColor: isDarkMode ? '#0f172a' : '#ffffff',
          borderRadius: '12px',
          border: isDarkMode ? '1px solid #1e293b' : '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          transition: 'all 0.2s ease',
        }}
      >
        {/* Terminal Header Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 16px',
            backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc',
            borderBottom: isDarkMode ? '1px solid #334155' : '1px solid #e2e8f0',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#ef4444' }}></span>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#f59e0b' }}></span>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#10b981' }}></span>
            <span style={{ color: isDarkMode ? '#94a3b8' : '#475569', fontSize: '12px', fontWeight: 600, marginLeft: '8px' }}>
              docker logs --tail {tailLines} {services.find((s) => s.id === selectedService)?.container}
              {filterDate && ` [${filterDate}${startTime ? ` ${startTime}` : ''}${endTime ? ` - ${endTime}` : ''}]`}
            </span>
          </div>
          <span style={{ color: '#64748b', fontSize: '12px' }}>
            {filteredLogs.length} linha(s) {(searchTerm || selectedType !== 'all') && `(filtrado de ${logs.length})`}
          </span>
        </div>

        {/* Terminal Body com Linhas Coloridas e Badges */}
        <div
          style={{
            padding: '14px',
            maxHeight: '520px',
            minHeight: '320px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
            backgroundColor: isDarkMode ? '#0f172a' : '#ffffff',
          }}
          data-testid="terminal-logs-body"
        >
          {loading && logs.length === 0 ? (
            <div style={{ color: isDarkMode ? '#94a3b8' : '#64748b', textAlign: 'center', padding: '40px 0', fontFamily: 'monospace' }}>
              Carregando logs do contêiner...
            </div>
          ) : filteredLogs.length === 0 ? (
            <div style={{ color: isDarkMode ? '#64748b' : '#94a3b8', textAlign: 'center', padding: '40px 0', fontFamily: 'monospace' }}>
              {isDateFilterActive || searchTerm || selectedType !== 'all'
                ? 'Nenhum log encontrado para o período ou filtro informado.'
                : 'Nenhum log registrado para este contêiner.'}
            </div>
          ) : (
            filteredLogs.map((item, index) => (
              <TerminalLogLine key={index} parsed={item} index={index} isDarkMode={isDarkMode} />
            ))
          )}
          <div ref={terminalEndRef} />
        </div>
      </div>
    </div>
  );
}
