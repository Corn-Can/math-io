<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { playSound } from '@/utils/audio';
import { playBgm } from '@/utils/audio';
import type { Socket } from 'socket.io-client';
import { FruitBoxEngine, type Cell, type GameMode } from './logic';

const props = defineProps<{
  mode: string;
  options: any;
  opponentScore?: number;
  seed?: number;
  socket: Socket | null;
  players?: any[];
}>();

const emit = defineEmits(['game-over', 'score-update']);

// --- 1. Initialize Engine ---
const ROWS = 10;
const COLS = 15;
// Use the engine for game state
const engine = new FruitBoxEngine(COLS, ROWS, props.mode as GameMode, props.seed);

// Occupy Mode State
const occupiedCells = ref<Record<string, string>>({});
const getPlayerColor = (playerId: string) => {
    return props.players?.find(p => p.id === playerId)?.color || '#9ca3af';
};

// Flatten the grid for the template's v-for
const flatBoard = computed(() => {
  const flat = engine.state.grid.flat();
  return flat;
});

// --- 2. Special Mode Logic ---

const handleAttackReceived = () => {
  // Logic to petrify a random cell
  engine.petrifyRandomCell();
  playSound('fruitbox', 'error', 0.8);
  const el = document.querySelector('.game-board');
  if(el) { el.classList.add('shake'); setTimeout(() => el.classList.remove('shake'), 500); }
};

const handleBoardUpdate = (clearedIds: string[]) => {
  // Sync opponent's cleared cells (visual only)
  clearedIds.forEach(id => {
    // Find cell by ID in the grid
    for (const row of engine.state.grid) {
      const cell = row.find(c => c.id === id);
      if (cell && cell.status !== 'cleared') {
        cell.status = 'opponent-cleared';
      }
    }
  });
};

const handleOccupyUpdate = ({ clearedIds, occupierId, refillData }: { clearedIds: string[], occupierId: string, refillData?: {id:string, value:number}[] }) => {
    // 1. Mark ownership
    clearedIds.forEach(id => {
        occupiedCells.value[id] = occupierId;
    });

    // 2. Apply Refills (Sync Board)
    if (refillData) {
        refillData.forEach(item => {
            // Find cell
            const [x, y] = item.id.split('-').map(Number);
            const cell = engine.state.grid[y]?.[x];
            if (cell) {
                cell.value = item.value;
                cell.status = 'normal'; // Reset status so it can be played again
            }
        });
    }

    playSound('fruitbox', 'match', 0.3);
};

const getRoomId = () => new URLSearchParams(window.location.search).get('room');

// --- 3. Core Interaction Logic ---
const isSelecting = ref(false);
const startPos = ref<{x: number, y: number} | null>(null);
const currentPos = ref<{x: number, y: number} | null>(null);
const showDebug = ref(false); // Debug overlay toggle

const selectedCellIds = computed(() => {
  if (!startPos.value || !currentPos.value) return new Set<string>();
  const minX = Math.min(startPos.value.x, currentPos.value.x);
  const maxX = Math.max(startPos.value.x, currentPos.value.x);
  const minY = Math.min(startPos.value.y, currentPos.value.y);
  const maxY = Math.max(startPos.value.y, currentPos.value.y);
  const ids = new Set<string>();
  
  // Iterate through the range directly
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const cell = engine.state.grid[y]?.[x];
      if (cell && cell.status === 'normal') {
        ids.add(cell.id);
      }
      // In Attack Mode, if we encounter a petrified cell in the range, we might want to include it 
      // to detect invalid selection later, OR just ignore it. 
      // Current logic: selectedCellIds only contains 'normal' cells.
      if (props.mode === 'attack' && cell && cell.status === 'petrified') {
          ids.add(cell.id); 
      }
    }
  }
  return ids;
});

const currentSum = computed(() => {
  let sum = 0;
  selectedCellIds.value.forEach(id => {
    const [x, y] = id.split('-').map(Number);
    const cell = engine.state.grid[y]?.[x];
    if (cell && cell.status === 'normal') { // Only sum normal cells
        sum += cell.value;
    }
  });
  return sum;
});

const GAME_DURATION = props.options?.duration || 120;
const timeLeft = ref(GAME_DURATION);
const score = ref(0); 

let timerInterval: any = null;

const startTimer = () => {
  timeLeft.value = GAME_DURATION;
  score.value = 0;
  timerInterval = setInterval(() => {
    if (timeLeft.value > 0) timeLeft.value--;
    else endGame();
  }, 1000);
};

const endGame = () => {
  clearInterval(timerInterval);
  emit('game-over', { score: score.value });
};

const onMouseDown = (cell: Cell) => {
  if (cell.status !== 'normal') return;
  isSelecting.value = true;
  startPos.value = { x: cell.x, y: cell.y };
  currentPos.value = { x: cell.x, y: cell.y };
};

const onMouseEnter = (cell: Cell) => {
  if (isSelecting.value && startPos.value) {
    // Check if the new range would include any petrified cells
    if (props.mode === 'attack') {
        const minX = Math.min(startPos.value.x, cell.x);
        const maxX = Math.max(startPos.value.x, cell.x);
        const minY = Math.min(startPos.value.y, cell.y);
        const maxY = Math.max(startPos.value.y, cell.y);
        
        let hasPetrified = false;
        for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
                const c = engine.state.grid[y]?.[x];
                if (c && c.status === 'petrified') {
                    hasPetrified = true;
                    break;
                }
            }
            if (hasPetrified) break;
        }
        
        // If the new selection would include a petrified cell, BLOCK the update
        if (hasPetrified) {
            return; 
        }
    }

    currentPos.value = { x: cell.x, y: cell.y };
    playSound('common', 'select', 0.2);
  }
};

const onMouseUp = () => {
  if (!isSelecting.value) return;
  isSelecting.value = false;

  // Convert selected IDs to Cell objects
  const selectedCells: Cell[] = [];
  let hasPetrified = false;

  selectedCellIds.value.forEach(id => {
    for (const row of engine.state.grid) {
      const cell = row.find(c => c.id === id);
      if (cell) {
        selectedCells.push(cell);
        if (cell.status === 'petrified') hasPetrified = true;
      }
    }
  });

  // Double check (though dragging should be blocked now)
  if (hasPetrified) {
    playSound('fruitbox', 'error', 0.4);
    startPos.value = null;
    currentPos.value = null;
    return;
  }

  if (engine.validateSelection(selectedCells)) {
    // Process via Engine
    const result = engine.processSelection(selectedCells, 'me');
    
    // Update local score
    if (props.mode !== 'occupy') {
        score.value += result.score; 
        emit('score-update', score.value);
    } 
    // In occupy mode, score is updated via server callback based on area

    playSound('fruitbox', 'match', 0.6);

    const roomId = getRoomId();
    if (!roomId) return;

    // Handle Events
    if (props.mode === 'attack') {
      result.events.forEach(event => {
        if (event === 'petrify_trigger') {
          props.socket?.emit('game-attack', { roomId, type: 'petrify' });
        }
      });
    } else if (props.mode === 'territory') {
      // Send cleared IDs
      const clearedIds = selectedCells.map(c => c.id);
      props.socket?.emit('game-board-sync', { roomId, clearedIds });
    } else if (props.mode === 'occupy') {
      // Send Occupy Event with Refill Data
      const clearedIds = selectedCells.map(c => c.id);
      const refillData = result.refillData; // Generated by processSelection
      props.socket?.emit('game-occupy', { roomId, clearedIds, refillData });
    }
  } else {
    if (selectedCellIds.value.size > 0) playSound('fruitbox', 'error', 0.4);
  }
  startPos.value = null;
  currentPos.value = null;
};

const onGlobalMouseUp = () => {
  if(isSelecting.value) onMouseUp();
}

// --- Listeners & Lifecycle ---
const onAttackReceived = () => {
  if (props.mode === 'attack') handleAttackReceived();
};
const onBoardUpdate = ({ clearedIds }: { clearedIds: string[] }) => {
  if (props.mode === 'territory') handleBoardUpdate(clearedIds);
};
const onOccupyUpdate = (payload: any) => {
    if (props.mode === 'occupy') handleOccupyUpdate(payload);
};

const onKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'D') {
    e.preventDefault();
    showDebug.value = !showDebug.value;
  }
};

onMounted(() => {
  startTimer();
  playBgm('game');
  window.addEventListener('keydown', onKeyDown);

  if (props.socket) {
    props.socket.on('game-attack-received', onAttackReceived);
    props.socket.on('game-board-update', onBoardUpdate);
    props.socket.on('game-occupy-update', onOccupyUpdate);
    
    // In occupy mode, score comes from server
    if (props.mode === 'occupy') {
         props.socket.on('update-players', (players: any[]) => {
             const me = players.find(p => p.id === props.socket?.id);
             if (me) score.value = me.score;
         });
    }
  }
});

onUnmounted(() => {
  if (timerInterval) clearInterval(timerInterval);
  window.removeEventListener('keydown', onKeyDown);
  
  if (props.socket) {
    props.socket.off('game-attack-received', onAttackReceived);
    props.socket.off('game-board-update', onBoardUpdate);
    props.socket.off('game-occupy-update', onOccupyUpdate);
    if (props.mode === 'occupy') props.socket.off('update-players');
  }
});
</script>

<template>
  <div class="flex flex-col items-center justify-center h-full bg-stone-50 select-none" @mouseup="onGlobalMouseUp">
    
    <div class="mb-6 flex gap-8 text-lg md:text-xl font-bold text-stone-700 w-full justify-between px-4 max-w-2xl">
      <div class="flex flex-col items-center">
        <span class="text-xs text-stone-400 font-bold tracking-widest">YOU</span>
        <span class="text-blue-600 text-3xl font-black font-mono">{{ score }}</span>
      </div>
      <div class="flex flex-col items-center justify-center">
         <div class="px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest text-white shadow-md transform -skew-x-12"
              :class="{
                'bg-red-500': mode === 'attack',
                'bg-blue-500': mode === 'territory',
                'bg-indigo-600': mode === 'occupy',
                'bg-stone-800': mode === 'classic'
              }">
           <div class="transform skew-x-12">
             {{ mode === 'attack' ? 'ATTACK' : (mode === 'territory' ? 'TERRITORY' : (mode === 'occupy' ? 'OCCUPY' : 'CLASSIC')) }}
           </div>
         </div>
      </div>
      <div class="flex flex-col items-center">
        <span class="text-xs text-stone-400 font-bold tracking-widest">TIME</span>
        <div class="font-mono text-3xl font-black" :class="{'text-red-500 animate-pulse': timeLeft <= 10}">
          {{ timeLeft }}<span class="text-base align-top ml-0.5">s</span>
        </div>
      </div>
    </div>

    <div 
      class="game-board grid grid-cols-[repeat(15,minmax(0,1fr))] gap-1.5 bg-white p-3 rounded-2xl shadow-xl shadow-stone-200 border-4 transition-all duration-300"
      :class="{
        'border-red-100': mode === 'attack',
        'border-blue-100': mode === 'territory',
        'border-indigo-100': mode === 'occupy',
        'border-stone-100': mode === 'classic'
      }"
      @mouseleave="onGlobalMouseUp"
    >
      <div
        v-for="cell in flatBoard"
        :key="cell.id"
        class="w-8 h-8 md:w-10 md:h-10 lg:w-12 lg:h-12 flex items-center justify-center text-xl font-black rounded-lg cursor-pointer transition-all duration-100 border-b-4 relative overflow-hidden"
        :class="{
          'opacity-0': cell.status === 'cleared' || cell.status === 'opponent-cleared', 
          'bg-stone-100 border-stone-200 text-stone-600 hover:bg-white hover:-translate-y-0.5': cell.status === 'normal' && !selectedCellIds.has(cell.id) && !occupiedCells[cell.id],
          'text-white translate-y-0.5 border-b-0 shadow-inner occupied-cell': occupiedCells[cell.id] && !selectedCellIds.has(cell.id), 
          'bg-blue-500 border-blue-700 text-white translate-y-0.5 border-b-0 shadow-inner': selectedCellIds.has(cell.id),
          'bg-red-500 border-red-700': selectedCellIds.has(cell.id) && currentSum > 10,
          'bg-green-500 border-green-700': selectedCellIds.has(cell.id) && currentSum === 10,
          'bg-stone-600 border-stone-800 text-stone-400 cursor-not-allowed petrified-bg': cell.status === 'petrified',
        }"
        :style="occupiedCells[cell.id] && !selectedCellIds.has(cell.id) ? { 
            backgroundColor: getPlayerColor(occupiedCells[cell.id]!),
            borderColor: getPlayerColor(occupiedCells[cell.id]!) 
        } : {}"
        @mousedown.prevent="onMouseDown(cell)"
        @mouseenter="onMouseEnter(cell)"
        :title="showDebug ? `(${cell.x}, ${cell.y}) ID:${cell.id} Val:${cell.value} Stat:${cell.status}` : undefined"
      >
        <span v-if="cell.status === 'petrified'" class="opacity-50">🪨</span>
        <span v-if="cell.status !== 'petrified' && cell.status !== 'opponent-cleared'">{{ cell.value }}</span>
      </div>
    </div>

    <!-- DEBUG OVERLAY -->
    <div v-if="showDebug" class="fixed bottom-4 right-4 bg-black/80 text-white p-4 rounded font-mono text-xs z-50 pointer-events-none">
      <div>Start: {{ startPos }}</div>
      <div>Current: {{ currentPos }}</div>
      <div>Selected: {{ selectedCellIds.size }}</div>
      <div>Sum: {{ currentSum }}</div>
    </div>

  </div>
</template>

<style scoped>
.select-none { user-select: none; -webkit-user-select: none; }
.shake { animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both; }
@keyframes shake {
  10%, 90% { transform: translate3d(-1px, 0, 0); }
  20%, 80% { transform: translate3d(2px, 0, 0); }
  30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
  40%, 60% { transform: translate3d(4px, 0, 0); }
}
.petrified-bg {
  background-image: radial-gradient(circle, #44403c 15%, transparent 15%);
  background-size: 6px 6px;
}
</style>