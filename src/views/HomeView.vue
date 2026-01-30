<script setup lang="ts">
import { useRouter } from 'vue-router';
import { GAME_REGISTRY } from '@/games/registry';
import ParticleBg from '@/components/ParticleBg.vue';
import { playBgm } from '@/utils/audio';
import { onMounted, ref } from 'vue';
import UserSettings from '@/components/lobby/UserSettings.vue';
import { useT } from '@/utils/i18n-tracker'; // Import the tracker hook

const { t } = useT(); // Initialize the hook
const router = useRouter();
const games = Object.values(GAME_REGISTRY); // Consider making this reactive if registry changes dynamically
const showSettings = ref(false);

const enterLobby = (gameId: string) => {
  router.push({ name: 'lobby', params: { gameId } });
};

onMounted(() => {
  playBgm('lobby');
});

</script>

<template>
  <div class="min-h-screen bg-stone-50 font-sans selection:bg-stone-800 selection:text-white flex flex-col">
    
    <div class="relative bg-stone-900 text-stone-50 pt-24 pb-32 px-8 overflow-hidden">
      
      <ParticleBg 
        color="rgba(255, 255, 255, 0.4)" 
        lineColor="rgba(255, 255, 255, 0.1)" 
        :count="80" 
      />

      <div class="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-stone-900/50 pointer-events-none"></div>

      <!-- Settings Button -->
      <button 
        @click="showSettings = true"
        class="absolute top-6 right-6 z-50 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md flex items-center justify-center transition-all lg:w-12 lg:h-12 border border-white/10"
        title="User Settings"
      >
         <span class="text-xl">⚙️</span>
      </button>

      <div class="relative z-10 max-w-6xl mx-auto text-center">
        <h1 class="text-7xl md:text-8xl font-black mb-6 tracking-tighter leading-none bg-clip-text text-transparent bg-gradient-to-b from-white to-stone-400">
          MATH.IO
        </h1>
        <p class="text-xl md:text-2xl text-stone-400 font-light max-w-2xl mx-auto tracking-wide">
          {{ t('home.subtitle', '極簡數學對戰平台') }}<span class="mx-3 opacity-30">/</span>{{ t('home.tagline', '即時連線競技') }}
        </p>
      </div>
    </div>

    <div class="flex-1 px-8 pb-12 -mt-20 relative z-20">
      <div class="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        
        <div 
          v-for="game in games" 
          :key="game.id"
          @click="enterLobby(game.id)"
          class="group cursor-pointer bg-white rounded-3xl p-4 shadow-xl shadow-stone-900/10 border border-white hover:border-stone-300 transition-all duration-300 hover:-translate-y-2"
        >
          <div class="aspect-video w-full overflow-hidden rounded-2xl bg-stone-100 relative mb-5 group-hover:shadow-inner">
            <img v-if="game.thumbnail" :src="game.thumbnail" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 saturate-0 group-hover:saturate-100" />
            
            <div v-else class="w-full h-full flex flex-col items-center justify-center bg-stone-200 text-stone-400">
              <span class="text-5xl mb-2 group-hover:scale-110 transition-transform">✦</span>
              <span class="text-xs font-mono uppercase tracking-widest opacity-50">No Image</span>
            </div>

            <div class="absolute top-4 right-4 bg-white/90 backdrop-blur text-stone-900 text-xs font-bold px-3 py-1 rounded-full opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all duration-300 shadow-sm">
              {{ t('home.playNow', 'PLAY NOW ↗') }}
            </div>
          </div>

          <div class="px-2 pb-2">
            <div class="flex justify-between items-start mb-2">
              <h2 class="text-2xl font-black text-stone-800 group-hover:text-stone-600 transition-colors">
                {{ t(game.nameKey || '') }}
              </h2>
            </div>
            
            <p class="text-stone-500 text-sm mb-4 line-clamp-2 leading-relaxed">
              {{ t(game.descriptionKey || '') }}
            </p>
            
            <div class="flex flex-wrap gap-2">
              <span v-for="mode in game.modes" :key="mode.id" class="text-[10px] font-bold uppercase tracking-wider bg-stone-100 text-stone-500 px-2 py-1 rounded">
                  {{ t(mode.labelKey || '') }}
              </span>
            </div>
          </div>
        </div>

      </div>
    </div>

    <footer class="py-8 text-center text-stone-300 text-xs font-mono uppercase tracking-widest">
      {{ t('home.footer', 'Math.io • Designed for Focus') }}
    </footer>

    <!-- User Settings Modal -->
    <UserSettings :show="showSettings" @close="showSettings = false" />

  </div>
</template>