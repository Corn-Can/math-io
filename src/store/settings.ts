import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import i18n from '@/i18n';

export const useSettingsStore = defineStore('settings', () => {
    const savedLang = localStorage.getItem('language');
    const language = ref(savedLang || 'en'); // Default to English as per recent request

    // Sync functionality
    const updateLocale = (lang: string) => {
        console.log(`[Settings] Switching language to: ${lang}`);
        try {
            // @ts-ignore - legacy: false mode requires .value access
            i18n.global.locale.value = lang;
            localStorage.setItem('language', lang);
            document.querySelector('html')?.setAttribute('lang', lang);
        } catch (e) {
            console.error('[Settings] Failed to switch language:', e);
        }
    };

    // Initialize
    updateLocale(language.value);

    // Watch for changes
    watch(language, (newLang) => {
        updateLocale(newLang);
    });

    const setLanguage = (lang: string) => {
        language.value = lang;
    };

    return {
        language,
        setLanguage
    };
});
