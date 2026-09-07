(function () {
    try {
        chrome.runtime.sendMessage({
            method: 'sync-origin',
            origin: window.location.origin,
            host: window.location.hostname
        });
    } catch (e) {}
})();