import i18n from '@/i18n';
import { useI18n } from 'vue-i18n';

// Singleton to track keys
class TranslationTracker {
    usedKeys = new Set<string>();

    // Track a key usage
    track(key: string) {
        this.usedKeys.add(key);
    }

    // Generate the JSON report
    generateReport() {
        const report: Record<string, any> = {};
        const missingKeys: Record<string, any> = {};

        // Get current locale messages to check existence
        // @ts-ignore
        const currentLocale = i18n.global.locale.value as string;
        // @ts-ignore
        const currentMessages = i18n.global.messages.value[currentLocale] || {};

        const sortObject = (obj: any): any => {
            return Object.keys(obj).sort().reduce((acc: any, key) => {
                acc[key] = (typeof obj[key] === 'object' && obj[key] !== null) ? sortObject(obj[key]) : obj[key];
                return acc;
            }, {});
        };

        // Helper to deeply set a value
        const setDeep = (obj: any, path: string, value: any) => {
            const parts = path.split('.');
            let current = obj;
            for (let i = 0; i < parts.length - 1; i++) {
                const part = parts[i];
                // Ensure part is treated safely
                if (part && !current[part]) current[part] = {};
                if (part) current = current[part];
            }
            const lastPart = parts[parts.length - 1];
            if (lastPart) current[lastPart] = value;
        };

        // Helper to deeply get a value
        const getDeep = (obj: any, path: string) => {
            const parts = path.split('.');
            let current = obj;
            for (let i = 0; i < parts.length; i++) {
                const part = parts[i];
                if (current === undefined || current === null || !part) return undefined;
                // @ts-ignore
                current = current[part];
            }
            return current;
        };

        // Process all tracked keys
        this.usedKeys.forEach(key => {
            const existingValue = getDeep(currentMessages, key);

            // 1. Reconstruct the full usage map
            setDeep(report, key, existingValue !== undefined ? existingValue : "");

            // 2. Track strictly missing keys
            if (existingValue === undefined) {
                setDeep(missingKeys, key, "");
            }
        });

        return sortObject(report);
    }

    downloadJSON() {
        const data = this.generateReport();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `translation_template_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

export const tracker = new TranslationTracker();

export function useT() {
    const { t: originalT, ...rest } = useI18n();

    const t = (key: string, ...args: any[]) => {
        // Track consumption
        tracker.track(key);
        // @ts-ignore
        return originalT(key, ...args);
    }

    return { t, ...rest };
}
