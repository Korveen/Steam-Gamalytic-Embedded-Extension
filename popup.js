document.addEventListener('DOMContentLoaded', () => {
    const languageSelect = document.getElementById('language');
    const status = document.getElementById('status');

    // Load current language
    chrome.storage.local.get(['gamalytic_lang'], (result) => {
        const currentLang = result.gamalytic_lang || 'ru';
        languageSelect.value = currentLang;
    });

    // Save language on change
    languageSelect.addEventListener('change', (e) => {
        const lang = e.target.value;
        chrome.storage.local.set({ gamalytic_lang: lang }, () => {
            status.textContent = lang === 'ru' ? 'Язык изменён. Перезагрузите страницу Steam.' : 'Language changed. Reload the Steam page.';
            status.className = 'status show success';
            
            setTimeout(() => {
                status.className = 'status';
            }, 3000);
        });
    });
});