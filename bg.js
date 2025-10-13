chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type !== "fetchGamalytic") return;
    const url = `https://api.gamalytic.com/game/${msg.appId}`;
    (async () => {
        try {
            const res = await fetch(url, { headers: { accept: "application/json" } });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            sendResponse({ ok: true, data });
        } catch (e) {
            sendResponse({ ok: false, error: String(e) });
        }
    })();
    return true; // keep channel open for async sendResponse
});
