<script setup lang="ts">
import { ref } from 'vue';
import type { GameModule } from '@/games/registry';
import { useT } from '@/utils/i18n-tracker';

const props = defineProps<{
  show: boolean;
  game?: GameModule;
}>();

const emit = defineEmits(['close']);
const { t } = useT();

const activeTab = ref<'overview' | 'rules' | 'modes'>('overview');

// Helper to try translating dynamic content, fallback to registry text
const tryTranslate = (path: string, fallback: string) => {
    // If the valid key is provided, we would use t(key, fallback)
    // But here we construct the key dynamically based on game ID
    if (!props.game) return fallback;
    // Example Key: game.fruitbox.help.overview.content
    const key = `game.${props.game.id}.help.${path}`;
    return t(key, fallback);
};
</script>

<template>
  <Transition name="fade">
    <div v-if="show" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-stone-900/60 backdrop-blur-sm" @click="emit('close')"></div>

      <!-- Modal Content -->
      <div class="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden relative flex flex-col h-[600px] animate-modal-up">
        
        <!-- Header -->
        <div class="bg-stone-100 px-6 py-4 flex justify-between items-center border-b border-stone-200 flex-shrink-0">
          <div class="flex items-center gap-3">
             <div v-if="game?.thumbnail" class="w-10 h-10 rounded-lg overflow-hidden bg-stone-200">
                <img :src="game.thumbnail" class="w-full h-full object-cover" />
             </div>
             <div>
                <h2 class="text-lg font-black text-stone-800 tracking-tight leading-none">{{ t(game?.nameKey || '') }}</h2>
                <p class="text-[10px] text-stone-400 font-bold uppercase tracking-widest">{{ t('help.guide', 'Game Guide') }}</p>
             </div>
          </div>
          <button @click="emit('close')" class="w-8 h-8 rounded-full bg-stone-200 hover:bg-stone-300 flex items-center justify-center transition-colors">
            <svg class="w-5 h-5 text-stone-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        <!-- Tabs -->
        <div class="flex border-b border-stone-100 px-6 gap-6 text-sm font-bold text-stone-400 flex-shrink-0">
            <button 
                @click="activeTab = 'overview'" 
                class="py-4 border-b-2 transition-colors"
                :class="activeTab === 'overview' ? 'border-stone-800 text-stone-800' : 'border-transparent hover:text-stone-600'"
            >
                {{ t('help.tab.overview', 'Overview') }}
            </button>
            <button 
                @click="activeTab = 'rules'" 
                class="py-4 border-b-2 transition-colors"
                :class="activeTab === 'rules' ? 'border-stone-800 text-stone-800' : 'border-transparent hover:text-stone-600'"
            >
                {{ t('help.tab.rules', 'Rules') }}
            </button>
            <button 
                @click="activeTab = 'modes'" 
                class="py-4 border-b-2 transition-colors"
                :class="activeTab === 'modes' ? 'border-stone-800 text-stone-800' : 'border-transparent hover:text-stone-600'"
            >
                {{ t('help.tab.modes', 'Modes') }}
            </button>
        </div>

        <!-- Content Area -->
        <div class="flex-1 overflow-y-auto p-6 bg-stone-50">
            
            <div v-if="game?.help" class="max-w-xl mx-auto space-y-6">
                
                <!-- Overview (Rich Guide) -->
                <div v-if="activeTab === 'overview'" class="animate-fade-in space-y-8">
                    
                    <!-- Intro -->
                    <div class="prose prose-stone prose-sm">
                        <p class="leading-relaxed whitespace-pre-line text-stone-600 text-lg">{{ t(game.help.overview.contentKey || '') }}</p>
                    </div>

                    <!-- Visual Steps (How to Play) -->
                    <div class="space-y-4">
                        <div v-for="(step, idx) in game.help.howToPlay" :key="idx" class="bg-white rounded-xl overflow-hidden border border-stone-100 shadow-sm flex flex-col md:flex-row">
                            <!-- Image Section -->
                            <div class="md:w-1/3 bg-stone-200 min-h-[160px] relative">
                                <img v-if="step.image" :src="step.image" class="absolute inset-0 w-full h-full object-cover">
                                <div v-else class="absolute inset-0 flex items-center justify-center text-stone-400">
                                    <span class="text-4xl text-stone-300">🖼️</span>
                                </div>
                            </div>
                            
                            <!-- Content Section -->
                            <div class="p-5 md:w-2/3 flex flex-col justify-center">
                                <h3 class="font-bold text-stone-800 text-lg mb-2">{{ t(step.titleKey || '') }}</h3>
                                <p class="text-stone-500 text-sm leading-relaxed whitespace-pre-line">{{ t(step.contentKey || '') }}</p>
                            </div>
                        </div>
                    </div>

                    <!-- Controls -->
                     <div v-if="game.help.controlsKey" class="bg-stone-800 text-white p-5 rounded-xl shadow-lg">
                        <h3 class="font-bold text-stone-400 text-xs uppercase tracking-widest mb-3 border-b border-stone-700 pb-2">{{ t('help.controls', 'CONTROLS') }}</h3>
                        <div class="font-mono text-sm whitespace-pre-line flex items-center gap-4">
                            <span class="text-2xl">🎮</span>
                            <span>{{ t(game.help.controlsKey || '') }}</span>
                        </div>
                    </div>

                </div>

                <!-- Rules (Legacy / Detailed List) -->
                <div v-if="activeTab === 'rules'" class="animate-fade-in space-y-6">
                    <div v-for="(step, idx) in game.help.howToPlay" :key="idx" class="bg-white p-4 rounded-xl shadow-sm border border-stone-100">
                        <h3 class="font-bold text-stone-800 mb-2 flex items-center gap-2">
                            <span class="w-6 h-6 rounded-full bg-stone-100 flex items-center justify-center text-xs">{{ idx + 1 }}</span>
                            {{ t(step.titleKey || '') }}
                        </h3>
                        <p class="text-sm text-stone-500 leading-relaxed whitespace-pre-line">{{ t(step.contentKey || '') }}</p>
                    </div>
                </div>

                <!-- Modes -->
                <div v-if="activeTab === 'modes'" class="animate-fade-in grid gap-4">
                    <div v-for="mode in game.modes" :key="mode.id" class="bg-white p-4 rounded-xl shadow-sm border border-stone-100 flex justify-between items-center group">
                        <div>
                            <h3 class="font-bold text-stone-800">{{ t(mode.labelKey || '') }}</h3>
                            <p class="text-xs text-stone-500 mt-1">{{ t(mode.descriptionKey || '') }}</p>
                        </div>
                        <div class="opacity-0 group-hover:opacity-100 transition-opacity">
                            <span class="text-xl">🎮</span>
                        </div>
                    </div>
                </div>

            </div>

        </div>

        <div class="bg-white p-4 border-t border-stone-200 flex justify-end flex-shrink-0">
            <button @click="emit('close')" class="px-6 py-2 bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-xl font-bold text-sm transition-colors">
                {{ t('help.close', 'Close') }}
            </button>
        </div>

      </div>
    </div>
  </Transition>
</template>

<style scoped>
.animate-modal-up {
    animation: modalUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.animate-fade-in {
    animation: fadeIn 0.4s ease-out;
}

@keyframes modalUp {
    from {
        opacity: 0;
        transform: translateY(10px) scale(0.98);
    }
    to {
        opacity: 1;
        transform: translateY(0) scale(1);
    }
}

@keyframes fadeIn {
    from {
        opacity: 0;
        transform: translateY(10px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}
</style>
