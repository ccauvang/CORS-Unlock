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
}

chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.corsEnabled || changes.blacklist) {
        chrome.storage.local.get({ corsEnabled: false }, (data) => applyState(data.corsEnabled));
    }
});

chrome.storage.local.get({ corsEnabled: false }, (data) => applyState(data.corsEnabled));