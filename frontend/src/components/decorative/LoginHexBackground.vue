<script setup lang="ts">
/**
 * 登录页：深蓝紫渐变上的六边形网格 + 交点微光（区块链 / 权威存证意象）
 */
import { onMounted, onUnmounted, ref } from 'vue';

const canvasRef = ref<HTMLCanvasElement | null>(null);
let raf = 0;
let t0 = 0;

function draw() {
  const c = canvasRef.value;
  if (!c) return;
  const ctx = c.getContext('2d');
  if (!ctx) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = c.clientWidth;
  const h = c.clientHeight;
  if (w < 10 || h < 10) return;
  c.width = w * dpr;
  c.height = h * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const t = (performance.now() - t0) / 1000;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const r = 18;
  const dx = r * 1.5;
  const dy = r * Math.sqrt(3);

  ctx.clearRect(0, 0, w, h);

  ctx.strokeStyle = 'rgba(34, 211, 238, 0.08)';
  ctx.lineWidth = 1;

  for (let row = -1; row < h / dy + 2; row++) {
    const y0 = row * dy;
    const offset = row % 2 === 0 ? 0 : dx * 0.5;
    for (let col = -1; col < w / dx + 2; col++) {
      const cx = col * dx + offset;
      const cy = y0;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const ang = (Math.PI / 3) * i - Math.PI / 6;
        const px = cx + r * Math.cos(ang);
        const py = cy + r * Math.sin(ang);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
    }
  }

  if (!reduced) {
    const seeds = [
      [0.12, 0.18],
      [0.35, 0.42],
      [0.58, 0.22],
      [0.78, 0.55],
      [0.22, 0.72],
      [0.65, 0.78],
      [0.88, 0.28],
    ];
    for (let i = 0; i < seeds.length; i++) {
      const [sx, sy] = seeds[i]!;
      const px = sx * w;
      const py = sy * h;
      const pulse = 0.35 + 0.35 * Math.sin(t * 1.2 + i * 1.7);
      ctx.beginPath();
      ctx.arc(px, py, 3 + pulse * 2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(129, 140, 248, ${0.12 + pulse * 0.18})`;
      ctx.fill();
      ctx.strokeStyle = `rgba(34, 211, 238, ${0.15 + pulse * 0.25})`;
      ctx.lineWidth = 0.6;
      ctx.stroke();
    }
  }
}

function loop() {
  draw();
  raf = requestAnimationFrame(loop);
}

function onResize() {
  draw();
}

onMounted(() => {
  t0 = performance.now();
  window.addEventListener('resize', onResize);
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    raf = requestAnimationFrame(loop);
  } else {
    draw();
  }
});

onUnmounted(() => {
  window.removeEventListener('resize', onResize);
  cancelAnimationFrame(raf);
});
</script>

<template>
  <canvas
    ref="canvasRef"
    class="pointer-events-none absolute inset-0 z-0 h-full w-full"
    aria-hidden="true"
  />
</template>
