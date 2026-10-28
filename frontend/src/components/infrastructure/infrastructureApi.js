/**
 * Chamadas de API para o painel de Infraestrutura & Recursos
 */

export async function getInfrastructureOverviewApi(token) {
  const activeToken = token || localStorage.getItem('auth_token') || localStorage.getItem('token');
  const res = await fetch('/api/v1/infrastructure/overview', {
    headers: {
      Authorization: `Bearer ${activeToken}`,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Falha ao obter métricas de infraestrutura.');
  }
  return res.json();
}

export async function getAlertConfigApi(token) {
  const activeToken = token || localStorage.getItem('auth_token') || localStorage.getItem('token');
  const res = await fetch('/api/v1/infrastructure/alerts/config', {
    headers: {
      Authorization: `Bearer ${activeToken}`,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Falha ao carregar configurações de alertas.');
  }
  return res.json();
}

export async function updateAlertConfigApi(payload, token) {
  const activeToken = token || localStorage.getItem('auth_token') || localStorage.getItem('token');
  const res = await fetch('/api/v1/infrastructure/alerts/config', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${activeToken}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Erro ao salvar configurações de alertas.');
  }
  return res.json();
}

export async function testWebhookApi(webhookUrl, token) {
  const activeToken = token || localStorage.getItem('auth_token') || localStorage.getItem('token');
  const res = await fetch('/api/v1/infrastructure/alerts/test', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${activeToken}`,
    },
    body: JSON.stringify({ webhook_url: webhookUrl }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || data.message || 'Falha ao disparar webhook de teste.');
  }
  return data;
}
