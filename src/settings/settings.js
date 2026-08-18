const toggle = document.getElementById('corsToggle');
const statusText = document.getElementById('statusText');

chrome.storage.local.get('corsEnabled', (data) => {
    toggle.checked = !!data.corsEnabled;
    statusText.textContent = toggle.checked ? 'ON' : 'OFF';
});

toggle.addEventListener('change', () => {
    const enabled = toggle.checked;
    statusText.textContent = enabled ? 'ON' : 'OFF';
    chrome.storage.local.set({ corsEnabled: enabled });
});

const blacklistBtn = document.getElementById('blacklistBtn');

function refreshBlacklistBtn(host, blacklist) {
    const inList = blacklist.includes(host);
    blacklistBtn.textContent = inList ? 'Remove from blacklist' : 'Blacklist this site';
    blacklistBtn.classList.toggle('blacklisted', inList);
    blacklistBtn.classList.toggle('not-blacklisted', !inList);
}

chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const host = new URL(tabs[0].url).hostname;
    chrome.storage.local.get({ blacklist: [] }, ({ blacklist }) => {
        refreshBlacklistBtn(host, blacklist);
    });
});

blacklistBtn.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const host = new URL(tabs[0].url).hostname;

        chrome.storage.local.get({ blacklist: [] }, ({ blacklist }) => {
            const idx = blacklist.indexOf(host);
            if (idx === -1) {
                blacklist.push(host);
            } else {
                blacklist.splice(idx, 1);
            }
            chrome.storage.local.set({ blacklist }, () => refreshBlacklistBtn(host, blacklist));
        });
    });
});