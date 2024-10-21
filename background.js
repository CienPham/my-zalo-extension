chrome.action.onClicked.addListener((tab) => {
    chrome.storage.local.get(['extensionActive'], (result) => {
        const newState = !result.extensionActive;
        chrome.storage.local.set({extensionActive: newState}, () => {
            chrome.tabs.sendMessage(tab.id, { action: "toggleExtension", state: newState });
        });
    });
});