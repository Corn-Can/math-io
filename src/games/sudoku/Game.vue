<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, triggerRef } from 'vue';
import { useRoute } from 'vue-router';
import { playSound, playBgm } from '@/utils/audio';
import type { Socket } from 'socket.io-client';
import { SudokuEngine, type SudokuCell, type Difficulty } from './logic';

const props = defineProps<{
  mode: string;
  options: any;
  seed?: number;
  socket: Socket | null;
  players?: any[];
}>();

const emit = defineEmits(['game-over', 'score-update']);
const route = useRoute();

// --- Game State ---
const size = computed(() => Number(props.options?.size || 9));
const difficulty = computed(() => (props.options?.difficulty || 'medium') as Difficulty);
const engine = ref<SudokuEngine | null>(null);
const flatGrid = computed(() => engine.value?.grid.flat() || []);
const selectedCell = ref<{x: number, y: number} | null>(null);
const activeNumber = ref<number | null>(null); // For "Fast Fill" / "Highlighting"

// For Rush Mode
const occupiedCells = ref<Record<string, string>>({}); // "x-y" -> playerId

// --- Initialization ---
onMounted(() => {
    // Determine seed: props.seed (Synced) or random
    const gameSeed = props.seed || Math.floor(Math.random() * 1000000);
    
    engine.value = new SudokuEngine(size.value, gameSeed);
    
    // In Classic mode, we generate locally.
    // In Rush mode, the server generates/validates, but for rendering we usually need a local copy.
    // Wait, SudokuGenerator is fast. We can generate locally even for Rush mode as long as SEED is synced!
    // Yes, Shared Seed = Same Puzzle.
    engine.value.generate(difficulty.value);

    // Initial sync for Rush mode (if joining late)
    // Server might send "occupiedCells" snapshot in 'game-started' or 'room-state'.
    // We'll trust the socket listeners to patch that.
    
    startTimer();
    playBgm('game');
    window.addEventListener('keydown', onKeyDown);
    
    if (props.socket) {
        props.socket.on('sudoku-board-update', onBoardUpdate); // Rush Mode Update
        props.socket.on('sudoku-error', onErrorReceived); // Rush Mode Error
    }
});

onUnmounted(() => {
    window.removeEventListener('keydown', onKeyDown);
    if (timerInterval) clearInterval(timerInterval);
    if (props.socket) {
        props.socket.off('sudoku-board-update');
        props.socket.off('sudoku-error');
    }
});

// --- Timer & Score ---
const GAME_DURATION = computed(() => props.options?.duration ? Number(props.options.duration) : 0);
const timeLeft = ref(0); // Set in watcher or mounted
const score = ref(0);
let timerInterval: any = null;

watch(GAME_DURATION, (newVal) => {
    timeLeft.value = newVal;
}, { immediate: true });

const startTimer = () => {
    if (GAME_DURATION.value === 0) return; // Infinite
    timeLeft.value = GAME_DURATION.value;
    timerInterval = setInterval(() => {
        if (timeLeft.value > 0) timeLeft.value--;
        else endGame();
    }, 1000);
};

const endGame = () => {
    if (timerInterval) clearInterval(timerInterval);
    emit('game-over', { score: score.value });
};

// --- Counts Logic ---
const numberCounts = computed(() => {
    const counts: Record<number, number> = {};
    if (!engine.value) return counts;
    
    // Initialize with total needed (Size * Size per number? No, Size per number i.e. 9 ones, 9 twos)
    for(let i=1; i<=size.value; i++) counts[i] = size.value;
    
    // Subtract existing
    flatGrid.value.forEach(cell => {
        if (cell.value) {
            counts[cell.value] = (counts[cell.value] || 0) - 1;
        }
    });
    
    // Rush mode: Also check occupation?
    // In Rush mode engine.grid is updated when board updates, so flatGrid handles it.
    
    return counts;
});

// --- Interaction ---
const selectCell = (cell: SudokuCell) => {
    selectedCell.value = { x: cell.x, y: cell.y };
    
    // If cell has value, set active number for observation
    if (cell.value) {
        activeNumber.value = cell.value;
    } 
    // STRICT: Clicking a cell NEVER fills it, regardless of activeNumber.
    // We only select.
    playSound('common', 'select', 0.2);
};

// Check if a cell is "owned" in Rush mode or "locked"
const isFixed = (cell: SudokuCell) => {
    if (!cell) return false;
    if (cell.isLocked) return true;
    if (props.mode === 'rush' && occupiedCells.value[`${cell.x}-${cell.y}`]) return true; // Already solved by someone
    return false;
};

// --- Mode Logic ---
const isRush = computed(() => props.mode === 'rush');

const handleInput = (val: number) => {
    // Block input if Eliminated
    if (isEliminated.value) return;

    if (!selectedCell.value) {
        activeNumber.value = val; 
        return;
    }

    const { x, y } = selectedCell.value;
    const cell = engine.value?.grid[y]?.[x];
    if (!cell || !engine.value) return;
    
    // Check if fixed (Use the helper to avoid lint error)
    if (isFixed(cell)) {
        // Just Highlight/Navigate if fixed
        activeNumber.value = val;
        
        // Always try to jump to the nearest instance of the number pressed
        const nearby = findNearestCell(x, y, val);
        console.log('[Game] Navigation triggered. Current:', x, y, 'Val:', val, 'Found:', nearby);
        
        if (nearby) {
            selectedCell.value = { x: nearby.x, y: nearby.y };
            playSound('common', 'select', 0.2);
        }
        
        return;
    }
    
    // CASE A: Cell is EMPTY (or not fixed) -> FILL IT
    // Note: We already checked isFixed above.
    // Double check if cell has value but not fixed? (e.g. user filled in Classic).
    // In Classic, user filled cells are not locked immediately unless correct?
    // Code says: cell.isLocked = true if correct. So incorrect ones are editable.
    
    activeNumber.value = val;

    if (props.mode === 'classic') {
        const isCorrect = engine.value.checkMove(x, y, val);
        if (isCorrect) {
            cell.value = val;
            cell.isLocked = true;
            triggerRef(engine); // Force Update
            playSound('sudoku', 'match', 0.5);
            updateProgress();
        } else {
            handleMistake(cell);
        }
    } else if (props.mode === 'rush') {
        if (!engine.value?.checkMove(x, y, val)) {
            handleMistake(cell);
            return;
        }

        const roomId = route.query.room;
        cell.value = val;
        occupiedCells.value[`${x}-${y}`] = props.socket?.id || 'me';
        triggerRef(engine); // Force Update
        
        props.socket?.emit('sudoku-move', { roomId, x, y, value: val });
    }
};


const mistakes = ref(0);
const isEliminated = ref(false); // Local state for elimination (Spectator Mode)

const MISTAKE_LIMIT = computed(() => {
    const limit = Number(props.options?.mistakeLimit);
    // Debug
    // console.log('Mistake limit:', limit, props.options);
    return isNaN(limit) ? 3 : limit; 
});

const handleMistake = (cell: SudokuCell) => {
    highlightError(cell);
    
    // Check if infinite (0)
    if (MISTAKE_LIMIT.value <= 0) return;

    mistakes.value++;
    if (mistakes.value >= MISTAKE_LIMIT.value) {
        // ELIMINATED -> Enter Spectator Mode
        isEliminated.value = true;
        playSound('sudoku', 'error', 1.0); // Use error sound for gameover/elimination
        
        // Notify Server
        const roomId = route.query.room;
        console.log('[Game] Emitting player-eliminated for:', roomId);
        props.socket?.emit('player-eliminated', { roomId });
    }
};

const highlightError = (cell: SudokuCell) => {
    if (!engine.value) return;
    cell.isError = true;
    triggerRef(engine); // Force Vue to see the change
    
    //playSound('fruitbox', 'error', 0.5);

    setTimeout(() => { 
        if (engine.value) {
            cell.isError = false;
            triggerRef(engine); // Force Vue to remove the class
        }
    }, 800);
};

const findNearestCell = (currentX: number, currentY: number, val: number): { x: number, y: number, dist: number } | null => {
    if (!engine.value) return null;
    
    let nearest: { x: number, y: number, dist: number } | null = null;
    
    engine.value.grid.forEach(row => {
        row.forEach(cell => {
             // Find cell with same value
             if (cell.value === val && (cell.x !== currentX || cell.y !== currentY)) {
                 const dist = Math.abs(cell.x - currentX) + Math.abs(cell.y - currentY); // Manhattan distance
                 if (!nearest || dist < nearest.dist) {
                     nearest = { x: cell.x, y: cell.y, dist };
                 }
             }
        });
    });
    
    return nearest;
};

// --- Key Handling ---
const onKeyDown = (e: KeyboardEvent) => {
    // Arrows / WASD navigation could be added here
    if (e.key >= '0' && e.key <= '9') {
        const num = parseInt(e.key);
        if (num >= 1 && num <= 9) handleInput(num);
    }
    // Hex support for 16x16?
    // If size > 9, support a-g?
    // Let's support standard numeric typing for >9 (requires buffer? naive implementation: 1..9, A..G key mapping)
    if (size.value > 9) {
        // Mapping a-g to 10-16
        const map: any = { 'a': 10, 'b': 11, 'c': 12, 'd': 13, 'e': 14, 'f': 15, 'g': 16 };
        if (map[e.key.toLowerCase()]) handleInput(map[e.key.toLowerCase()]);
    }
    
    // Navigation
    if(!selectedCell.value) return;
    let {x, y} = selectedCell.value;
    if(e.key === 'ArrowUp') y = Math.max(0, y-1);
    if(e.key === 'ArrowDown') y = Math.min(size.value-1, y+1);
    if(e.key === 'ArrowLeft') x = Math.max(0, x-1);
    if(e.key === 'ArrowRight') x = Math.min(size.value-1, x+1);
    
    if(x !== selectedCell.value.x || y !== selectedCell.value.y) {
        // Move selection
        // Note: selectCell sets activeNumber if cell has value.
        // We might want to preserve activeNumber if moving to empty cell?
        // Let's rely on selectCell.
        const target = engine.value!.grid[y]?.[x];
        selectedCell.value = { x, y };
        if(target?.value) activeNumber.value = target.value; 
        playSound('common', 'select', 0.1);
    }
};

// --- Socket Handlers (Rush) ---
const onBoardUpdate = (data: any) => {
    try {
        // { x, y, value, playerId, scoreDelta }
        if (!engine.value) return;
        const { x, y, value, playerId } = data;
        
        // Safety check for grid bounds
        if (!engine.value.grid[y] || !engine.value.grid[y][x]) {
            console.warn('[Game] Invalid update coordinates:', x, y);
            return;
        }
        
        const cell = engine.value.grid[y][x];
        
        cell.value = value;
        // Mark as occupied
        occupiedCells.value[`${x}-${y}`] = playerId;
        
        // Force reactivity update
        triggerRef(engine);
        
        // If it's me, play sound
        if (props.socket?.id === playerId) {
            playSound('sudoku', 'match', 0.5);
        }

        // Check for Board Completion (Host/Any Client authoritative check)
        checkBoardFull();

    } catch (e) {
        console.error('[Game] Error in onBoardUpdate:', e);
    }
};

const checkBoardFull = () => {
    if (!engine.value) return;
    
    // Check if every cell has a value
    // In Rush mode, occupiedCells tracks valid moves, but pre-filled cells are not in occupiedCells.
    // engine.value.grid has the state.
    
    const isFull = engine.value.grid.every(row => row.every(cell => cell.value !== null));
    
    if (isFull) {
        console.log('[Game] Board Full! Emitting game-finished.');
        props.socket?.emit('game-finished', { roomId: route.query.room, score: score.value });
    }
};

const onErrorReceived = ({ x, y }: { x: number, y: number }) => {
    playSound('sudoku', 'error', 0.5);
    if(engine.value) {
        // Revert Optimistic Update
        const cell = engine.value.grid[y]?.[x];
        if (cell) {
            cell.value = null;
            delete occupiedCells.value[`${x}-${y}`];
    
            // Show Error Visual
            cell.isError = true;
            triggerRef(engine);
            setTimeout(() => { 
                if (engine.value) { 
                    const c = engine.value.grid[y]?.[x];
                    if (c) {
                        c.isError = false; 
                        triggerRef(engine); 
                    }
                } 
            }, 800);
        }
    }
};

// --- Score Sync ---
// Rush Mode: Score comes from players list (Server Authority)
watch(() => props.players, (newPlayers) => {
    if (props.mode === 'rush' && newPlayers && props.socket) {
        const me = newPlayers.find(p => p.id === props.socket?.id);
        if (me) {
            score.value = me.score || 0;
        }
    }
}, { deep: true, immediate: true });

// Classic Mode: Score is completion % using local logic
const updateProgress = () => {
    if (props.mode === 'classic' && engine.value) {
        let filled = 0;
        let total = size.value * size.value;
        engine.value.grid.forEach(row => {
            row.forEach(c => {
                 if(c.value !== null) filled++;
            });
        });
        score.value = Math.floor((filled / total) * 100);
        
        // Classic End Game Check
        if (filled === total) {
             emit('game-over', { score: 100 });
             props.socket?.emit('game-finished', { roomId: route.query.room });
        }
    }
};

// --- Visual Helpers ---
const getCellClass = (cell: SudokuCell) => {
    if (!cell) return '';
    if (!engine.value) return ''; // Safety check

    const classes = [];
    
    // Safety for selectedVal access
    let selectedVal = null;
    const sCell = selectedCell.value ? engine.value.grid[selectedCell.value.y]?.[selectedCell.value.x] : null;
    if (sCell) {
        selectedVal = sCell.value;
    }
    
    const isSelected = selectedCell.value?.x === cell.x && selectedCell.value?.y === cell.y;
    // Highlight if value matches Active Number (or selected cell's value)
    const targetVal = activeNumber.value !== null ? activeNumber.value : selectedVal;
    const isSameNumber = targetVal !== null && cell.value === targetVal;
    
    // Text Color Logic (Base classes)
    // We override color with inline style for players
    const ownerId = occupiedCells.value[`${cell.x}-${cell.y}`];
    if (ownerId && props.mode === 'rush') {
         classes.push('font-black'); // Make it thick
    } else if (cell.isLocked) {
        classes.push('text-stone-900 font-bold');
    } else {
        classes.push('text-blue-600 font-medium');
    }

    // Highlighting Backgrounds
    if (cell.isError) {
        classes.push('bg-red-500 text-white animate-shake z-20');
    } else if (isSelected) {
        classes.push('bg-blue-500 text-white ring-4 ring-blue-300 z-10'); 
    } else if (isSameNumber) {
        // If it's a player cell, we want to keep the text color but change bg?
        // Actually typical sudoku highlights bg.
        classes.push('bg-blue-200'); 
        // If it was player color, text color style handles it.
    } else if (selectedCell.value) {
        // Smart guides
        const sX = selectedCell.value.x;
        const sY = selectedCell.value.y;
        const boxW = engine.value.boxW || 3;
        const boxH = engine.value.boxH || 3;
        
        const boxX = Math.floor(cell.x / boxW);
        const boxY = Math.floor(cell.y / boxH);
        const sBoxX = Math.floor(sX / boxW);
        const sBoxY = Math.floor(sY / boxH);

        // Highlight Row, Col, and Box
        if (cell.x === sX || cell.y === sY || (boxX === sBoxX && boxY === sBoxY)) {
            classes.push('bg-stone-100');
        } else {
            classes.push('bg-white');
        }
    } else {
        classes.push('bg-white');
    }
    
    // Alternating Box Color (Checkerboard pattern for boxes)
    // To Improve Visuals if needed.
    
    return classes.join(' ');
};

// New helper for Text Color
const getCellTextColor = (cell: SudokuCell) => {
     // If Selected, always use white/default contrast from CSS (bg-blue-500 text-white)
     if (selectedCell.value && selectedCell.value.x === cell.x && selectedCell.value.y === cell.y) {
         return undefined;
     }

     const ownerId = occupiedCells.value[`${cell.x}-${cell.y}`];
     if (ownerId && props.mode === 'rush' && props.players) {
         // Return the Hex Color
         return props.players.find(p => p.id === ownerId)?.color || '#000';
     }
     return undefined;
};

// --- Numpad ---
const numpadItems = computed(() => {
    const items = [];
    if (!size.value) return [];
    for(let i=1; i<=size.value; i++) {
        // Show if count > 0 -> User Request: "Hide if none left"
        if ((numberCounts.value[i] || 0) > 0) {
            items.push(i);
        }
    }
    return items;
});

const formatNum = (n: number) => {
    if (size.value > 9) {
       // Use A-G for 10-16 for single char display
       if(n===10) return 'A';
       if(n===11) return 'B';
       if(n===12) return 'C';
       if(n===13) return 'D';
       if(n===14) return 'E';
       if(n===15) return 'F';
       if(n===16) return 'G';
    }
    return n.toString();
};

</script>

<template>
  <div class="flex flex-col h-full bg-stone-50 items-center justify-center relative select-none">
    
    <div v-if="!engine" class="absolute inset-0 flex items-center justify-center text-stone-400">
        Loading Sudoku Engine... (Size: {{size}}, Difficulty: {{difficulty}})
    </div>
    
    <!-- Spectator Mode Indicator -->
    <div v-if="isEliminated" class="absolute bottom-20 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
        <div class="bg-stone-900/90 text-white px-6 py-3 rounded-full shadow-xl flex items-center gap-3 animate-pulse">
            <span class="w-3 h-3 bg-red-500 rounded-full animate-ping"></span>
            <div class="flex flex-col leading-none">
                <span class="font-black text-sm uppercase tracking-wider">ELIMINATED</span>
                <span class="font-mono text-[10px] opacity-60">Spectator Mode Active</span>
            </div>
        </div>
    </div>

    <!-- Header Info -->
    <div v-else class="absolute top-4 left-4 right-4 flex justify-between items-start pointer-events-none">
        <div class="bg-white/90 backdrop-blur px-4 py-2 rounded-xl shadow-lg border border-stone-200 flex flex-col items-center">
            <span class="text-[10px] font-black tracking-widest text-stone-400 uppercase">{{ isRush ? 'Score' : 'Completion' }}</span>
            <span class="text-2xl font-black text-stone-800">{{ score }}{{ isRush ? '' : '%' }}</span>
        </div>
        
        <div v-if="GAME_DURATION > 0" class="bg-white/90 backdrop-blur px-4 py-2 rounded-xl shadow-lg border border-stone-200 flex flex-col items-center">
             <span class="text-[10px] font-black tracking-widest text-stone-400 uppercase">Time</span>
             <span class="font-mono text-2xl font-black" :class="timeLeft < 30 ? 'text-red-500 animate-pulse' : 'text-stone-800'">
                 {{ Math.floor(timeLeft / 60) }}:{{ (timeLeft % 60).toString().padStart(2, '0') }}
             </span>
        </div>

        <div v-if="MISTAKE_LIMIT > 0" class="bg-white/90 backdrop-blur px-4 py-2 rounded-xl shadow-lg border border-stone-200 flex flex-col items-center">
             <span class="text-[10px] font-black tracking-widest text-stone-400 uppercase">Mistakes</span>
             <span class="font-mono text-2xl font-black" :class="mistakes >= MISTAKE_LIMIT - 1 ? 'text-red-600' : 'text-stone-800'">
                 {{ mistakes }}/{{ MISTAKE_LIMIT }}
             </span>
        </div>
    </div>

    <!-- Board Container -->
    <div class="flex-1 flex items-center justify-center w-full p-4 overflow-hidden">
        
        <!-- Sudoku Grid -->
        <div v-if="engine" 
             class="sudoku-grid bg-white border-4 border-stone-800 rounded-xl shadow-2xl relative select-none"
             :style="{
                 gridTemplateColumns: `repeat(${size}, 1fr)`,
                 '--box-w': engine.boxW,
                 '--size': size
             }"
        >
            <div v-for="cell in flatGrid" :key="`${cell.x}-${cell.y}`"
                 class="cell flex items-center justify-center font-mono cursor-pointer transition-colors duration-75 relative"
                 :class="[
                     getCellClass(cell),
                     // Right Border (Skip last column)
                     cell.x < size - 1 
                        ? ((cell.x + 1) % engine.boxW === 0 ? 'border-r border-stone-500' : 'border-r border-stone-200')
                        : '',
                     
                     // Bottom Border (Skip last row)
                     cell.y < size - 1
                        ? ((cell.y + 1) % engine.boxH === 0 ? 'border-b border-stone-500' : 'border-b border-stone-200')
                        : '',
                     // Font Size based on Board Size
                     size >= 16 ? 'text-xs w-6 h-6 md:w-8 md:h-8' : 
                     size >= 9 ? 'text-lg md:text-2xl w-8 h-8 md:w-12 md:h-12' : 
                     'text-2xl md:text-3xl w-12 h-12 md:w-16 md:h-16'
                 ]"
                 :style="{ color: getCellTextColor(cell) }"
                 @mousedown="selectCell(cell)"
            >
                <!-- Value -->
                <span v-if="cell.value">{{ formatNum(cell.value) }}</span>
            </div>
        </div>
        
    </div>

    <!-- Numpad -->
    <div class="bg-white border-t border-stone-200 w-full p-4 z-10 flex flex-col items-center gap-2 shadow-[0_-10px_40px_rgba(0,0,0,0.1)]">
        <div class="flex flex-wrap justify-center gap-2 max-w-2xl">
            <button v-for="n in numpadItems" :key="n"
                    @click="handleInput(n)"
                    class="w-10 h-14 md:w-14 md:h-16 rounded-xl font-black text-xl shadow-md border-b-4 transition-all active:scale-95 active:border-b-0 active:translate-y-1 relative flex flex-col items-center justify-center pt-1"
                    :class="[
                        activeNumber === n ? 'bg-blue-500 text-white border-blue-700' : 'bg-stone-100 text-stone-700 border-stone-300 hover:bg-stone-200'
                    ]"
            >
                <span>{{ formatNum(n) }}</span>
                <span class="text-[10px] opacity-60 font-medium -mt-1">{{ numberCounts[n] }}</span>
            </button>
        </div>
    </div>

  </div>
</template>

<style scoped>
.sudoku-grid {
    display: grid;
    /* gap: 0; Borders handle separation */
}
/* Custom spacing solution for boxes using data attributes might be cleaner, 
   but simplistic margin approach works if GAP is handled.
   Actually 'gap-1' applies everywhere. 
   To visualize boxes, we usually use thicker borders. 
   Tailwind 'divide' or specific border classes on cells are best.
   I implemented conditional margins in the template (mr-1, mb-1) combined with grid gap.
*/
.animate-shake {
    animation: shake 0.4s cubic-bezier(.36,.07,.19,.97) both;
}
@keyframes shake {
  10%, 90% { transform: translate3d(-1px, 0, 0); }
  20%, 80% { transform: translate3d(2px, 0, 0); }
  30%, 50%, 70% { transform: translate3d(-2px, 0, 0); }
  40%, 60% { transform: translate3d(2px, 0, 0); }
}
</style>
