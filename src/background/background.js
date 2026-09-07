function buildRules(blacklist) {
    const condition = {
        urlFilter: '*',
        resourceTypes: ['xmlhttprequest', 'sub_frame', 'main_frame']
    };
    if (blacklist.length > 0) {
        condition.excludedInitiatorDomains = blacklist;
    }
    return [{
        id: 1,
        priority: 1,
        action: {
            type: 'modifyHeaders',
            responseHeaders: [
                { header: 'Access-Control-Allow-Origin', operation: 'set', value: '*' },
                { header: 'Access-Control-Allow-Methods', operation: 'set', value: 'GET,POST,PUT,DELETE,OPTIONS' },
                { header: 'Access-Control-Allow-Headers', operation: 'set', value: '*' }
            ]
        },
        condition
    }];
}

function applyState(enabled) {
    chrome.storage.local.get({ blacklist: [] }, ({ blacklist }) => {
        chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: [1],
            addRules: enabled ? buildRules(blacklist) : []
        });
    });

    chrome.action.setIcon({
        path: enabled
            ? { 16: '../../assets/icon16_on.png', 48: '../../assets/icon48_on.png', 128: '../../assets/icon128_on.png' }
            : { 16: '../../assets/icon16.png', 48: '../../assets/icon48.png', 128: '../../assets/icon128.png' }
    }, () => {
        if (chrome.runtime.lastError) console.error('setIcon error:', chrome.runtime.lastError.message);
    });
}

function initState() {
    chrome.storage.local.get({ corsEnabled: false }, (data) => applyState(data.corsEnabled));
}

chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.corsEnabled || changes.blacklist) initState();
});

chrome.runtime.onStartup.addListener(initState);
chrome.runtime.onInstalled.addListener(initState);
initState();

// --- per-tab credentialed origin reflection (session rules, no debugger) ---
function buildOriginRule(tabId, origin) {
    return [{
        id: 100000 + tabId,
        priority: 2,
        action: {
            type: 'modifyHeaders',
            responseHeaders: [
                { header: 'Access-Control-Allow-Origin', operation: 'set', value: origin },
                { header: 'Access-Control-Allow-Credentials', operation: 'set', value: 'true' }
            ]
        },
        condition: {
            tabIds: [tabId],
            resourceTypes: ['xmlhttprequest']
        }
    }];
}

function applyTabOriginRule(tabId, origin, enabled) {
    chrome.declarativeNetRequest.updateSessionRules({
        removeRuleIds: [100000 + tabId],
        addRules: enabled ? buildOriginRule(tabId, origin) : []
    });
}

function syncTabRule(tabId, url) {
    chrome.storage.local.get({ corsEnabled: false, blacklist: [] }, ({ corsEnabled, blacklist }) => {
        if (!url) return;
        let origin, host;
        try {
            const u = new URL(url);
            origin = u.origin;
            host = u.hostname;
        } catch (e) { return; }

        const shouldApply = corsEnabled && !blacklist.includes(host);
        applyTabOriginRule(tabId, origin, shouldApply);
    });
}

chrome.runtime.onMessage.addListener((msg, sender) => {
    if (msg.method === 'sync-origin' && sender.tab?.id != null) {
        chrome.storage.local.get({ corsEnabled: false, blacklist: [] }, ({ corsEnabled, blacklist }) => {
            const shouldApply = corsEnabled && !blacklist.includes(msg.host);
            applyTabOriginRule(sender.tab.id, msg.origin, shouldApply);
        });
        return;
    }
    if (msg.method !== 'toggle-origin-rule') return;
    applyTabOriginRule(msg.tabId, msg.origin, msg.enabled);
});

chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
    if (info.status === 'complete' && tab.url) syncTabRule(tabId, tab.url);
});

chrome.tabs.onActivated.addListener(({ tabId }) => {
    chrome.tabs.get(tabId, (tab) => {
        if (chrome.runtime.lastError || !tab.url) return;
        syncTabRule(tabId, tab.url);
    });
});

chrome.tabs.onRemoved.addListener((tabId) => {
    chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [100000 + tabId] });
});