async function callOpenAICompatible(messages, provider, model, signal) {
  const url = `${provider.baseUrl.replace(/\/$/, '')}/chat/completions`;

  const headers = {
    'Content-Type': 'application/json',
    ...provider.headers,
  };
  if (provider.apiKey) {
    headers['Authorization'] = `Bearer ${provider.apiKey}`;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ model, messages }),
    signal,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `${provider.name} error ${res.status}`);
  }

  const data = await res.json();
  return data.choices[0].message.content;
}

async function callAnthropicCompatible(messages, provider, model, signal) {
  const url = `${provider.baseUrl.replace(/\/$/, '')}/v1/messages`;

  const headers = {
    'Content-Type': 'application/json',
    'anthropic-version': '2023-06-01',
    'anthropic-dangerous-direct-browser-access': 'true',
    ...provider.headers,
  };
  if (provider.apiKey) {
    headers['x-api-key'] = provider.apiKey;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ model, max_tokens: 4096, messages }),
    signal,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `${provider.name} error ${res.status}`);
  }

  const data = await res.json();
  return data.content[0].text;
}

export async function sendMessage(chatHistory, settings, { signal } = {}) {
  const { providers, activeProvider, activeModel, variables } = settings;
  const rawProvider = providers[activeProvider];

  if (!rawProvider) {
    throw new Error(`Provider "${activeProvider}" not found. Open Settings to configure.`);
  }

  const vars = variables || {};
  const provider = {
    ...rawProvider,
    baseUrl: resolveVars(rawProvider.baseUrl, vars),
    apiKey: resolveVars(rawProvider.apiKey, vars),
    headers: Object.fromEntries(
      Object.entries(rawProvider.headers || {}).map(([k, v]) => [k, resolveVars(v, vars)])
    ),
  };

  if (!provider.apiKey && !Object.keys(provider.headers).length) {
    throw new Error(`No API key or auth headers for "${provider.name}". Open Settings.`);
  }

  const messages = chatHistory.map(({ role, content }) => ({ role, content }));

  if (provider.type === 'anthropic') {
    return callAnthropicCompatible(messages, provider, activeModel, signal);
  } else {
    return callOpenAICompatible(messages, provider, activeModel, signal);
  }
}

function resolveVars(str, variables) {
  if (!str || typeof str !== 'string') return str;
  return str.replace(/\$\{(\w+)\}/g, (match, name) => variables[name] !== undefined ? variables[name] : match);
}
