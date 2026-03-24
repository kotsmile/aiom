import { getSettings, getChatHistory, saveChatHistory, clearChatHistory, getPendingMessage, clearPendingMessage } from '../lib/storage.js';
import { sendMessage } from '../lib/providers.js';

const chatEl = document.getElementById('chat-messages');
const inputEl = document.getElementById('input');
const sendBtn = document.getElementById('btn-send');
const stopBtn = document.getElementById('btn-stop');
const clearBtn = document.getElementById('btn-clear');
const settingsBtn = document.getElementById('btn-settings');
const banner = document.getElementById('banner');
const bannerLink = document.getElementById('banner-link');
const modelLabel = document.getElementById('model-label');

let history = [];
let settings = null;
let sending = false;
let abortController = null;

function renderMessage(msg) {
  const div = document.createElement('div');
  div.className = `message ${msg.role}`;
  div.textContent = msg.content;
  chatEl.appendChild(div);
  chatEl.scrollTop = chatEl.scrollHeight;
  return div;
}

function renderHistory() {
  chatEl.innerHTML = '';
  for (const msg of history) {
    renderMessage(msg);
  }
}

function setSending(value) {
  sending = value;
  sendBtn.disabled = value;
  if (value) {
    sendBtn.classList.add('hidden');
    stopBtn.classList.remove('hidden');
  } else {
    sendBtn.classList.remove('hidden');
    stopBtn.classList.add('hidden');
  }
}

async function handleSend() {
  const text = inputEl.value.trim();
  if (!text || sending) return;

  setSending(true);
  abortController = new AbortController();
  inputEl.value = '';
  autoResize();

  const userMsg = { role: 'user', content: text, timestamp: Date.now() };
  history.push(userMsg);
  renderMessage(userMsg);
  await saveChatHistory(history);

  const typingDiv = document.createElement('div');
  typingDiv.className = 'message typing';
  typingDiv.textContent = 'Thinking...';
  chatEl.appendChild(typingDiv);
  chatEl.scrollTop = chatEl.scrollHeight;

  try {
    const reply = await sendMessage(history, settings, { signal: abortController.signal });
    typingDiv.remove();

    const assistantMsg = { role: 'assistant', content: reply, timestamp: Date.now() };
    history.push(assistantMsg);
    renderMessage(assistantMsg);
    await saveChatHistory(history);
  } catch (err) {
    typingDiv.remove();
    if (err.name === 'AbortError') {
      renderMessage({ role: 'error', content: 'Stopped.' });
    } else {
      renderMessage({ role: 'error', content: err.message });
    }
  }

  abortController = null;
  setSending(false);
  inputEl.focus();
}

function handleStop() {
  if (abortController) {
    abortController.abort();
  }
}

function autoResize() {
  inputEl.style.height = 'auto';
  inputEl.style.height = Math.min(inputEl.scrollHeight, 80) + 'px';
}

function openSettings() {
  chrome.tabs.create({ url: chrome.runtime.getURL('settings/settings.html') });
}

function updateModelLabel() {
  const provider = settings.providers[settings.activeProvider];
  if (provider) {
    modelLabel.textContent = `${provider.name} / ${settings.activeModel}`;
  } else {
    modelLabel.textContent = 'No provider';
  }
}

// Event listeners
sendBtn.addEventListener('click', handleSend);
stopBtn.addEventListener('click', handleStop);

inputEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
});

inputEl.addEventListener('input', autoResize);
clearBtn.addEventListener('click', async () => {
  history = [];
  await clearChatHistory();
  renderHistory();
});

settingsBtn.addEventListener('click', openSettings);
bannerLink.addEventListener('click', (e) => {
  e.preventDefault();
  openSettings();
});

// Init
(async () => {
  settings = await getSettings();
  history = await getChatHistory();
  renderHistory();
  updateModelLabel();

  const provider = settings.providers[settings.activeProvider];
  if (!provider || (!provider.apiKey && !Object.keys(provider.headers || {}).length)) {
    banner.classList.remove('hidden');
  }

  // Check for pending message from context menu
  const pending = await getPendingMessage();
  if (pending) {
    await clearPendingMessage();
    chrome.action.setBadgeText({ text: '' });
    inputEl.value = pending;
    autoResize();
    handleSend();
  }

  inputEl.focus();
})();
