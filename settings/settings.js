import { getSettings, saveSettings } from '../lib/storage.js';

const activeProviderEl = document.getElementById('active-provider');
const activeModelEl = document.getElementById('active-model');
const providerListEl = document.getElementById('provider-list');
const addProviderBtn = document.getElementById('btn-add-provider');
const saveBtn = document.getElementById('btn-save');
const statusEl = document.getElementById('status');
const importBtn = document.getElementById('btn-import');
const jsonImportEl = document.getElementById('json-import');
const importStatusEl = document.getElementById('import-status');
const variablesListEl = document.getElementById('variables-list');
const addVarBtn = document.getElementById('btn-add-var');

let settings = null;

// --- Render active selectors ---

function renderActiveSelectors() {
  activeProviderEl.innerHTML = '';
  for (const [id, p] of Object.entries(settings.providers)) {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = p.name;
    activeProviderEl.appendChild(opt);
  }
  activeProviderEl.value = settings.activeProvider;
  renderModelSelector();
}

function renderModelSelector() {
  activeModelEl.innerHTML = '';
  const provider = settings.providers[activeProviderEl.value];
  if (!provider) return;
  for (const m of provider.models) {
    const opt = document.createElement('option');
    opt.value = m;
    opt.textContent = m;
    activeModelEl.appendChild(opt);
  }
  // Try to keep current model if it exists in new provider
  if (provider.models.includes(settings.activeModel)) {
    activeModelEl.value = settings.activeModel;
  } else {
    activeModelEl.value = provider.models[0] || '';
  }
}

activeProviderEl.addEventListener('change', () => {
  settings.activeProvider = activeProviderEl.value;
  renderModelSelector();
});

activeModelEl.addEventListener('change', () => {
  settings.activeModel = activeModelEl.value;
});

// --- Render provider cards ---

function renderProviders() {
  providerListEl.innerHTML = '';
  for (const [id, provider] of Object.entries(settings.providers)) {
    providerListEl.appendChild(createProviderCard(id, provider));
  }
}

function createProviderCard(id, provider) {
  const card = document.createElement('div');
  card.className = 'provider-card';
  card.dataset.id = id;

  // Header
  const header = document.createElement('div');
  header.className = 'provider-card-header';
  header.innerHTML = `
    <div class="provider-title">
      <span class="chevron">▶</span>
      <span class="name-label">${provider.name}</span>
      <span class="badge">${provider.type}</span>
    </div>
    <div class="provider-actions">
      <button class="btn-small btn-danger btn-delete">Delete</button>
    </div>
  `;

  header.querySelector('.provider-title').addEventListener('click', () => {
    card.classList.toggle('open');
  });

  header.querySelector('.btn-delete').addEventListener('click', () => {
    delete settings.providers[id];
    if (settings.activeProvider === id) {
      const keys = Object.keys(settings.providers);
      settings.activeProvider = keys[0] || '';
      settings.activeModel = '';
    }
    renderProviders();
    renderActiveSelectors();
  });

  // Body
  const body = document.createElement('div');
  body.className = 'provider-card-body';

  body.innerHTML = `
    <div class="row">
      <div class="field">
        <label>Name</label>
        <input type="text" class="p-name" value="${esc(provider.name)}">
      </div>
      <div class="field">
        <label>Type (API format)</label>
        <select class="p-type">
          <option value="openai" ${provider.type === 'openai' ? 'selected' : ''}>OpenAI-compatible</option>
          <option value="anthropic" ${provider.type === 'anthropic' ? 'selected' : ''}>Anthropic</option>
        </select>
      </div>
    </div>
    <div class="field">
      <label>Base URL</label>
      <input type="text" class="p-baseurl" value="${esc(provider.baseUrl)}" placeholder="https://api.openai.com/v1">
    </div>
    <div class="field">
      <label>API Key</label>
      <div class="password-wrap">
        <input type="password" class="p-apikey" value="${esc(provider.apiKey)}" placeholder="Leave empty if using headers">
        <button type="button" class="btn-eye" title="Toggle visibility">👁</button>
      </div>
    </div>
    <div class="field">
      <label>Custom Headers</label>
      <div class="headers-list"></div>
      <button class="btn-small btn-secondary btn-add-header" style="margin-top:4px">+ Add Header</button>
    </div>
    <div class="field">
      <label>Models</label>
      <div class="models-list"></div>
      <div class="add-model-row">
        <input type="text" class="new-model-input" placeholder="model-name">
        <button class="btn-small btn-add-model">Add</button>
      </div>
    </div>
  `;

  // Bind inputs to settings
  const sync = () => {
    provider.name = body.querySelector('.p-name').value;
    provider.type = body.querySelector('.p-type').value;
    provider.baseUrl = body.querySelector('.p-baseurl').value;
    provider.apiKey = body.querySelector('.p-apikey').value;

    // Update header label
    header.querySelector('.name-label').textContent = provider.name;
    header.querySelector('.badge').textContent = provider.type;
  };

  body.querySelector('.p-name').addEventListener('input', sync);
  body.querySelector('.p-type').addEventListener('change', sync);
  body.querySelector('.p-baseurl').addEventListener('input', sync);

  body.querySelector('.btn-eye').addEventListener('click', (e) => {
    const input = body.querySelector('.p-apikey');
    input.type = input.type === 'password' ? 'text' : 'password';
  });
  body.querySelector('.p-apikey').addEventListener('input', sync);

  // Headers
  const headersList = body.querySelector('.headers-list');
  function renderHeaders() {
    headersList.innerHTML = '';
    for (const [key, val] of Object.entries(provider.headers || {})) {
      const row = document.createElement('div');
      row.className = 'header-row';
      row.innerHTML = `
        <input type="text" class="h-key" value="${esc(key)}" placeholder="Header name">
        <input type="text" class="h-val" value="${esc(val)}" placeholder="Header value">
        <button class="btn-small btn-remove">×</button>
      `;
      const oldKey = key;
      const syncHeader = () => {
        const newKey = row.querySelector('.h-key').value;
        const newVal = row.querySelector('.h-val').value;
        delete provider.headers[oldKey];
        if (newKey) provider.headers[newKey] = newVal;
      };
      row.querySelector('.h-key').addEventListener('input', syncHeader);
      row.querySelector('.h-val').addEventListener('input', syncHeader);
      row.querySelector('.btn-remove').addEventListener('click', () => {
        delete provider.headers[row.querySelector('.h-key').value || oldKey];
        renderHeaders();
      });
      headersList.appendChild(row);
    }
  }
  renderHeaders();

  body.querySelector('.btn-add-header').addEventListener('click', () => {
    provider.headers = provider.headers || {};
    provider.headers[''] = '';
    renderHeaders();
    // Focus last key input
    const inputs = headersList.querySelectorAll('.h-key');
    if (inputs.length) inputs[inputs.length - 1].focus();
  });

  // Models
  const modelsList = body.querySelector('.models-list');
  function renderModels() {
    modelsList.innerHTML = '';
    for (const m of provider.models) {
      const tag = document.createElement('span');
      tag.className = 'model-tag';
      tag.innerHTML = `${esc(m)} <span class="remove-model">×</span>`;
      tag.querySelector('.remove-model').addEventListener('click', () => {
        provider.models = provider.models.filter((x) => x !== m);
        renderModels();
      });
      modelsList.appendChild(tag);
    }
  }
  renderModels();

  const addModelInput = body.querySelector('.new-model-input');
  const addModelBtn = body.querySelector('.btn-add-model');
  const addModel = () => {
    const name = addModelInput.value.trim();
    if (name && !provider.models.includes(name)) {
      provider.models.push(name);
      renderModels();
      addModelInput.value = '';
    }
  };
  addModelBtn.addEventListener('click', addModel);
  addModelInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addModel(); }
  });

  card.appendChild(header);
  card.appendChild(body);
  return card;
}

function esc(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// --- Add provider ---

addProviderBtn.addEventListener('click', () => {
  const id = 'provider-' + Date.now();
  settings.providers[id] = {
    name: 'New Provider',
    type: 'openai',
    baseUrl: '',
    apiKey: '',
    headers: {},
    models: [],
  };
  renderProviders();
  renderActiveSelectors();
  // Open the new card
  const lastCard = providerListEl.lastElementChild;
  if (lastCard) lastCard.classList.add('open');
});

// --- Variables ---

function renderVariables() {
  variablesListEl.innerHTML = '';
  for (const [key, val] of Object.entries(settings.variables || {})) {
    variablesListEl.appendChild(createVarRow(key, val));
  }
}

function createVarRow(key, val) {
  const row = document.createElement('div');
  row.className = 'header-row';

  const keyInput = document.createElement('input');
  keyInput.type = 'text';
  keyInput.value = key;
  keyInput.placeholder = 'VAR_NAME';

  const valInput = document.createElement('input');
  valInput.type = 'password';
  valInput.value = val;
  valInput.placeholder = 'value';

  const removeBtn = document.createElement('button');
  removeBtn.className = 'btn-small btn-remove';
  removeBtn.textContent = '×';

  const syncVar = () => {
    // Remove old key, set new
    const vars = {};
    for (const r of variablesListEl.children) {
      const k = r.querySelector('input:first-child').value.trim();
      const v = r.querySelectorAll('input')[1].value;
      if (k) vars[k] = v;
    }
    settings.variables = vars;
  };

  keyInput.addEventListener('input', syncVar);
  valInput.addEventListener('input', syncVar);
  removeBtn.addEventListener('click', () => {
    row.remove();
    syncVar();
  });

  const valWrap = document.createElement('div');
  valWrap.className = 'password-wrap';
  valWrap.style.flex = '1';

  const eyeBtn = document.createElement('button');
  eyeBtn.type = 'button';
  eyeBtn.className = 'btn-eye';
  eyeBtn.title = 'Toggle visibility';
  eyeBtn.textContent = '\u{1F441}';
  eyeBtn.addEventListener('click', () => {
    valInput.type = valInput.type === 'password' ? 'text' : 'password';
  });

  valWrap.appendChild(valInput);
  valWrap.appendChild(eyeBtn);

  row.appendChild(keyInput);
  row.appendChild(valWrap);
  row.appendChild(removeBtn);
  return row;
}

addVarBtn.addEventListener('click', () => {
  settings.variables = settings.variables || {};
  variablesListEl.appendChild(createVarRow('', ''));
  const inputs = variablesListEl.querySelectorAll('input:first-child');
  if (inputs.length) inputs[inputs.length - 1].focus();
});

// --- Import JSON ---

importBtn.addEventListener('click', async () => {
  try {
    const raw = jsonImportEl.value.trim();
    if (!raw) return;
    const data = JSON.parse(raw);

    // Normalize: support top-level "provider" key (opencode format) or "providers"
    const rawProviders = data.providers || data.provider || {};

    for (const [id, p] of Object.entries(rawProviders)) {
      // Detect API type from npm field or explicit type
      let type = p.type || 'openai';
      if (!p.type && p.npm) {
        type = p.npm.includes('anthropic') ? 'anthropic' : 'openai';
      }

      // Extract baseUrl from options.baseURL, options.baseUrl, or top-level
      const baseUrl = p.baseUrl || p.base_url
        || (p.options && (p.options.baseURL || p.options.baseUrl))
        || '';

      // Extract apiKey from options.apiKey or top-level
      const apiKey = p.apiKey || p.api_key
        || (p.options && p.options.apiKey)
        || '';

      // Extract custom headers from options (skip baseURL and apiKey)
      const headers = { ...(p.headers || {}) };
      if (p.options) {
        for (const [k, v] of Object.entries(p.options)) {
          if (!['baseURL', 'baseUrl', 'apiKey', 'api_key'].includes(k)) {
            headers[k] = v;
          }
        }
      }

      // Extract models: array, or object keys
      let models;
      if (Array.isArray(p.models)) {
        models = p.models;
      } else if (p.models && typeof p.models === 'object') {
        models = Object.keys(p.models);
      } else {
        models = [];
      }

      settings.providers[id] = { name: p.name || id, type, baseUrl, apiKey, headers, models };
    }

    renderProviders();
    renderActiveSelectors();
    jsonImportEl.value = '';

    // Auto-save after import
    settings.activeProvider = activeProviderEl.value;
    settings.activeModel = activeModelEl.value;
    await saveSettings(settings);
    showImportStatus('Imported & saved!', false);
  } catch (err) {
    showImportStatus('Invalid JSON: ' + err.message, true);
  }
});

function showImportStatus(msg, isError) {
  importStatusEl.textContent = msg;
  importStatusEl.className = isError ? 'status error' : 'status';
  importStatusEl.classList.remove('hidden');
  setTimeout(() => importStatusEl.classList.add('hidden'), 3000);
}

// --- Save ---

saveBtn.addEventListener('click', async () => {
  settings.activeProvider = activeProviderEl.value;
  settings.activeModel = activeModelEl.value;
  await saveSettings(settings);
  statusEl.classList.remove('hidden');
  setTimeout(() => statusEl.classList.add('hidden'), 2000);
});

// --- Init ---

(async () => {
  settings = await getSettings();
  renderProviders();
  renderActiveSelectors();
  renderVariables();
})();
