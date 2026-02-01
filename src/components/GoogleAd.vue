<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { usePremium } from '@/composables/usePremium';

const props = defineProps<{
  slotId: string;
  format?: 'auto' | 'fluid' | 'rectangle';
  fullWidth?: boolean;
}>();

const { isPremium } = usePremium();

const adElement = ref<HTMLElement | null>(null);

onMounted(() => {
  if (isPremium.value) return;

  const initAd = () => {
    try {
      if ((window as any).adsbygoogle) {
        // Double check width to be safe
        if (adElement.value && adElement.value.offsetWidth > 0) {
            ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
        } else {
             // Fallback: wait a bit or just retry
             setTimeout(() => {
                 if (adElement.value && adElement.value.offsetWidth > 0) {
                    ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
                 }
             }, 500);
        }
      }
    } catch (e) {
      console.error('AdSense error:', e);
    }
  };

  if ((window as any).IntersectionObserver) {
     const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
           if (entry.isIntersecting && entry.intersectionRatio > 0) {
               initAd();
               observer.disconnect();
           }
        });
     });
     if (adElement.value) observer.observe(adElement.value);
  } else {
     // Fallback for older browsers or if IO is missing
     setTimeout(initAd, 1000);
  }
});
</script>

<template>
  <div v-if="!isPremium" class="ad-container bg-stone-200/50 rounded-xl overflow-hidden flex items-center justify-center relative min-h-[280px]">
    <div class="absolute inset-0 flex flex-col items-center justify-center text-stone-400 font-mono text-xs z-0">
       <span class="text-2xl mb-2 opacity-50">⚡</span>
       <span>SPONSORED</span>
    </div>

    <ins ref="adElement" class="adsbygoogle z-10"
         style="display:block"
         :data-ad-client="'ca-pub-7220627835291556'" 
         :data-ad-slot="slotId"
         :data-ad-format="format || 'auto'"
         :data-full-width-responsive="fullWidth ? 'true' : 'false'">
    </ins>
  </div>
</template>