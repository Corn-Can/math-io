<script setup lang="ts">


interface Player {
  id: string;
  name: string;
  score: number;
  isReady: boolean;
}

const props = defineProps<{
  players: Player[];
  maxPlayers: number;
  hostId: string;
  myId: string;
}>();

const emit = defineEmits(['transfer-host']);
</script>

<template>
  <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
    <div v-for="p in players" :key="p.id" 
         class="aspect-square bg-white rounded-2xl flex flex-col items-center justify-center border-b-4 border-stone-200 shadow-sm transition relative group">
      
      <!-- Host Badge -->
      <div v-if="p.id === hostId" class="absolute top-2 right-2 text-xl" title="Host">👑</div>
      
      <!-- Ready Status -->
      <div v-if="p.id !== hostId" class="absolute top-2 right-2 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider"
           :class="p.isReady ? 'bg-green-100 text-green-600' : 'bg-stone-100 text-stone-400'">
          {{ p.isReady ? 'READY' : 'WAITING' }}
      </div>

      <div class="w-16 h-16 rounded-xl flex items-center justify-center text-3xl font-black mb-3"
           :class="p.id === myId ? 'bg-stone-800 text-white' : 'bg-stone-100 text-stone-400'">
        {{ p.name.substring(0, 1) }}
      </div>
      <div class="font-bold text-stone-700">{{ p.name }}</div>
      <div v-if="p.id === myId" class="text-xs bg-stone-200 px-2 py-0.5 rounded mt-1 text-stone-600 font-bold">YOU</div>
      
      <!-- Transfer Host Button (Host Only) -->
      <button v-if="myId === hostId && p.id !== myId" @click="emit('transfer-host', p.id)" 
              class="mt-2 text-[10px] bg-stone-100 hover:bg-stone-200 text-stone-500 px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition">
          Make Host
      </button>
    </div>

    <div v-for="n in (maxPlayers - players.length)" :key="n" 
         class="aspect-square bg-stone-100/50 rounded-2xl flex items-center justify-center border-2 border-dashed border-stone-200 text-stone-300">
       <span class="text-2xl font-bold opacity-30">+</span>
    </div>
  </div>
</template>
