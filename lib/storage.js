const DEFAULT_SETTINGS = {
  providers: {
    openai: {
      name: 'OpenAI',
      type: 'openai',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: '',
      headers: {},
      models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-nano'],
    },
    anthropic: {
      name: 'Anthropic',
      type: 'anthropic',
      baseUrl: 'https://api.anthropic.com',
      apiKey: '',
      headers: {},
      models: ['claude-sonnet-4-20250514', 'claude-haiku-4-5-20251001'],
    },
  },
  activeProvider: 'openai',
  activeModel: 'gpt-4o-mini',
  variables: {},
};

export async function getSettings() {
  const { settings } = await chrome.storage.local.get('settings');
  if (!settings) return structuredClone(DEFAULT_SETTINGS);
  return {
    ...DEFAULT_SETTINGS,
    ...settings,
    providers: { ...DEFAULT_SETTINGS.providers, ...settings.providers },
  };
}

export async function saveSettings(settings) {
  await chrome.storage.local.set({ settings });
}

export async function getChatHistory() {
  const { chatHistory } = await chrome.storage.local.get('chatHistory');
  return chatHistory || [];
}

export async function saveChatHistory(messages) {
  await chrome.storage.local.set({ chatHistory: messages });
}

export async function clearChatHistory() {
  await chrome.storage.local.remove('chatHistory');
}

export async function getPendingMessage() {
  const { pendingMessage } = await chrome.storage.local.get('pendingMessage');
  return pendingMessage || null;
}

export async function setPendingMessage(text) {
  await chrome.storage.local.set({ pendingMessage: text });
}

export async function clearPendingMessage() {
  await chrome.storage.local.remove('pendingMessage');
}

/**
 * Replaces {env:VAR_NAME} placeholders in a string with values from settings.variables.
 */
export function resolveVars(str, variables) {
  if (!str || typeof str !== 'string') return str;
  return str.replace(/\$\{(\w+)\}/g, (match, name) => variables[name] !== undefined ? variables[name] : match);
}
