<script setup lang="ts">
import { RouterView } from 'vue-router';
import MusicController from '@/components/MusicController.vue';
import { playSound } from '@/utils/audio';

const handleGlobalClick = () => {
  // Simple global feedback for interaction
  // We can filter by tag if needed to avoid spam
  // playSound('common', 'click', 0.2); // Too noisy? Maybe only on buttons
};

// Global button click listener
window.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('a') || target.closest('.cursor-pointer')) {
        playSound('common', 'click', 0.3);
    }
});
</script>

<template>
  <router-view v-slot="{ Component }">
    <Transition name="page" mode="out-in">
      <component :is="Component" />
    </Transition>
  </router-view>
  <MusicController />
</template>

<style>
/* Page Transitions */
.page-enter-active,
.page-leave-active {
  transition: opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1), transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.page-enter-from,
.page-leave-to {
  opacity: 0;
  transform: scale(0.98) translateY(10px);
}
</style>