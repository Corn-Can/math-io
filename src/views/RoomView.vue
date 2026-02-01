<script setup lang="ts">
import { computed, ref, onMounted, defineAsyncComponent, onUnmounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { GAME_REGISTRY } from '@/games/registry';
import { io, type Socket } from 'socket.io-client';
import { playSound } from '@/utils/audio';
import LobbyPlayers from '@/components/lobby/LobbyPlayers.vue';
import LobbySettings from '@/components/lobby/LobbySettings.vue';
import HelpModal from '@/components/ui/HelpModal.vue';
import AlertModal from '@/components/ui/AlertModal.vue';
import { useT } from '@/utils/i18n-tracker';
import { usePremium } from '@/composables/usePremium';
import { useScreenSize } from '@/composables/useScreenSize';

import GoogleAd from '@/components/GoogleAd.vue';
import GameResultModal from '@/components/game/GameResultModal.vue';

// Local flag to override server state for lobby return
const localLobbyOverride = ref(false);

const { t } = useT();
const route = useRoute();
const router = useRouter();
const { isMobile } = useScreenSize();

const showHelp = ref(false);
const showAlert = ref(false);
const alertMessage = ref('');
const showMobileMenu = ref(false);

const roomId = route.query.room as string;
const gameId = (route.query.game as string) || 'fruitbox';
const currentGame = GAME_REGISTRY[gameId];

if (!currentGame || !roomId) {
  alertMessage.value = t('room.invalidRoom', 'Invalid room');
  showAlert.value = true;
  router.replace('/');
}

const roomState = ref<'LOBBY' | 'COUNTDOWN' | 'PLAYING' | 'RESULT'>('LOBBY');
const currentMode = ref((route.query.mode as string) || currentGame?.modes[0]?.id || 'classic');
const gameDuration = ref(60);
const gameOptions = ref({});
const activeTab = ref<'players' | 'settings'>('players');

//贊助
const { isPremium, verifyCode } = usePremium();
const showRedeem = ref(false);
const redeemCode = ref('');

const handleRedeem = () => {
  if (verifyCode(redeemCode.value)) {
    alertMessage.value = t('room.vipSuccess', 'VIP enabled! Ads removed!');
    showAlert.value = true;
    showRedeem.value = false;
    redeemCode.value = '';
  } else {
    alertMessage.value = t('room.invalidCode', 'Invalid code');
    showAlert.value = true;
    redeemCode.value = '';
  }
};

// socket 連線位址
const SOCKET_URL = import.meta.env.PROD
  ? 'https://math-io-server.onrender.com'
  : 'http://localhost:3000';

// 連線相關
const socket = ref<Socket | null>(null);
const isConnected = ref(false);
const gameSeed = ref(0);
const gameStartTime = ref<number | null>(null);
const serverStatus = ref('waiting');

interface Player {
  id: string;
  name: string;
  score: number;
  isReady: boolean;
  color: string;
  isEliminated?: boolean;
}
const players = ref<Player[]>([]);
const myId = ref('');
const hostId = ref('');
const countdownVal = ref(0);

const gameComp = computed(() => currentGame ? defineAsyncComponent(currentGame.component) : null);
const maxPlayers = computed(() => (currentGame as any)?.maxPlayers || 8);
const isHost = computed(() => myId.value === hostId.value);
const amIReady = computed(() => players.value.find(p => p.id === myId.value)?.isReady || false);
const amIEliminated = computed(() => players.value.find(p => p.id === myId.value)?.isEliminated || false);
const allReady = computed(() => players.value.length >= 2 && players.value.every(p => p.isReady || p.id === hostId.value));

const finalResult = ref<any>(null);
const finalPlayers = ref<Player[]>([]); // Snapshot for result modal

const sortedPlayers = computed(() => {
  return [...players.value].sort((a, b) => {
    // Priority: Alive first
    if (!!a.isEliminated !== !!b.isEliminated) {
        return a.isEliminated ? 1 : -1;
    }
    return b.score - a.score;
  });
});



const isMatchEnded = ref(false);
const showResultModal = ref(false);
const serverTimeOffset = ref(0); // To allow Game.vue to render accurate synchronized time

const matchResult = computed(() => {
  if (sortedPlayers.value.length === 0) return 'DRAW';
  const winner = sortedPlayers.value[0];
  if (!winner) return 'DRAW';
  if (winner.id === myId.value) return 'WIN';
  return 'LOSE';
});

onMounted(() => {
  socket.value = io(SOCKET_URL);

  socket.value.on('connect', () => {
    isConnected.value = true;
    myId.value = socket.value?.id || '';
    socket.value?.emit('join-room', {roomId, name: localStorage.getItem('math_io_username') || 'Player'});
    // Start Sync
    socket.value?.emit('sync-time', Date.now());
  });

  socket.value.on('error', (msg: string) => {
    alertMessage.value = msg;
    showAlert.value = true;
    router.replace('/');
  });

  // Time Sync Response
  socket.value.on('sync-time-response', (data: { serverTime: number, clientSendTime: number }) => {
      const now = Date.now();
      const latency = (now - data.clientSendTime) / 2;
      // ServerTime = LocalTime + Offset
      // Data.ServerTime = (LocalSend + Latency) + Offset
      // Offset = Data.ServerTime - (LocalSend + Latency)
      serverTimeOffset.value = data.serverTime - (data.clientSendTime + latency);
      console.log('Time Synced. Offset:', serverTimeOffset.value, 'ms, Latency:', latency, 'ms');
  });

  socket.value.on('room-state', (state: any) => {
    currentMode.value = state.mode;
    hostId.value = state.hostId;
    gameDuration.value = state.duration !== undefined ? state.duration : 60;
    // Merge options (ensure we trigger reactivity)
    if (state.options) {
        gameOptions.value = { ...state.options };
    }
    serverStatus.value = state.status;
    
    // Clear Match Ended flag if server resets to lobby or starts new game
    if (state.status === 'waiting' || state.status === 'playing') {
       isMatchEnded.value = false;
    }
    
    // Sync Start Time if valid
    if (state.startTime && state.status === 'playing') {
        gameStartTime.value = state.startTime;
    } else {
        gameStartTime.value = null;
    }

    if (state.seed) {
        gameSeed.value = state.seed;
    }
    // If server says waiting, go to lobby (clear override)
    if (state.status === 'waiting') {
        roomState.value = 'LOBBY';
        localLobbyOverride.value = false; 
    }
    else if (state.status === 'playing') {
        // Late Join: Always go to LOBBY first to wait/spectate
        // Unless we determine we are an ACTIVE player? (Optimization for rejoiners)
        // User requested: "Players can join in middle, but wait in lobby"
        // So we default to LOBBY.
        roomState.value = 'LOBBY';
        localLobbyOverride.value = true;
    }
  });

  socket.value.on('update-players', (serverPlayers: Player[]) => {
    players.value = serverPlayers;
  });

  socket.value.on('mode-updated', (mode: string) => {
    currentMode.value = mode;
    // Update URL to reflect mode change
    router.replace({ query: { ...route.query, mode } });
  });

  socket.value.on('duration-updated', (duration: number) => {
    gameDuration.value = duration;
  });

  socket.value.on('options-updated', (opts: any) => {
    gameOptions.value = { ...gameOptions.value, ...opts };
  });

  socket.value.on('host-updated', (newHostId: string) => {
    hostId.value = newHostId;
  });

  socket.value.on('countdown-start', (seconds: number) => {
    roomState.value = 'COUNTDOWN';
    countdownVal.value = seconds;
    const interval = setInterval(() => {
        countdownVal.value--;
        if (countdownVal.value <= 0) {
            clearInterval(interval);
        } else {
            playSound('common', 'select', 0.5);
        }
    }, 1000);
    playSound('common', 'select', 0.5);
  });

  socket.value.on('game-started', (payload: any) => {
    // payload might be number (old) or object (new)
    if (typeof payload === 'object') {
        gameSeed.value = payload.seed;
        gameStartTime.value = payload.startTime;
        
        // Critical Sync
        if (payload.duration !== undefined) gameDuration.value = payload.duration;
        if (payload.mode) currentMode.value = payload.mode;
        if (payload.options) gameOptions.value = payload.options;
        
    } else {
        gameSeed.value = payload;
        gameStartTime.value = Date.now();
    }
    // Clear override on new game start (force join)
    localLobbyOverride.value = false;
    roomState.value = 'PLAYING';
    serverStatus.value = 'playing';
    playSound('common', 'select', 0.8);
  });

  socket.value.on('game-over', (result: any) => {
    // Show Result Modal regardless of state
    isMatchEnded.value = true;
    finalResult.value = result;
    // Snapshot players scores/status for the result board before they are reset
    finalPlayers.value = JSON.parse(JSON.stringify(sortedPlayers.value));
    showResultModal.value = true;
    
    // Auto-Reset Room if Host
    if (isHost.value) {
        setTimeout(() => {
            socket.value?.emit('reset-room', roomId);
        }, 500); // Small delay to ensuring clients receive game-over first
    }

    // Play sound based on result
    setTimeout(() => {
      if (matchResult.value === 'WIN') {
        playSound('common', 'win', 0.8);
      } else if (matchResult.value === 'LOSE') {
        playSound('common', 'lose', 0.3);
      }
    }, 300);
  });
});

onUnmounted(() => {
  if (socket.value) socket.value.disconnect();
});

// --- Time Sync ---
const syncTime = () => {
    socket.value?.emit('sync-time', Date.now());
};

const toggleReady = () => {
    // User requested unrestricted ready toggling
    socket.value?.emit('toggle-ready', roomId);
    playSound('common', 'select', 0.5);
};

const changeMode = (mode: string) => {
    if (isHost.value) {
        socket.value?.emit('update-mode', { roomId, mode });
    }
};

const updateDuration = (duration: number) => {
    if (isHost.value) {
        socket.value?.emit('update-duration', { roomId, duration });
    }
};

const handleUpdateSettings = ({ key, value }: { key: string, value: any }) => {
    // For now, we only support 'duration', but this makes it extensible
    if (key === 'duration') {
        updateDuration(Number(value));
        // Reset match ended flag if host changes settings (implies intent to restart?)
        // actually, changing settings usually happens before start.
    } else {
        // Generic Update
        socket.value?.emit('update-options', { roomId, options: { [key]: value } });
    }
};

const transferHost = (targetId: string) => {
    if (isHost.value) {
        socket.value?.emit('transfer-host', { roomId, newHostId: targetId });
    }
};

const startCountdown = () => {
  if (socket.value && isConnected.value && isHost.value && allReady.value) {
    socket.value.emit('start-countdown', roomId);
  }
};

const handleScoreUpdate = (newScore: number) => {
  if (socket.value) {
    socket.value.emit('update-score', { roomId: roomId, score: newScore });
  }
};

const handleGameOver = (result: any) => {
  finalResult.value = result;
  showResultModal.value = true;
};

const handleShowResult = (payload: any) => {
    finalResult.value = payload;
    showResultModal.value = true;
};

// watch(roomState) remove or adjust if needed, currently sound is handled in event


const restartGame = () => {
  if (isHost.value) {
    socket.value?.emit('reset-room', roomId);
  }
  // We don't force LOBBY here locally, wait for server
  // But we close the modal? Or keep it open?
  // User wants: "Wait for host reset... prevent forcing everyone back"
  // If host clicks "Play Again", server resets.
  // We can close our own modal if we are the host, OR just leave it open until server status changes?
  // Actually, standard UX: if I click "Play Again", I usually expect to go to lobby.
  // But for others, it should stay open.
  showResultModal.value = false; 
};

const handleBackToLobby = () => {
    localLobbyOverride.value = true;
    roomState.value = 'LOBBY';
    showResultModal.value = false;
};
</script>

<template>
  <div class="flex h-screen bg-stone-50 font-sans overflow-hidden text-stone-800 selection:bg-stone-300">
    
    <!-- Mobile Sidebar Overlay -->
    <div v-if="showMobileMenu" class="fixed inset-0 bg-black/50 z-30 lg:hidden backdrop-blur-sm" @click="showMobileMenu = false"></div>

    <aside class="fixed inset-y-0 left-0 z-40 w-80 bg-stone-100 border-r border-stone-200 flex flex-col shadow-2xl transform transition-transform duration-300 lg:translate-x-0 lg:static lg:shadow-xl"
           :class="showMobileMenu ? 'translate-x-0' : '-translate-x-full'">
      
      <div class="p-6 pt-24 lg:pt-6 bg-white border-b border-stone-200">
        <h1 class="text-2xl font-black text-stone-900 leading-none mb-1">
          {{ t(currentGame?.nameKey || '') }}
        </h1>
        <div class="flex items-center gap-2">
          <span class="px-2 py-1 bg-stone-200 text-stone-600 text-xs font-mono font-bold rounded-md">
            {{ roomId }}
          </span>
          <div class="flex items-center gap-1.5 px-2 py-1 bg-stone-800 text-stone-50 text-xs font-bold rounded-md">
            <div :class="isConnected ? 'bg-green-400' : 'bg-red-400'" class="w-2 h-2 rounded-full"></div>
            {{ isConnected ? 'ONLINE' : 'OFFLINE' }}
          </div>
          <button @click="showHelp = true" class="w-8 h-8 rounded-full bg-stone-200 hover:bg-stone-300 flex items-center justify-center transition-colors ml-auto" :title="t('room.guide', 'Game Guide')">
            <span class="text-lg">?</span>
          </button>
        </div>
      </div>

      <div class="flex-1 overflow-y-auto p-4 space-y-2">
        <div class="text-xs font-bold text-stone-400 uppercase tracking-widest px-2 mb-2">
          {{ t('room.leaderboard', 'Leaderboard') }} ({{ players.length }})
        </div>

        <TransitionGroup name="list">
          <div 
            v-for="(p, index) in sortedPlayers" 
            :key="p.id"
            class="relative flex items-center justify-between p-3 rounded-lg transition-all duration-500 border-2 shadow-sm"
            :class="[
              p.id === myId 
                ? 'bg-stone-50 border-stone-300' 
                : 'bg-white border-transparent hover:border-stone-200'
            ]"
            :style="{ borderColor: p.color }"
          >
            <div class="flex items-center gap-3 overflow-hidden">
              <div class="font-black text-lg w-6 text-center opacity-50" :style="{ color: p.color }">
                {{ index + 1 }}
              </div>
              <div class="flex flex-col">
                  <div class="font-bold text-sm truncate max-w-[8rem] flex items-center gap-2">
                      {{ p.name }}
                      <span v-if="p.id === myId" class="text-[10px] bg-stone-200 px-1 rounded text-stone-500">YOU</span>
                  </div>
              </div>
              <span v-if="p.id === hostId" class="text-[10px] bg-yellow-400 text-yellow-900 px-1.5 py-0.5 rounded font-black ml-auto">HOST</span>
            </div>
            <div class="font-mono font-bold text-lg" :style="{ color: p.color }">
                {{ p.score }}{{ currentGame?.id === 'sudoku' && currentMode === 'classic' ? '%' : '' }}
            </div>
          </div>
        </TransitionGroup>
      </div>

      <div class="p-4 pb-24 bg-stone-200 text-center text-xs text-stone-500 font-mono border-t border-stone-300 flex flex-col gap-2">
        <button @click="router.push(`/lobby/${gameId}`)" class="w-full py-2 bg-white text-stone-600 rounded-lg font-bold hover:bg-red-50 hover:text-red-500 transition shadow-sm">
           {{ t('room.exit', 'EXIT ROOM') }}
        </button>
        <span>Math.io • v1.0</span>
      </div>
    </aside>

    <main class="flex-1 relative bg-stone-50 flex flex-col w-full">
      
      <!-- Mobile Menu Button -->
      <button @click="showMobileMenu = !showMobileMenu" class="lg:hidden absolute top-4 left-4 z-50 p-2 bg-white rounded-lg shadow-md border border-stone-200 text-stone-600 transition-colors" :class="showMobileMenu ? 'bg-stone-100 text-stone-900' : ''">
        <svg v-if="!showMobileMenu" xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
        <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
           <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <div v-if="roomState === 'LOBBY'" class="flex-1 flex flex-col relative overflow-hidden">
        
        <!-- Scrollable Content -->
        <div class="flex-1 overflow-y-auto p-8 custom-scrollbar">
            <div class="max-w-4xl w-full mx-auto pb-8">
              
              <div class="text-center mb-10 mt-8">
                <h2 class="text-4xl font-black text-stone-800 mb-2 tracking-tight">{{ t('room.waitingRoom', 'WAITING ROOM') }}</h2>
                <div v-if="serverStatus === 'playing' && !isMatchEnded" class="bg-amber-100 text-amber-800 px-4 py-2 rounded-lg font-bold inline-block mb-2 animate-pulse">
                    ⚠️ {{ t('room.gameInProgress', 'Game in Progress...') }}
                </div>
                <p class="text-stone-500">
                    {{ isHost ? t('room.hostWait', '你是房主，請等待玩家準備') : t('room.playerWait', '請準備並等待房主開始') }}
                </p>
              </div>

              <!-- Tab Navigation -->
              <div class="flex justify-center mb-8 sticky top-0 z-10">
                 <div class="bg-stone-200/90 backdrop-blur p-1 rounded-xl flex gap-1 shadow-sm">
                    <button 
                        @click="activeTab = 'players'"
                        class="px-6 py-2 rounded-lg text-sm font-bold transition-all"
                        :class="activeTab === 'players' ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'"
                    >
                        {{ t('room.tab.players', 'PLAYERS') }}
                    </button>
                    <button 
                        @click="activeTab = 'settings'"
                        class="px-6 py-2 rounded-lg text-sm font-bold transition-all"
                        :class="activeTab === 'settings' ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'"
                    >
                        {{ t('room.tab.rules', 'GAME RULE') }}
                    </button>
                 </div>
              </div>

              <!-- Tab Content -->
              <div class="min-h-[300px]">
                  <LobbyPlayers 
                    v-if="activeTab === 'players'"
                    :players="players"
                    :max-players="maxPlayers"
                    :host-id="hostId"
                    :my-id="myId"
                    @transfer-host="transferHost"
                  />

                  <LobbySettings 
                    v-if="activeTab === 'settings'"
                    :is-host="isHost"
                    :current-mode="currentMode"
                    :game-modes="currentGame?.modes || []"
                    :config-schema="currentGame?.configSchema"
                    :duration="gameDuration"
                    :settings="gameOptions"
                    :game-id="gameId"
                    :disabled="serverStatus === 'playing' && !isMatchEnded"
                    @update-mode="changeMode"
                    @update-duration="updateDuration"
                    @update-settings="handleUpdateSettings"
                  />
              </div>
            </div>
        </div>

        <!-- Fixed Footer Action Bar -->
        <div class="p-6 bg-white/90 backdrop-blur-md border-t border-stone-200 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] z-20 flex justify-center shrink-0">
            <!-- Player: Ready Button -->
            <button 
              v-if="!isHost"
              @click="toggleReady"
              class="w-full max-w-md py-4 rounded-xl font-black text-xl transition-all shadow-xl border-b-4 active:scale-95"
              :class="amIReady 
                ? 'bg-green-500 text-white border-green-700 hover:bg-green-400' 
                : 'bg-stone-200 text-stone-500 border-stone-300 hover:bg-stone-300'"
            >
              {{ amIReady ? t('room.ready', 'READY!') : t('room.clickToReady', 'CLICK TO READY') }}
            </button>

            <!-- Host: Start Button -->
            <button 
              v-if="isHost"
              @click="startCountdown"
              class="w-full max-w-md py-5 rounded-xl font-black text-xl transition-all shadow-xl shadow-stone-300 hover:shadow-2xl transform active:scale-95 border-b-4"
              :class="allReady
                ? 'bg-stone-800 text-white border-stone-950 hover:bg-stone-700' 
                : 'bg-stone-200 text-stone-400 border-stone-300 cursor-not-allowed'"
              :disabled="!allReady || (serverStatus === 'playing' && !isMatchEnded)"
            >
              {{ 
                  (serverStatus === 'playing' && !isMatchEnded) ? t('room.gameRunning', 'GAME RUNNING') :
                  players.length < 2 ? t('room.waitingForPlayers', 'WAITING FOR PLAYERS') : 
                  (allReady ? t('room.startGame', 'START GAME') : t('room.waitingForReady', 'WAITING FOR READY')) 
              }}
            </button>
        </div>

        <!-- Mobile Ad (Bottom of Screen) -->
        <div v-if="isMobile" class="md:hidden w-full flex justify-center bg-stone-100 border-t border-stone-200 p-1 shrink-0 z-20 h-[60px] overflow-hidden">
             <GoogleAd slotId='ca-pub-7220627835291556' format="auto" />
        </div>

      </div>

      <!-- Countdown Overlay -->
      <div v-if="roomState === 'COUNTDOWN'" class="absolute inset-0 z-50 bg-stone-900/40 backdrop-blur-sm flex items-center justify-center">
          <div class="text-center">
              <div class="text-white font-black text-[12rem] leading-none animate-ping-slow drop-shadow-2xl">
                  {{ countdownVal }}
              </div>
              <div class="text-white/80 font-bold text-2xl tracking-[1em] uppercase mt-4 animate-pulse">
                  {{ t('room.getReady', 'Get Ready') }}
              </div>
          </div>
      </div>

      <div v-else-if="roomState === 'PLAYING'" class="flex-1 flex items-center justify-center relative overflow-hidden">
        <component 
          v-if="gameComp"
          :is="gameComp"
          :key="gameSeed"
          :mode="currentMode"
          :players="players"
          :options="{ ...gameOptions, duration: gameDuration }"
          :seed="gameSeed"
          :startTime="gameStartTime"
          :server-time-offset="serverTimeOffset"
          :socket="socket" 
          @score-update="handleScoreUpdate"
          @game-over="handleGameOver"
          @back-to-lobby="handleBackToLobby"
          @show-result="handleShowResult"
        />

        <!-- Spectator 'Exit to Lobby' Button (Overlay) -->
        <!-- Only show if playing, I am eliminated, and modal is closed -->
        <div v-if="amIEliminated && !showResultModal" class="absolute top-20 left-1/2 -translate-x-1/2 z-40 pointer-events-auto flex flex-col items-center gap-2">
             <div class="bg-stone-900/90 text-white px-4 py-2 rounded-full shadow-xl flex items-center gap-2 animate-pulse cursor-default">
                <span class="w-2 h-2 bg-red-500 rounded-full animate-ping"></span>
                <span class="font-black text-xs uppercase tracking-wider">SPECTATING</span>
            </div>
            <button @click="handleBackToLobby" class="bg-red-500 text-white px-4 py-1.5 rounded-full text-[10px] font-bold shadow hover:bg-red-600 border border-red-700 active:scale-95 transition-transform">
                EXIT TO LOBBY
            </button>
        </div>
      </div>



    </main>

    <aside class="hidden md:flex w-80 bg-stone-100 border-l border-stone-200 flex-col z-20 shadow-xl shadow-stone-200/50">
      
      <div class="p-6 border-b border-stone-200">
        <div class="text-xs font-bold text-stone-400 uppercase tracking-widest mb-3">SPONSORED</div>

        <GoogleAd v-if="!isMobile" slotId='ca-pub-7220627835291556' format="rectangle" />

        <div v-if="!isPremium" class="mt-4">
            <div v-if="!showRedeem" class="text-center">
                <p class="text-[10px] text-stone-400 mb-2">Don't want to see ads?</p>
                <button @click="showRedeem = true" class="text-xs font-bold text-blue-500 hover:underline">
                    I have a VIP code
                </button>
            </div>
            
            <div v-else class="flex gap-2 animate-fade-in-up">
                <input v-model="redeemCode" type="text" placeholder="CODE" class="w-full text-xs p-2 border rounded uppercase font-bold text-stone-700">
                <button @click="handleRedeem" class="bg-stone-800 text-white text-xs px-3 rounded font-bold hover:bg-stone-700">OK</button>
            </div>
        </div>

        <div v-else class="mt-4 p-3 bg-yellow-50 border border-yellow-100 rounded-lg flex items-center gap-3">
            <span class="text-xl">👑</span>
            <div>
                <div class="text-xs font-bold text-yellow-800">Premium Member</div>
                <div class="text-[10px] text-yellow-600">Thanks for support!</div>
            </div>
        </div>

        <!-- <div class="w-full aspect-square bg-stone-200 rounded-xl flex items-center justify-center border-2 border-dashed border-stone-300 text-stone-400 font-mono text-sm relative overflow-hidden group cursor-pointer">
          <div class="absolute inset-0 flex flex-col items-center justify-center transition-transform duration-500 group-hover:scale-110">
            <span class="text-4xl mb-2">⚡</span>
            <span>廣告位招租</span>
          </div>
          <div class="absolute inset-0 bg-stone-900/0 group-hover:bg-stone-900/5 transition-colors"></div>
        </div> -->
      </div>

      <div class="flex-1 p-6 overflow-y-auto">
        <div class="text-xs font-bold text-stone-400 uppercase tracking-widest mb-3">MORE GAMES</div>
        
        <div class="space-y-3">
          <div v-for="i in 3" :key="i" class="bg-white p-3 rounded-xl border border-stone-200 flex gap-3 cursor-pointer hover:border-stone-400 transition-colors">
            <div class="w-12 h-12 bg-stone-100 rounded-lg"></div>
            <div class="flex-1">
              <div class="h-3 w-20 bg-stone-800/10 rounded mb-2"></div>
              <div class="h-2 w-12 bg-stone-800/10 rounded"></div>
            </div>
          </div>
        </div>
      </div>

      <div class="p-4 text-center">
        <button class="text-xs text-stone-400 hover:text-stone-600 underline">Remove Ads</button>
      </div>

    </aside>

    <!-- Help Modal -->
    <HelpModal 
      v-if="currentGame" 
      :show="showHelp" 
      :game="currentGame" 
      @close="showHelp = false" 
    />

    <GameResultModal 
      :show="showResultModal"
      :match-result="matchResult"
      :final-result="finalResult"
      :sorted-players="finalPlayers"
      :my-id="myId"
      :is-host="isHost"
      :is-game-running="serverStatus === 'playing' && !isMatchEnded"
      @close="showResultModal = false"
      @play-again="restartGame"
      @back-to-lobby="handleBackToLobby"
    />

    <AlertModal 
      :show="showAlert" 
      :message="alertMessage" 
      type="error"
      @close="showAlert = false"
    />
  </div>
</template>

<style scoped>
.list-move, 
.list-enter-active,
.list-leave-active {
  transition: all 0.5s cubic-bezier(0.55, 0, 0.1, 1);
}

.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}
.list-leave-active {
  position: absolute;
}

/* 添加在原本的 style 裡面 */

.animate-fade-in-up {
  animation: fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.animate-ping-slow {
    animation: ping 1s cubic-bezier(0, 0, 0.2, 1) infinite;
}
@keyframes ping {
    75%, 100% {
        transform: scale(1.5);
        opacity: 0;
    }
}
</style>