<script setup lang="ts">
import type { GameConfigOption } from '@/games/registry';
import { useT } from '@/utils/i18n-tracker';

const { t } = useT();

const props = defineProps<{
  isHost: boolean;
  currentMode: string;
  gameModes: any[];
  gameId: string;
  configSchema?: Record<string, GameConfigOption>;
  settings?: Record<string, any>; // Generic settings object
  // Deprecated/Legacy support overrides
  duration?: number;
}>();

const emit = defineEmits(['update-mode', 'update-settings', 'update-duration']);

// Helper to get value from settings or props (for legacy support)
const getValue = (key: string) => {
  if (key === 'duration' && props.duration !== undefined) return props.duration;
  
  const val = props.settings?.[key];
  if (val === undefined && props.configSchema?.[key]?.default !== undefined) {
      return props.configSchema[key].default;
  }
  return val;
};

const handleUpdate = (key: string, value: any) => {
  if (!props.isHost) return;
  
  // Special case for duration to match existing backend event
  if (key === 'duration') {
    emit('update-duration', Number(value));
  } else {
    emit('update-settings', { key, value });
  }
};
</script>

<template>
  <div class="bg-white rounded-2xl p-6 shadow-sm border border-stone-200 mb-8">
    
    <!-- Game Mode (Always Present) -->
    <div class="mb-8" v-if="gameModes && gameModes.length > 0">
      <h3 class="text-xs font-bold text-stone-400 uppercase tracking-widest mb-3">{{ t('lobby.gameMode', 'Game Mode') }}</h3>
      <div class="relative">
        <select 
            :value="currentMode"
            @change="isHost && emit('update-mode', ($event.target as HTMLSelectElement).value)"
            class="w-full appearance-none bg-white border-2 border-stone-200 text-stone-700 font-bold text-sm rounded-xl px-4 py-3 pr-8 focus:outline-none focus:border-stone-800 focus:ring-0 transition-colors disabled:bg-stone-100 disabled:text-stone-400"
            :disabled="!isHost"
        >
            <option v-for="mode in gameModes" :key="mode.id" :value="mode.id">
                {{ t(mode.labelKey || mode.label || mode.name) }}
            </option>
        </select>
        <div class="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-stone-500">
            <svg class="w-4 h-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/></svg>
        </div>
      </div>
      <div class="mt-2 text-xs text-stone-400 font-mono px-1">
          {{ t(gameModes.find(m => m.id === currentMode)?.descriptionKey || gameModes.find(m => m.id === currentMode)?.description || '') }}
      </div>
    </div>

    <!-- Dynamic Settings from Schema -->
    <div v-if="configSchema">
      <div v-for="(config, key) in configSchema" :key="key" class="mb-6 last:mb-0">
        
        <div class="flex justify-between items-center mb-3">
          <h3 class="text-xs font-bold text-stone-400 uppercase tracking-widest">{{ config.label }}</h3>
          <span class="font-mono font-bold text-stone-800">{{ getValue(key as string) }}</span>
        </div>

        <!-- Number Type (Slider) -->
        <div v-if="config.type === 'number'">
          <input 
            type="range" 
            :min="config.min" 
            :max="config.max" 
            :step="config.step" 
            :value="getValue(key as string)" 
            @input="handleUpdate(key as string, ($event.target as HTMLInputElement).value)"
            class="w-full h-2 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-stone-800"
            :disabled="!isHost"
          >
          <div class="flex justify-between text-[10px] text-stone-400 font-mono mt-2" v-if="config.min !== undefined && config.max !== undefined">
            <span>{{ config.min }}</span>
            <span>{{ config.max }}</span>
          </div>
        </div>

        <!-- Select Type -->
        <div v-else-if="config.type === 'select'" class="relative">
          <select 
              :value="getValue(key as string)"
              @change="handleUpdate(key as string, ($event.target as HTMLSelectElement).value)"
              class="w-full appearance-none bg-white border-2 border-stone-200 text-stone-700 font-bold text-sm rounded-xl px-4 py-3 pr-8 focus:outline-none focus:border-stone-800"
              :disabled="!isHost"
          >
              <option v-for="opt in config.options" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
              </option>
          </select>
          <div class="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-stone-500">
              <svg class="w-4 h-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/></svg>
          </div>
        </div>

      </div>
    </div>

    <!-- Host Warning -->
    <div v-if="!isHost" class="mt-6 p-3 bg-yellow-50 text-yellow-700 text-xs rounded-lg text-center font-bold">
      {{ t('room.hostOnly', 'Only the Host can change settings') }}
    </div>

  </div>
</template>
