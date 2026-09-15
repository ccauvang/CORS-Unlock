// Global rule: ACAO "*" for all requests except blacklisted hosts
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

// Toggle global rule on/off (dynamic rule id 1) + swap toolbar icon
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

// Load corsEnabled from storage, apply it. Runs on install/startup/change.
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

// String hash -> small int, used to build a stable rule id
function hashHost(host) {
    let h = 5381;
    for (let i = 0; i < host.length; i++) h = ((h << 5) + h + host.charCodeAt(i)) | 0;
    return Math.abs(h) % 9000;
}

// Deterministic id per tab+host (no memory needed, survives SW restart)
function ruleIdFor(tabId, host) {
    return 100000 + (tabId * 10000) + hashHost(host);
}

// One session rule: reflect exact origin + allow credentials, scoped to this host only
function buildOriginRule(id, tabId, host, origin) {
    return [{
        id, priority: 2,
        action: {
            type: 'modifyHeaders',
            responseHeaders: [
                { header: 'Access-Control-Allow-Origin', operation: 'set', value: origin },
                { header: 'Access-Control-Allow-Credentials', operation: 'set', value: 'true' }
            ]
        },
        condition: { tabIds: [tabId], initiatorDomains: [host], resourceTypes: ['xmlhttprequest'] }
    }];
}

// Add/remove the per-tab-per-host session rule via DNR
function applyTabOriginRule(tabId, origin, host, enabled) {
    const id = ruleIdFor(tabId, host);
    chrome.declarativeNetRequest.updateSessionRules({
        removeRuleIds: [id],
        addRules: enabled ? buildOriginRule(id, tabId, host, origin) : []
    }).catch(e => console.error('updateSessionRules failed:', e.message));
}

// Compute tab's own origin/host from its URL, apply rule if enabled + not blacklisted
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
        applyTabOriginRule(tabId, origin, host, shouldApply);
    });
}

// hook.js pings its frame's origin here; also handles manual toggle-origin-rule msg
chrome.runtime.onMessage.addListener((msg, sender) => {
    if (msg.method === 'sync-origin' && sender.tab?.id != null) {
        chrome.storage.local.get({ corsEnabled: false, blacklist: [] }, ({ corsEnabled, blacklist }) => {
            const shouldApply = corsEnabled && !blacklist.includes(msg.host);
            applyTabOriginRule(sender.tab.id, msg.origin, msg.host, shouldApply);
        });
        return;
    }
    if (msg.method !== 'toggle-origin-rule') return;
    let host;
    try { host = new URL(msg.origin).hostname; } catch (e) { return; }
    applyTabOriginRule(msg.tabId, msg.origin, host, msg.enabled);
});

// Page finished loading -> sync top-frame rule
chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
    if (info.status === 'complete' && tab.url) syncTabRule(tabId, tab.url);
});

// Tab switched to -> sync rule (covers tabs loaded in background)
chrome.tabs.onActivated.addListener(({ tabId }) => {
    chrome.tabs.get(tabId, (tab) => {
        if (chrome.runtime.lastError || !tab.url) return;
        syncTabRule(tabId, tab.url);
    });
});

// Tab closed -> remove all its session rules (queries live rules, not memory)
chrome.tabs.onRemoved.addListener((tabId) => {
    chrome.declarativeNetRequest.getSessionRules((rules) => {
        const ids = rules.filter(r => r.condition.tabIds?.includes(tabId)).map(r => r.id);
        if (ids.length) chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: ids });
    });
});