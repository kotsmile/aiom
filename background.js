import { setPendingMessage } from './lib/storage.js';

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'send-to-aiom',
    title: 'Send to aiom',
    contexts: ['selection'],
  });
  chrome.contextMenus.create({
    id: 'explain-aiom',
    title: 'Ask aiom to explain',
    contexts: ['selection'],
  });
});

async function openWithMessage(text) {
  await setPendingMessage(text);

  // chrome.action.openPopup() only works from extension icon clicks,
  // so open popup.html in a small standalone window instead
  chrome.windows.create({
    url: chrome.runtime.getURL('popup/popup.html'),
    type: 'popup',
    width: 420,
    height: 520,
  });
}

chrome.contextMenus.onClicked.addListener(async (info) => {
  if (!info.selectionText) return;

  if (info.menuItemId === 'send-to-aiom') {
    await openWithMessage(info.selectionText);
  } else if (info.menuItemId === 'explain-aiom') {
    await openWithMessage(`Explain the following term or concept in simple words:\n\n"${info.selectionText}"`);
  }
});
