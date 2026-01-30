<script setup lang="ts">

defineProps<{
  show: boolean;
  message: string;
  type?: 'info' | 'error' | 'success';
}>();

const emit = defineEmits(['close']);
</script>

<template>
  <Transition name="modal">
    <div v-if="show" class="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-stone-900/60 backdrop-blur-sm transition-opacity" @click="emit('close')"></div>

      <!-- Modal Content -->
      <div class="relative bg-white rounded-2xl shadow-2xl shadow-stone-900/20 max-w-sm w-full p-6 transform transition-all scale-100">
        
        <div class="flex flex-col items-center text-center">
          <!-- Icon based on type -->
          <div v-if="type === 'error'" class="w-12 h-12 bg-red-100 text-red-500 rounded-full flex items-center justify-center mb-4 text-2xl font-black">
            ！
          </div>
          <div v-else class="w-12 h-12 bg-stone-100 text-stone-500 rounded-full flex items-center justify-center mb-4 text-2xl font-black">
            i
          </div>

          <h3 class="text-xl font-black text-stone-800 mb-2">Notice</h3>
          <p class="text-stone-600 mb-6 leading-relaxed">
            {{ message }}
          </p>

          <button 
            @click="emit('close')"
            class="w-full py-3 bg-stone-800 hover:bg-stone-700 text-white rounded-xl font-bold transition-transform active:scale-95"
          >
            OK
          </button>
        </div>

      </div>
    </div>
  </Transition>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .scale-100,
.modal-leave-active .scale-100 {
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.modal-enter-from .scale-100,
.modal-leave-to .scale-100 {
  transform: scale(0.95);
}
</style>
