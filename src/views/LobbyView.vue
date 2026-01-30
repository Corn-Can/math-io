<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { io, type Socket } from 'socket.io-client';
import { GAME_REGISTRY } from '@/games/registry';
import ParticleBg from '@/components/ParticleBg.vue';
import { useT } from '@/utils/i18n-tracker';

const router = useRouter();
const route = useRoute();
const { t } = useT();

const socket = ref<Socket | null>(null);
const publicRooms = ref<any[]>([]);
const isCreating = ref(false);
const privateRoomId = ref('');
const currentGameId = (route.params.gameId as string) || 'fruitbox';
const currentGame = GAME_REGISTRY[currentGameId];

// socket 連線位址
const SOCKET_URL = import.meta.env.PROD
  ? 'https://math-io-server.onrender.com'
  : 'http://localhost:3000';


// 1. 修改表單：加入 mode 欄位，預設為第一個模式
const form = ref({
  name: localStorage.getItem('math_io_username') || '',
  isPrivate: false,
  maxPlayers: 2,
  gameId: currentGameId,
  mode: currentGame?.modes[0]?.id || 'classic'
});

const playerOptions = computed(() => {
  const gameMax = (currentGame as any)?.maxPlayers || 8;
  const limit = Math.min(8, gameMax);
  const options = [];
  for (let i = 2; i <= limit; i++) { options.push(i); }
  return options;
});

// 計算當前選中模式的描述 (用來顯示在選單下面)
const currentModeDescription = computed(() => {
  const mode = currentGame?.modes.find(m => m.id === form.value.mode);
  return mode?.descriptionKey || '';
});

// Helper for mode labels
const getModeLabel = (modeId: string) => {
    const m = currentGame?.modes.find(m => m.id === modeId);
    return m ? t(m.labelKey || '') : modeId;
};

onMounted(() => {
  if (!currentGame) { router.replace('/'); return; }
  socket.value = io(SOCKET_URL);
  socket.value.on('connect', () => { socket.value?.emit('get-rooms'); });
  socket.value.on('room-list', (rooms: any[]) => { publicRooms.value = rooms.filter(r => r.gameId === currentGameId); });
  
  // 建立成功後，跳轉到房間並帶上模式參數 (讓 RoomView 知道)
  socket.value.on('room-created', (data: any) => { 
    // 後端回傳可能是字串 roomId，或是物件 { id, mode ... }
    const roomId = typeof data === 'object' ? data.id : data;
    router.push({ 
      name: 'room', 
      query: { 
        game: currentGameId, 
        room: roomId,
        mode: form.value.mode
      } 
    }); 
  });
});

onUnmounted(() => { if (socket.value) socket.value.disconnect(); });

const createRoom = () => {
  const gameName = currentGame?.nameKey || '';
  if (!form.value.name) form.value.name = `${t(gameName)} Room`;
  //紀錄名字
  localStorage.setItem('math_io_username', form.value.name);
  // 發送給後端 (後端記得要儲存 mode)
  socket.value?.emit('create-room', form.value);
};

const joinRoom = (roomId: string, roomMode?: string) => {
  if(!roomId) return;
  // 加入時如果有 roomMode 資訊最好，沒有的話可能要進房間後靠 Socket 同步
  router.push({ 
    name: 'room', 
    query: { game: currentGameId, room: roomId, mode:roomMode } 
  });
};
</script>

<template>
  <div class="min-h-screen bg-stone-50 text-stone-800 font-sans flex flex-col">
    
    <div class="bg-stone-900 text-stone-50 pt-12 pb-20 px-8 relative overflow-hidden shadow-2xl z-10">
       
      <ParticleBg 
         color="rgba(255, 255, 255, 0.3)" 
         lineColor="rgba(255, 255, 255, 0.05)" 
         :count="50" 
       />

       <div class="max-w-6xl mx-auto relative z-10 flex flex-col md:flex-row justify-between items-end gap-6">
         <div>
           <button @click="router.push('/')" class="text-xs font-bold text-stone-500 hover:text-white transition mb-4 flex items-center gap-2">
             <span>←</span> {{ t('lobby.backToHome', 'BACK TO HOME') }}
           </button>
           <h1 class="text-5xl md:text-6xl font-black tracking-tight leading-none mb-2">
             {{ t(currentGame?.nameKey || '') }}
           </h1>
           <div class="flex gap-2">
             <span class="bg-stone-800 text-stone-300 px-3 py-1 rounded text-xs font-bold uppercase tracking-wider border border-stone-700">{{ t('lobby.lobbyTag', 'Lobby') }}</span>
             <span class="bg-blue-900/30 text-blue-300 px-3 py-1 rounded text-xs font-bold uppercase tracking-wider border border-blue-900/50">{{ t('lobby.liveTag', 'Live') }}</span>
           </div>
         </div>

         <div class="flex gap-3">
            <div class="flex bg-stone-800 p-1 rounded-xl border border-stone-700">
               <input v-model="privateRoomId" type="text" :placeholder="t('lobby.enterId', 'ENTER ID')" class="bg-transparent text-white px-4 py-2 w-32 focus:outline-none font-mono text-center uppercase placeholder:text-stone-600" @keyup.enter="joinRoom(privateRoomId.toUpperCase())">
               <button @click="joinRoom(privateRoomId.toUpperCase())" class="bg-stone-700 hover:bg-stone-600 text-white px-4 py-2 rounded-lg font-bold transition">{{ t('lobby.go', 'GO') }}</button>
            </div>
            <button @click="isCreating = true" class="bg-white text-stone-900 hover:bg-stone-200 px-8 py-3 rounded-xl font-bold shadow-lg shadow-black/20 transition transform hover:-translate-y-1">
              + {{ t('lobby.createRoom', 'CREATE ROOM') }}
            </button>
         </div>
       </div>
    </div>

    <div class="flex-1 px-8 -mt-10 relative z-20 pb-12">
      <div class="max-w-6xl mx-auto">
        
        <div v-if="publicRooms.length === 0" class="bg-white rounded-2xl p-16 text-center shadow-xl shadow-stone-200 border border-stone-100">
          <div class="text-6xl mb-4 opacity-20">📭</div>
          <h3 class="text-xl font-bold text-stone-800 mb-2">{{ t('lobby.noRooms', 'No Public Rooms Yet') }}</h3>
          <p class="text-stone-500">{{ t('lobby.beFirst', 'Be the first one to start a battle!') }}</p>
        </div>

        <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div 
            v-for="room in publicRooms" 
            :key="room.id"
            class="group bg-white p-6 rounded-2xl border-2 border-transparent hover:border-stone-200 shadow-sm hover:shadow-xl transition-all duration-300 flex items-center justify-between"
          >
            <div>
              <div class="font-black text-xl text-stone-800 mb-1 group-hover:text-blue-600 transition-colors">
                {{ room.name }}
              </div>
              <div class="flex flex-col gap-1">
                <div class="flex items-center gap-3 text-xs font-mono font-bold text-stone-400">
                  <span class="bg-stone-100 px-2 py-1 rounded">ID: {{ room.id }}</span>
                  <span>{{ room.players.length }} / {{ room.maxPlayers }} {{ t('lobby.players', 'PLAYERS') }}</span>
                </div>
                <span v-if="room.mode" class="text-xs font-bold uppercase tracking-wider text-stone-500 bg-stone-50 w-fit px-2 py-0.5 rounded">
                  {{ t('lobby.mode', 'Mode') }}: {{ getModeLabel(room.mode) }}
                </span>
              </div>
            </div>
            <button 
              @click="joinRoom(room.id, room.mode)"
              class="px-6 py-3 rounded-xl font-bold text-sm transition-all"
              :class="room.players.length >= room.maxPlayers ? 'bg-stone-100 text-stone-300 cursor-not-allowed' : 'bg-stone-900 text-white hover:bg-stone-800 shadow-lg hover:shadow-xl'"
              :disabled="room.players.length >= room.maxPlayers"
            >
              {{ room.players.length >= room.maxPlayers ? t('lobby.full', 'FULL') : t('lobby.join', 'JOIN') }}
            </button>
          </div>
        </div>

      </div>
    </div>

    <div v-if="isCreating" class="fixed inset-0 bg-stone-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div class="bg-white p-8 rounded-3xl w-full max-w-md shadow-2xl relative border border-white/50 animate-fade-in-up">
        <button @click="isCreating = false" class="absolute top-6 right-6 text-stone-400 hover:text-stone-600 transition text-xl">✕</button>
        <h3 class="text-2xl font-black mb-1 text-stone-800">{{ t('lobby.createRoom', 'CREATE ROOM') }}</h3>
        <p class="text-stone-400 text-sm mb-6">{{ t('lobby.setupSettings', 'Setup your game settings') }}</p>
        
        <div class="space-y-5">
          <div>
            <label class="block text-xs font-bold text-stone-400 mb-1 uppercase tracking-wider">{{ t('lobby.roomName', 'Name') }}</label>
            <input v-model="form.name" type="text" :placeholder="`${t(currentGame?.nameKey || '')} Room`" class="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 font-bold text-stone-800 focus:outline-none focus:border-stone-800 transition">
          </div>

          <div>
            <label class="block text-xs font-bold text-stone-400 mb-1 uppercase tracking-wider">{{ t('lobby.gameMode', 'Game Mode') }}</label>
            <div class="relative">
              <select v-model="form.mode" class="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 font-bold text-stone-800 appearance-none focus:outline-none focus:border-stone-800">
                <option v-for="mode in currentGame?.modes" :key="mode.id" :value="mode.id">
                  {{ t(mode.labelKey || '') }}
                </option>
              </select>
              <div class="absolute right-3 top-3.5 pointer-events-none text-stone-400 text-xs">▼</div>
            </div>
            <p class="text-xs text-stone-400 mt-2 font-mono bg-stone-50 p-2 rounded border border-stone-100">
              {{ t(currentModeDescription) }}
            </p>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold text-stone-400 mb-1 uppercase tracking-wider">{{ t('lobby.maxPlayers', 'Players') }}</label>
              <select v-model="form.maxPlayers" class="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 font-bold text-stone-800 focus:outline-none focus:border-stone-800">
                <option v-for="num in playerOptions" :key="num" :value="num">{{ num }} {{ t('lobby.players', 'Players') }}</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-bold text-stone-400 mb-1 uppercase tracking-wider">{{ t('lobby.privacy', 'Privacy') }}</label>
              <select v-model="form.isPrivate" class="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 font-bold text-stone-800 focus:outline-none focus:border-stone-800">
                <option :value="false">{{ t('lobby.public', 'Public') }}</option>
                <option :value="true">{{ t('lobby.private', 'Private') }}</option>
              </select>
            </div>
          </div>
          <button @click="createRoom" class="w-full bg-stone-900 hover:bg-stone-800 text-white py-4 rounded-xl font-bold mt-2 shadow-lg transition-transform active:scale-95">{{ t('lobby.startBattle', 'START BATTLE') }}</button>
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
.animate-fade-in-up { animation: fadeInUp 0.4s ease-out; }
@keyframes fadeInUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
</style>