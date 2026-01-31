<script setup lang="ts">
import { onMounted } from 'vue';
import { usePremium } from '@/composables/usePremium';

const props = defineProps<{
  slotId: string;
  format?: 'auto' | 'fluid' | 'rectangle';
  fullWidth?: boolean;
}>();

const { isPremium } = usePremium();

onMounted(() => {
  if (isPremium.value) return;

  try {
    if ((window as any).adsbygoogle) {
      ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
    }
  } catch (e) {
    console.error('AdSense error:', e);
  }
});
</script>

<template>
  <div v-if="!isPremium" class="ad-container bg-stone-200/50 rounded-xl overflow-hidden flex items-center justify-center relative min-h-[280px]">
    <div class="absolute inset-0 flex flex-col items-center justify-center text-stone-400 font-mono text-xs z-0">
       <span class="text-2xl mb-2 opacity-50">⚡</span>
       <span>SPONSORED</span>
    </div>

    <ins class="adsbygoogle z-10"
         style="display:block"
         :data-ad-client="'ca-pub-7220627835291556'" 
         :data-ad-slot="slotId"
         :data-ad-format="format || 'auto'"
         :data-full-width-responsive="fullWidth ? 'true' : 'false'">
    </ins>
  </div>
</template>