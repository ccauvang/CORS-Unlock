function applyState(enabled) {
    chrome.declarativeNetRequest.updateEnabledRulesets({
        enableRulesetIds: enabled ? ['cors_rules'] : [],
        disableRulesetIds: enabled ? [] : ['cors_rules']
    });
}

chrome.storage.local.get('corsEnabled', (data) => applyState(!!data.corsEnabled));

chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'storage' || area === 'local') {
        if (changes.corsEnabled) applyState(changes.corsEnabled.newValue);
    }
});