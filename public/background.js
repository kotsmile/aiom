chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'send-to-aiom',
    title: 'Send to aiom',
    contexts: ['selection'],
  })
  chrome.contextMenus.create({
    id: 'explain-aiom',
    title: 'Ask aiom to explain',
    contexts: ['selection'],
  })
})

async function openWithMessage(text) {
  await chrome.storage.local.set({ pendingMessage: text })
  chrome.windows.create({
    url: chrome.runtime.getURL('popup.html'),
    type: 'popup',
    width: 420,
    height: 520,
  })
}

chrome.contextMenus.onClicked.addListener(async (info) => {
  if (!info.selectionText) return

  if (info.menuItemId === 'send-to-aiom') {
    await openWithMessage(info.selectionText)
  } else if (info.menuItemId === 'explain-aiom') {
    await openWithMessage(
      `Explain the following term or concept in simple words:\n\n"${info.selectionText}"`
    )
  }
})
