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

async function openWithMessage(text, title) {
  await chrome.storage.local.set({ pendingMessage: { text, title } })
  chrome.windows.create({
    url: chrome.runtime.getURL('popup.html'),
    type: 'popup',
    width: 480,
    height: 600,
  })
}

chrome.contextMenus.onClicked.addListener(async (info) => {
  if (!info.selectionText) return

  if (info.menuItemId === 'send-to-aiom') {
    await openWithMessage(info.selectionText, info.selectionText.slice(0, 40))
  } else if (info.menuItemId === 'explain-aiom') {
    await chrome.storage.local.set({
      pendingMessage: {
        text: info.selectionText,
        title: info.selectionText.slice(0, 40),
        systemPrompt: 'Explain the following term or concept in simple words:',
      },
    })
    chrome.windows.create({
      url: chrome.runtime.getURL('popup.html'),
      type: 'popup',
      width: 480,
      height: 600,
    })
  }
})
