import { ref } from 'vue';

// 1. 狀態初始化：直接讀取 localStorage
// 放在函式外面，確保整個網站狀態同步
const isPremium = ref(localStorage.getItem('math_io_premium') === 'true');

export function usePremium() {

    // 驗證代碼
    const verifyCode = (code: string) => {
        // 這裡設定你的 "密語" (可以多設幾組)
        const validCodes = ['MATH2026', 'ILOVEFRUIT', 'VIP888', 'DEV_SUPPORT'];

        if (validCodes.includes(code.trim().toUpperCase())) {
            isPremium.value = true;
            localStorage.setItem('math_io_premium', 'true'); // 寫入紀錄
            return true;
        }
        return false;
    };

    // 測試用的重置 (選用)
    const removePremium = () => {
        isPremium.value = false;
        localStorage.removeItem('math_io_premium');
    };

    return { isPremium, verifyCode, removePremium };
}