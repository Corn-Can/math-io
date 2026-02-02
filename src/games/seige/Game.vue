<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useRoute } from 'vue-router';
import type { Socket } from 'socket.io-client';
import { useT } from '@/utils/i18n-tracker';
import { playSound } from '@/utils/audio';

const props = defineProps<{
  socket: Socket | null;
  serverTimeOffset: number;
  startTime: number;
  players: any[];
  mode: string;
  options: any;
}>();

const emit = defineEmits(['game-over', 'score-update']);
const { t } = useT();
const route = useRoute();

// Game State
const gridSize = ref(props.options?.size || 20); // Default from options
const grid = ref<any[][]>(
    Array(gridSize.value).fill(null).map(() => Array(gridSize.value).fill(null))
);
const gamePlayers = ref<any[]>(props.players || []);

import { watch } from 'vue';
watch(() => props.players, (newVal) => {
    // Only update if we haven't received specific game state yet, 
    // OR if game state should match room state.
    // Actually, room players are the source of truth for names/colors/connection.
    // Game state players might have specific game data (scores, etc).
    // Let's merge them or just update if gamePlayers is empty.
    if (gamePlayers.value.length === 0 || newVal.length > gamePlayers.value.length) {
         gamePlayers.value = newVal;
    }
}, { immediate: true });
const turnPlayerId = ref('');
const currentRound = ref(1);
const dice = ref<number[]>([]);
const diceSum = ref(0);
const myId = computed(() => props.socket?.id || '');
const isMyTurn = computed(() => turnPlayerId.value === myId.value);

// Interaction State
const isDragging = ref(false);
const dragStart = ref<{x: number, y: number} | null>(null);
const dragEnd = ref<{x: number, y: number} | null>(null);
const selection = computed(() => {
    if (!dragStart.value || !dragEnd.value) return null;
    const x1 = Math.min(dragStart.value.x, dragEnd.value.x);
    const x2 = Math.max(dragStart.value.x, dragEnd.value.x);
    const y1 = Math.min(dragStart.value.y, dragEnd.value.y);
    const y2 = Math.max(dragStart.value.y, dragEnd.value.y);
    return { x: x1, y: y1, w: x2 - x1 + 1, h: y2 - y1 + 1 };
});

const selectionValid = computed(() => {
    if (!selection.value) return false;
    if (diceSum.value === 0) return false;
    return (selection.value.w * selection.value.h) === diceSum.value;
});

// Setup Socket Listeners
onMounted(() => {
    if (!props.socket) return;

    props.socket.on('seige-gamestate', (state: any) => {
        grid.value = state.grid;
        gridSize.value = state.grid.length;
        gamePlayers.value = state.players;
        turnPlayerId.value = state.turnPlayerId;
        currentRound.value = state.round;
        // Reset turn state
        dice.value = [];
        diceSum.value = 0;
        dragStart.value = null;
        dragEnd.value = null;
    });

    props.socket.on('seige-rolled', (data: any) => {
        dice.value = data.dice;
        diceSum.value = data.sum;
        playSound('seige', 'move'); 
    });

    props.socket.on('seige-map-update', (data: any) => {
        grid.value = data.grid;
        playSound('seige', 'attack');
    });

    props.socket.on('seige-turn-change', (data: any) => {
        turnPlayerId.value = data.turnPlayerId;
        currentRound.value = data.round;
        dice.value = [];
        diceSum.value = 0;
        dragStart.value = null;
        dragEnd.value = null;
    });

    props.socket.on('error', (msg: string) => {
        console.error(msg);
        playSound('sudoku', 'error'); // Fallback sound
    });
});

onUnmounted(() => {
    props.socket?.off('seige-gamestate');
    props.socket?.off('seige-rolled');
    props.socket?.off('seige-map-update');
    props.socket?.off('seige-turn-change');
});

// Actions
const rollDice = () => {
    if (isMyTurn.value && diceSum.value === 0) {
        props.socket?.emit('seige-roll', { roomId: route.query.room });
    }
};

const confirmMove = () => {
    if (isMyTurn.value && selectionValid.value) {
        props.socket?.emit('seige-place', { 
            roomId: route.query.room,
            ...selection.value 
        });
    }
};

const skipTurn = () => {
    if (isMyTurn.value) {
        props.socket?.emit('seige-skip', { roomId: route.query.room });
    }
};

// Input Handlers
const getCellCoords = (e: MouseEvent | TouchEvent) => {
    const target = e.target as HTMLElement;
    const cell = target.closest('.grid-cell');
    if (!cell) return null;
    const x = parseInt(cell.getAttribute('data-x') || '0');
    const y = parseInt(cell.getAttribute('data-y') || '0');
    return { x, y };
};

const handleStart = (e: MouseEvent | TouchEvent) => {
    if (!isMyTurn.value || diceSum.value === 0) return; // Prevent interaction if not my turn
    const coords = getCellCoords(e);
    if (coords) {
        isDragging.value = true;
        dragStart.value = coords;
        dragEnd.value = coords;
    }
};

const handleMove = (e: MouseEvent | TouchEvent) => {
    if (!isDragging.value) return;
    
    let coords;
    if (e instanceof TouchEvent) {
        const touch = e.touches[0];
        if (touch) {
            const el = document.elementFromPoint(touch.clientX, touch.clientY);
            const cell = el?.closest('.grid-cell');
            if (cell) {
                 coords = { 
                     x: parseInt(cell.getAttribute('data-x') || '0'), 
                     y: parseInt(cell.getAttribute('data-y') || '0') 
                 };
            }
        }
    } else {
        coords = getCellCoords(e);
    }

    if (coords) {
        dragEnd.value = coords;
    }
};

const handleEnd = () => {
    isDragging.value = false;
};

// Helper for cell styling
const getCellClass = (x: number, y: number, cell: any) => {
    const classes = ['grid-cell', 'border-opacity-10', 'border-stone-400']; // Base
    
    // Selection Highlighting
    if (selection.value) {
        const { x: sx, y: sy, w, h } = selection.value;
        if (x >= sx && x < sx + w && y >= sy && y < sy + h) {
            classes.push('ring-2 ring-inset');
            classes.push(selectionValid.value ? 'ring-green-400 z-10' : 'ring-red-400 z-10');
            classes.push('brightness-110');
        }
    }

    // Owner Styling
    if (cell) {
        if (cell.type === 'castle') {
            classes.push('border-4 border-white shadow-lg relative');
        } else {
            classes.push('opacity-90');
        }
    } else {
        classes.push('bg-white/50');
    }
    
    return classes;
};

const getCellStyle = (cell: any) => {
    if (!cell) return {};
    const player = gamePlayers.value.find(p => p.id === cell.owner);
    return {
        backgroundColor: player?.color || '#ccc'
    };
};

const getPlayerColor = (id: string) => gamePlayers.value.find(p => p.id === id)?.color || '#333';
const getPlayerName = (id: string) => gamePlayers.value.find(p => p.id === id)?.name || 'Unknown';

</script>

<template>
  <div class="w-full h-full flex flex-col bg-stone-100 font-sans select-none overflow-hidden touch-none"
       @mouseup="handleEnd" @touchend="handleEnd" @mouseleave="handleEnd">
      
      <!-- Header Info -->
      <div class="bg-white p-4 shadow-sm z-20 flex justify-between items-center shrink-0">
          <div class="flex items-center gap-4">
              <div class="text-xs font-bold uppercase tracking-widest text-stone-400">
                  Round {{ currentRound }}
              </div>
              <div class="flex items-center gap-2 px-3 py-1 rounded-full bg-stone-100" 
                   :class="{'ring-2 ring-stone-900': isMyTurn}">
                   <div class="w-3 h-3 rounded-full" :style="{background: getPlayerColor(turnPlayerId)}"></div>
                   <span class="font-bold text-sm text-stone-700">
                       {{ isMyTurn ? `${t('room.status.playing')} (YOU)` : getPlayerName(turnPlayerId) }}
                   </span>
              </div>
          </div>
          
          <!-- Dice UI -->
          <div class="flex items-center gap-4">
              <div v-if="dice.length > 0" class="flex gap-2">
                  <div v-for="(d, i) in dice" :key="i" 
                       class="w-8 h-8 flex items-center justify-center bg-stone-800 text-white font-black rounded shadow-md text-lg">
                      {{ d }}
                  </div>
                  <div class="text-xl font-bold text-stone-600 pl-2">= {{ diceSum }}</div>
              </div>
              
              <button v-if="isMyTurn && diceSum === 0" @click="rollDice" 
                      class="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg shadow hover:bg-blue-500 transition active:scale-95">
                  ROLL DICE
              </button>
              
              <div v-if="isMyTurn && diceSum > 0" class="flex gap-2">
                  <button @click="skipTurn" class="px-3 py-2 text-stone-400 font-bold hover:text-stone-600 text-xs">SKIP</button>
                  <button @click="confirmMove" :disabled="!selectionValid"
                          class="px-6 py-2 bg-green-600 text-white font-bold rounded-lg shadow hover:bg-green-500 transition active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">
                      CONFIRM
                  </button>
              </div>
          </div>
      </div>

      <!-- Grid Area -->
      <div class="flex-1 overflow-auto flex items-center justify-center p-4 bg-stone-200">
          <div class="relative bg-white shadow-xl rounded-lg overflow-hidden grid-container"
               :style="{
                   width: 'min(90vw, 80vh)',
                   height: 'min(90vw, 80vh)',
                   display: 'grid',
                   gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
                   gridTemplateRows: `repeat(${gridSize}, 1fr)`
               }"
               @mousedown="handleStart"
               @touchstart.prevent="handleStart"
               @mousemove="handleMove"
               @touchmove="handleMove"
          >
               <div v-for="(row, y) in grid" :key="y" class="contents">
                   <div v-for="(cell, x) in row" :key="`${x}-${y}`"
                        class="border-[0.5px] border-stone-100 w-full h-full relative"
                        :class="getCellClass(x, y, cell)"
                        :style="getCellStyle(cell)"
                        :data-x="x"
                        :data-y="y"
                   >
                       <!-- Castle Icon -->
                       <div v-if="cell?.type === 'castle'" class="absolute inset-0 flex items-center justify-center text-[10px] md:text-sm">
                           🏰
                       </div>
                   </div>
               </div>
          </div>
      </div>
  </div>
</template>

<style scoped>
.grid-container {
    touch-action: none;
}
</style>
