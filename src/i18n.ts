import { createI18n } from 'vue-i18n';
import type { I18n } from 'vue-i18n';
// Import localization files
import en from './locales/en.json';
import zhTW from './locales/zh-TW.json';

const i18n: I18n = createI18n({
    legacy: false, // Use Composition API
    locale: 'en', // Set default locale to English as requested
    fallbackLocale: 'en',
    globalInjection: true,
    messages: {
        'en': en,
        'zh-TW': zhTW
    },
});

export default i18n;
