<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';

const canvasRef = ref<HTMLCanvasElement | null>(null);
let ctx: CanvasRenderingContext2D | null = null;
let animationFrameId: number;
let particles: Particle[] = [];

// 設定參數
const props = defineProps({
  color: { type: String, default: 'rgba(255, 255, 255, 0.5)' }, // 粒子顏色
  lineColor: { type: String, default: 'rgba(255, 255, 255, 0.15)' }, // 連線顏色
  count: { type: Number, default: 60 }, // 粒子數量
});

class Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  canvasWidth: number;
  canvasHeight: number;

  constructor(w: number, h: number) {
    this.canvasWidth = w;
    this.canvasHeight = h;
    this.x = Math.random() * w;
    this.y = Math.random() * h;
    this.vx = (Math.random() - 0.5) * 0.5; // 速度 X
    this.vy = (Math.random() - 0.5) * 0.5; // 速度 Y
    this.size = Math.random() * 2 + 1; // 大小
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;

    // 碰到邊界反彈
    if (this.x < 0 || this.x > this.canvasWidth) this.vx *= -1;
    if (this.y < 0 || this.y > this.canvasHeight) this.vy *= -1;
  }

  draw(context: CanvasRenderingContext2D) {
    context.beginPath();
    context.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    context.fillStyle = props.color;
    context.fill();
  }
}

const init = () => {
  const canvas = canvasRef.value;
  if (!canvas) return;
  
  // 設定全螢幕 Canvas
  const resize = () => {
    if(canvas.parentElement) {
        canvas.width = canvas.parentElement.offsetWidth;
        canvas.height = canvas.parentElement.offsetHeight;
    }
  };
  window.addEventListener('resize', resize);
  resize();

  ctx = canvas.getContext('2d');
  
  // 初始化粒子
  particles = [];
  for (let i = 0; i < props.count; i++) {
    particles.push(new Particle(canvas.width, canvas.height));
  }
};

const animate = () => {
  const canvas = canvasRef.value;
  if (!canvas || !ctx) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 更新並繪製每個粒子
  particles.forEach((p, index) => {
    p.update();
    p.draw(ctx!);

    // 檢查連線 (Constellation Effect)
    for (let j = index + 1; j < particles.length; j++) {
      const p2 = particles[j];
      const dx = p.x - (p2?.x || 0);
      const dy = p.y - (p2?.y || 0);
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < 120) { // 連線距離門檻
        ctx!.beginPath();
        ctx!.strokeStyle = props.lineColor;
        ctx!.lineWidth = 0.5; // 線條粗細
        ctx!.moveTo(p.x, p.y);
        ctx!.lineTo(p2?.x || 0, p2?.y || 0 );
        ctx!.stroke();
      }
    }
  });

  animationFrameId = requestAnimationFrame(animate);
};

onMounted(() => {
  init();
  animate();
});

onUnmounted(() => {
  cancelAnimationFrame(animationFrameId);
  window.removeEventListener('resize', () => {});
});
</script>

<template>
  <canvas ref="canvasRef" class="absolute inset-0 w-full h-full pointer-events-none"></canvas>
</template>