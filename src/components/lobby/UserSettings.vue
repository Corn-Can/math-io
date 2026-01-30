<script setup lang="ts">
import { ref } from 'vue';
import { useSettingsStore } from '@/store/settings';
import { usePremium } from '@/composables/usePremium';
import { setBgmVolume, setSfxVolume } from '@/utils/audio';

const settingsStore = useSettingsStore();

defineProps<{
  show: boolean;
}>();

const emit = defineEmits(['close']);

// --- 1. 使用者名稱邏輯 ---
const username = ref(localStorage.getItem('math_io_username') || '');

const saveName = () => {
  const finalName = username.value.trim() || 'Player';
  localStorage.setItem('math_io_username', finalName);
  // 可選：這裡可以發送事件或重新整理頁面來更新顯示，但通常下次進房生效即可
};

// --- 2. VIP 邏輯 ---
const { isPremium, verifyCode } = usePremium();
const redeemCode = ref('');
const redeemStatus = ref<'idle' | 'success' | 'error'>('idle');

const handleRedeem = () => {
  if (verifyCode(redeemCode.value)) {
    redeemStatus.value = 'success';
    redeemCode.value = '';
  } else {
    redeemStatus.value = 'error';
    setTimeout(() => redeemStatus.value = 'idle', 2000);
  }
};

// --- 3. 音量邏輯 (為了讓設定頁面也能調音量) ---
const bgmVal = ref(20);
const sfxVal = ref(50);

const updateBgm = () => setBgmVolume(bgmVal.value / 100);
const updateSfx = () => setSfxVolume(sfxVal.value / 100);
</script>

<template>
  <Transition name="fade">
    <div v-if="show" class="fixed inset-0 z-[100] flex items-center justify-center p-4">
      
      <div class="absolute inset-0 bg-stone-900/60 backdrop-blur-sm" @click="emit('close')"></div>

      <div class="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden relative flex flex-col animate-modal-up max-h-[90vh] overflow-y-auto">
        
        <div class="bg-stone-100 px-6 py-4 flex justify-between items-center border-b border-stone-200 sticky top-0 z-10">
          <h2 class="text-xl font-black text-stone-800 tracking-tight flex items-center gap-2">
            <span>⚙️</span> User Settings
          </h2>
          <button @click="emit('close')" class="w-8 h-8 rounded-full bg-stone-200 hover:bg-stone-300 flex items-center justify-center transition-colors">
            <svg class="w-5 h-5 text-stone-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        <div class="p-6 space-y-6">
            
            <div>
                <h3 class="text-xs font-bold text-stone-400 uppercase tracking-widest mb-3">Profile / 個人檔案</h3>
                <div class="flex gap-2">
                    <input 
                        v-model="username"
                        @blur="saveName"
                        type="text" 
                        placeholder="Enter your name"
                        class="w-full bg-stone-50 border-2 border-stone-200 text-stone-800 font-bold text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-stone-800 transition-colors"
                    >
                </div>
                <p class="text-[10px] text-stone-400 mt-1 pl-1">Name will be updated in the next game.</p>
            </div>

            <div class="p-4 bg-stone-50 rounded-xl border border-stone-100 space-y-4">
                <h3 class="text-xs font-bold text-stone-400 uppercase tracking-widest">Audio / 音效</h3>
                
                <div>
                    <div class="flex justify-between text-xs font-bold text-stone-500 mb-1">
                        <span>Music</span>
                        <span>{{ bgmVal }}%</span>
                    </div>
                    <input type="range" v-model="bgmVal" @input="updateBgm" min="0" max="100" class="w-full h-2 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-stone-800">
                </div>

                <div>
                    <div class="flex justify-between text-xs font-bold text-stone-500 mb-1">
                        <span>Sound Effects</span>
                        <span>{{ sfxVal }}%</span>
                    </div>
                    <input type="range" v-model="sfxVal" @input="updateSfx" min="0" max="100" class="w-full h-2 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-stone-800">
                </div>
            </div>
            
            <div>
                <h3 class="text-xs font-bold text-stone-400 uppercase tracking-widest mb-3">Language / 語言</h3>
                <div class="relative">
                    <select 
                        v-model="settingsStore.language"
                        class="w-full appearance-none bg-white border-2 border-stone-200 text-stone-700 font-bold text-sm rounded-xl px-4 py-3 pr-8 focus:outline-none focus:border-stone-800 cursor-pointer hover:border-stone-300 transition-colors"
                    >
                        <option value="zh-TW">繁體中文</option>
                        <option value="en">English (US)</option>
                        <option value="zh-CN">简体中文</option>
                    </select>
                    <div class="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-stone-500">
                        <svg class="w-4 h-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/></svg>
                    </div>
                </div>
            </div>

            <div class="pt-4 border-t border-stone-100">
                <h3 class="text-xs font-bold text-stone-400 uppercase tracking-widest mb-3">Premium / 兌換</h3>
                
                <div v-if="isPremium" class="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center text-xl">👑</div>
                    <div>
                        <div class="font-bold text-yellow-800 text-sm">Premium Active</div>
                        <div class="text-xs text-yellow-600">Ads removed. Thank you!</div>
                    </div>
                </div>

                <div v-else>
                    <div class="flex gap-2">
                        <input 
                            v-model="redeemCode" 
                            type="text" 
                            placeholder="Enter Code" 
                            class="w-full bg-stone-50 border-2 border-stone-200 text-stone-800 font-bold text-sm rounded-xl px-4 py-3 uppercase focus:outline-none focus:border-stone-800"
                            :class="{'border-red-300 bg-red-50': redeemStatus === 'error'}"
                        >
                        <button 
                            @click="handleRedeem"
                            class="bg-stone-800 text-white font-bold px-6 rounded-xl hover:bg-stone-700 active:scale-95 transition-all"
                        >
                            Redeem
                        </button>
                    </div>
                    <p v-if="redeemStatus === 'success'" class="text-xs text-green-600 font-bold mt-2 ml-1">Code redeemed successfully!</p>
                    <p v-if="redeemStatus === 'error'" class="text-xs text-red-500 font-bold mt-2 ml-1">Invalid code.</p>
                </div>
            </div>

        </div>

      </div>
    </div>
  </Transition>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

.animate-modal-up { animation: modalUp 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
@keyframes modalUp {
    from { opacity: 0; transform: translateY(10px) scale(0.98); }
    to { opacity: 1; transform: translateY(0) scale(1); }
}
</style>