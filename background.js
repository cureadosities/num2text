chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.set({ num2textEnabled: false });
});

chrome.action.onClicked.addListener(async (tab) => {
    const data = await chrome.storage.local.get("num2textEnabled");
    const enabled = !data.num2textEnabled;

    await chrome.storage.local.set({ num2textEnabled: enabled });

    // No tabId → applies to all tabs, including ones opened later
    chrome.action.setBadgeText({ text: enabled ? "ON" : "OFF" });
    chrome.action.setBadgeBackgroundColor({ color: enabled ? "#2e7d32" : "#757575" });

    // Broadcast to every currently open tab
    const tabs = await chrome.tabs.query({});
    for (const t of tabs) {
        if (t.id) {
            chrome.tabs.sendMessage(t.id, { type: "NUM2TEXT_TOGGLE", enabled })
            .catch(() => {});
        }
    }
});
