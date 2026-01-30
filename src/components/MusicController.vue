<script setup lang="ts">
import { ref, onMounted } from 'vue';
// 引入全域狀態 isBgmPlaying
import { isBgmPlaying, toggleBgm, setBgmVolume, setSfxVolume } from '@/utils/audio';

const bgmVal = ref(20);
const sfxVal = ref(50);

const handleToggle = () => {
  toggleBgm();
};

const updateBgm = () => {
  setBgmVolume(bgmVal.value / 100);
};

const updateSfx = () => {
  setSfxVolume(sfxVal.value / 100);
};

onMounted(() => {
  updateBgm();
  updateSfx();
});
</script>

<template>
  <div class="fixed bottom-6 left-6 z-50 flex flex-col items-start gap-2 group">
    
    <div class="mb-2 p-5 rounded-2xl bg-stone-900/95 backdrop-blur-md border border-stone-700 shadow-2xl shadow-black/50 transform translate-y-4 opacity-0 invisible group-hover:visible group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 ease-out origin-bottom-left w-48">
      
      <div class="text-[10px] font-bold text-stone-500 uppercase tracking-widest mb-4 border-b border-stone-800 pb-2">
        Audio Settings
      </div>

      <div class="mb-4">
        <div class="flex justify-between text-xs font-bold text-stone-300 mb-1.5">
          <span>MUSIC</span>
          <span class="text-stone-500 font-mono">{{ bgmVal }}%</span>
        </div>
        <input 
          type="range" 
          v-model="bgmVal" 
          @input="updateBgm"
          min="0" max="100" 
          class="w-full h-1.5 bg-stone-700 rounded-lg appearance-none cursor-pointer accent-white hover:accent-stone-300 transition-colors"
        >
      </div>

      <div>
        <div class="flex justify-between text-xs font-bold text-stone-300 mb-1.5">
          <span>SE</span>
          <span class="text-stone-500 font-mono">{{ sfxVal }}%</span>
        </div>
        <input 
          type="range" 
          v-model="sfxVal" 
          @input="updateSfx"
          min="0" max="100" 
          class="w-full h-1.5 bg-stone-700 rounded-lg appearance-none cursor-pointer accent-white hover:accent-stone-300 transition-colors"
        >
      </div>

    </div>

    <button 
      @click="handleToggle"
      class="w-12 h-12 rounded-full bg-stone-900 text-white flex items-center justify-center shadow-xl border border-stone-700 transition-all duration-300 group-hover:scale-110 group-hover:border-stone-500 hover:bg-stone-800"
      :class="{'animate-pulse-slow': isBgmPlaying}" 
    >
      <svg v-if="isBgmPlaying" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" />
      </svg>
      
      <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-stone-500" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.414z" clip-rule="evenodd" />
      </svg>
    </button>
    
  </div>
</template>

<style scoped>
.animate-pulse-slow {
  animation: pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.8; transform: scale(0.95); }
}

input[type=range] {
  -webkit-appearance: none; 
  background: transparent; 
}
input[type=range]::-webkit-slider-thumb {
  -webkit-appearance: none;
  height: 12px;
  width: 12px;
  border-radius: 50%;
  background: #ffffff;
  cursor: pointer;
  margin-top: -3px; 
  box-shadow: 0 1px 3px rgba(0,0,0,0.3);
}
input[type=range]::-webkit-slider-runnable-track {
  width: 100%;
  height: 6px;
  cursor: pointer;
  background: #44403c;
  border-radius: 999px;
}
</style>