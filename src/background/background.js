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

    console.log('setting icon, enabled:', enabled);
    chrome.action.setIcon({
        path: enabled
            ? { 16: '../../assets/icon16_on.png', 48: '../../assets/icon48_on.png', 128: '../../assets/icon128_on.png' }
            : { 16: '../../assets/icon16.png', 48: '../../assets/icon48.png', 128: '../../assets/icon128.png' }
    }, () => {
        if (chrome.runtime.lastError) console.error('setIcon error:', chrome.runtime.lastError.message);
    });
}

chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.corsEnabled || changes.blacklist) {
        chrome.storage.local.get({ corsEnabled: false }, (data) => applyState(data.corsEnabled));
    }
});

chrome.storage.local.get({ corsEnabled: false }, (data) => applyState(data.corsEnabled));