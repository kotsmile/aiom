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

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error))

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!info.selectionText) return

  let pendingMessage
  if (info.menuItemId === 'send-to-aiom') {
    pendingMessage = {
      text: info.selectionText,
      title: info.selectionText.slice(0, 40),
    }
  } else if (info.menuItemId === 'explain-aiom') {
    pendingMessage = {
      text: info.selectionText,
      title: info.selectionText.slice(0, 40),
      systemPrompt: 'Explain the following term or concept in simple words:',
    }
  } else {
    return
  }

  // Open the side panel synchronously to preserve the user gesture, then write
  // the pending message. Do not await before opening — chrome.sidePanel.open()
  // requires a user gesture and `await` ends the gesture turn.
  if (tab?.windowId !== undefined) {
    chrome.sidePanel.open({ windowId: tab.windowId }).catch((error) => console.error(error))
  }
  chrome.storage.local.set({ pendingMessage })
})
