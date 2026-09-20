const toggle = document.getElementById('corsToggle');
const statusText = document.getElementById('statusText');
const ioBtn = document.getElementById('ioBtn');
const ioOverlay = document.getElementById('ioOverlay');
const ioClose = document.getElementById('ioClose');
const importFile = document.getElementById('importFile');
const exportBtn = document.getElementById('exportBtn');


chrome.storage.local.get({ corsEnabled: false }, (data) => {
    toggle.checked = !!data.corsEnabled;
    statusText.textContent = toggle.checked ? 'ON' : 'OFF';
});

toggle.addEventListener('change', () => {
    const enabled = toggle.checked;
    statusText.textContent = enabled ? 'ON' : 'OFF';
    chrome.storage.local.set({ corsEnabled: enabled });

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs[0] || !tabs[0].url) return;
        let origin;
        try { origin = new URL(tabs[0].url).origin; } catch (e) { return; }
        chrome.runtime.sendMessage({ method: 'toggle-origin-rule', tabId: tabs[0].id, origin, enabled });
    });
});

const blacklistBtn = document.getElementById('blacklistBtn');

function refreshBlacklistBtn(host, blacklist) {
    const inList = blacklist.includes(host);
    blacklistBtn.textContent = inList ? 'Remove from blacklist' : 'Blacklist this site';
    blacklistBtn.classList.toggle('blacklisted', inList);
    blacklistBtn.classList.toggle('not-blacklisted', !inList);
}

chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0] || !tabs[0].url) {
        blacklistBtn.disabled = true;
        blacklistBtn.textContent = 'N/A on this page';
        return;
    }
    const host = new URL(tabs[0].url).hostname;
    chrome.storage.local.get({ blacklist: [] }, ({ blacklist }) => {
        refreshBlacklistBtn(host, blacklist);
    });
});

blacklistBtn.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs[0] || !tabs[0].url) return;
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

ioBtn.addEventListener('click', () => ioOverlay.classList.remove('hidden'));
ioClose.addEventListener('click', () => ioOverlay.classList.add('hidden'));

exportBtn.addEventListener('click', () => {
    chrome.storage.local.get({ corsEnabled: false, blacklist: [] }, (data) => {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'cors-unlock-settings.json';
        a.click();
        URL.revokeObjectURL(url);
    });
});

importFile.addEventListener('change', () => {
    const file = importFile.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
        let data;
        try { data = JSON.parse(reader.result); } catch (e) { alert('Invalid JSON'); return; }
        const corsEnabled = !!data.corsEnabled;
        const blacklist = Array.isArray(data.blacklist) ? data.blacklist : [];
        chrome.storage.local.set({ corsEnabled, blacklist }, () => {
            toggle.checked = corsEnabled;
            statusText.textContent = corsEnabled ? 'ON' : 'OFF';
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0]?.url) refreshBlacklistBtn(new URL(tabs[0].url).hostname, blacklist);
            });
            ioOverlay.classList.add('hidden');
        });
    };
    reader.readAsText(file);
    importFile.value = '';
});