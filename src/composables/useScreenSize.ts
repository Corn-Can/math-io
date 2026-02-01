import { ref, onMounted, onUnmounted } from 'vue';

export function useScreenSize() {
    // Initialize with window width if available, otherwise default to desktop
    const isMobile = ref(typeof window !== 'undefined' ? window.innerWidth < 768 : false);

    const checkMobile = () => {
        // Tailwind 'md' is 768px
        isMobile.value = window.innerWidth < 768;
    };

    onMounted(() => {
        checkMobile();
        window.addEventListener('resize', checkMobile);
    });

    onUnmounted(() => {
        window.removeEventListener('resize', checkMobile);
    });

    return { isMobile };
}
