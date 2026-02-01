<script setup lang="ts">
import { computed } from 'vue';
import { useT } from '@/utils/i18n-tracker';

const { t } = useT();

const props = defineProps<{
  show: boolean;
  matchResult: 'WIN' | 'LOSE' | 'DRAW';
  finalResult: any;
  sortedPlayers: any[];
  myId: string;
  isHost: boolean;
  isGameRunning?: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'play-again'): void;
  (e: 'back-to-lobby'): void;
}>();

const amIEliminated = computed(() => {
    const me = props.sortedPlayers.find(p => p.id === props.myId);
    return me?.isEliminated || false;
});

const title = computed(() => {
    if (props.matchResult === 'WIN') return t('room.victory', 'VICTORY');
    if (props.matchResult === 'LOSE') return t('room.defeat', 'DEFEAT');
    return t('room.draw', 'DRAW');
});

const subTitle = computed(() => {
    if (props.matchResult === 'WIN') return 'Mission Complete';
    return 'Game Over';
});

const message = computed(() => {
    if (props.matchResult === 'WIN') return t('room.newRecord', 'New Record!');
    return t('room.goodEffort', 'Good Effort');
});

</script>

<template>
  <Transition name="modal">
    <div v-if="show" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-stone-900/60 backdrop-blur-sm"></div>

      <!-- Modal Content -->
      <div class="w-full max-w-md bg-white rounded-3xl shadow-2xl shadow-black/30 overflow-hidden border border-white/50 relative z-10 animate-scale-up">
        
        <div class="p-8 text-center relative overflow-hidden"
             :class="matchResult === 'WIN' ? 'bg-stone-800 text-white' : 'bg-stone-200 text-stone-600'">
          
          <div class="absolute inset-0 opacity-10 pointer-events-none" 
               style="background-image: radial-gradient(circle, currentColor 1px, transparent 1px); background-size: 20px 20px;">
          </div>

          <div class="relative z-10 pt-4">
            <div class="text-xs font-bold tracking-[0.3em] uppercase mb-2 opacity-60">
              {{ subTitle }}
            </div>
            <h2 class="text-6xl font-black tracking-tighter mb-1 drop-shadow-sm">
              {{ title }}
            </h2>
            <div class="font-mono text-sm opacity-80">
              {{ message }}
            </div>
          </div>
        </div>

        <div class="p-8 space-y-6 bg-white">
          
          <div class="grid grid-cols-2 gap-4">
            <div class="p-4 bg-stone-50 rounded-2xl border border-stone-100 flex flex-col items-center">
              <span class="text-xs font-bold text-stone-400 uppercase mb-1">{{ t('room.rank', 'Rank') }}</span>
              <span class="text-3xl font-black text-stone-800">
                <span class="text-lg text-stone-400 align-top mr-1">#</span>{{ sortedPlayers.findIndex(p => p.id === myId) + 1 }}
              </span>
            </div>
            <div class="p-4 bg-stone-50 rounded-2xl border border-stone-100 flex flex-col items-center">
              <span class="text-xs font-bold text-stone-400 uppercase mb-1">{{ t('room.score', 'Score') }}</span>
              <span class="text-3xl font-black text-stone-800 font-mono">{{ finalResult?.score || 0 }}</span>
            </div>
          </div>

          <div class="space-y-2">
            <div class="text-xs font-bold text-stone-400 uppercase tracking-widest text-center mb-2">- {{ t('room.leaderboard', 'Leaderboard') }} -</div>
            <div class="bg-stone-50 rounded-xl p-2 max-h-48 overflow-y-auto custom-scrollbar">
                <div v-for="(p, index) in sortedPlayers" :key="p.id" 
                     class="flex items-center justify-between py-2 px-3 rounded-lg text-sm mb-1 last:mb-0"
                     :class="p.id === myId ? 'bg-blue-100 text-blue-900 font-bold border border-blue-200' : 'text-stone-600'">
                   <div class="flex items-center gap-3">
                     <div class="w-5 text-center opacity-50 font-mono text-xs">{{ index + 1 }}</div>
                     <div class="truncate max-w-[120px]">{{ p.name }}</div>
                   </div>
                   <div class="font-mono opacity-80" :class="p.id===myId?'opacity-100':''">{{ p.score }}</div>
                </div>
            </div>
          </div>

          <div class="pt-2 flex flex-col gap-2">
              <div class="flex gap-2">
                 <button v-if="amIEliminated && isGameRunning" @click="emit('close')" class="flex-1 py-4 bg-stone-200 hover:bg-stone-300 text-stone-600 rounded-xl font-bold transition-colors">
                      {{ t('room.spectate', 'Spectate') }}
                  </button>
                  <button @click="emit('back-to-lobby')" class="flex-1 py-4 bg-stone-100 hover:bg-stone-200 text-stone-500 rounded-xl font-bold transition-colors border border-stone-200">
                      {{ t('room.backToLobby', 'Back to Lobby') }}
                  </button>
              </div>
          </div>

        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.animate-scale-up {
  animation: scaleUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes scaleUp {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(20px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}
</style>
