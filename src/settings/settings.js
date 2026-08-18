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