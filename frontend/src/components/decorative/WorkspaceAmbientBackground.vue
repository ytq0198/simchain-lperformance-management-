<script setup lang="ts">
/**
 * 工作台全局背景：极低对比网格 + 稀疏节点连线 + 边缘缓慢漂浮的「区块」碎片。
 * 路由切换时连线亮度短暂增强，象征导航触发的链上/网关活动（演示意象）。
 */
import { onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import type { AppRole } from '../../api/authApi';

const props = defineProps<{
  role?: AppRole | null;
}>();

const canvasRef = ref<HTMLCanvasElement | null>(null);
const route = useRoute();
let raf = 0;
let t0 = 0;
/** 导航瞬时脉冲 0～1 */
let navPulse = 0;

watch(
  () => route.path,
  () => {
    navPulse = 1;
  },
);

function roleAccent(role: AppRole | null | undefined): { h1: number; h2: number } {
  switch (role) {
    case 'Academic_Affairs':
      return { h1: 202, h2: 218 };
    case 'DepartmentTeacher':
      return { h1: 196, h2: 208 };
    case 'Student':
      return { h1: 268, h2: 288 };
    case 'ExternalVerifier':
      return { h1: 182, h2: 200 };
    default:
      return { h1: 204, h2: 214 };
  }
}

function drawLoop() {
  const c = canvasRef.value;
  if (!c) {
    raf = requestAnimationFrame(drawLoop);
    return;
  }
  const ctx = c.getContext('2d');
  if (!ctx) {
    raf = requestAnimationFrame(drawLoop);
    return;
  }

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = c.clientWidth;
  const h = c.clientHeight;
  if (w < 10 || h < 10) {
    raf = requestAnimationFrame(drawLoop);
    return;
  }
  c.width = w * dpr;
  c.height = h * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const t = (performance.now() - t0) / 1000;
  const { h1, h2 } = roleAccent(props.role ?? undefined);

  const pulse = navPulse;
  navPulse *= 0.9;
  if (navPulse < 0.02) navPulse = 0;

  ctx.fillStyle = `hsla(${h1}, 24%, 7%, 1)`;
  ctx.fillRect(0, 0, w, h);

  const gridOff = reduced ? 0 : (t * 2.2) % 44;
  ctx.strokeStyle = `hsla(${h1}, 32%, 42%, ${0.045 + pulse * 0.04})`;
  ctx.lineWidth = 1;
  const step = 52;
  for (let x = -step + (gridOff % step); x < w + step; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = -step + (gridOff % step); y < h + step; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  if (!reduced) {
    ctx.strokeStyle = `hsla(${h2}, 45%, 58%, ${0.028 + pulse * 0.05})`;
    const drift = (t * 6) % 96;
    for (let i = -2; i < w / 96 + 3; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 96 + drift, 0);
      ctx.lineTo(i * 96 + drift - h * 0.38, h);
      ctx.stroke();
    }
  }

  const nodes: [number, number][] = [
    [w * 0.1, h * 0.2],
    [w * 0.26, h * 0.36],
    [w * 0.74, h * 0.16],
    [w * 0.9, h * 0.3],
    [w * 0.5, h * 0.58],
    [w * 0.16, h * 0.74],
    [w * 0.84, h * 0.72],
  ];
  const breathe = 0.52 + 0.09 * Math.sin(t * 0.65) + pulse * 0.35;
  ctx.strokeStyle = `hsla(${h1}, 62%, 62%, ${0.038 + pulse * 0.11})`;
  ctx.lineWidth = 0.65;
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const [x1, y1] = nodes[i];
      const [x2, y2] = nodes[j];
      if (Math.hypot(x1 - x2, y1 - y2) < w * 0.58) {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
    }
  }
  for (const [nx, ny] of nodes) {
    ctx.fillStyle = `hsla(${h2}, 78%, 68%, ${0.055 * breathe})`;
    ctx.beginPath();
    ctx.arc(nx, ny, 1.8 + pulse * 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  if (!reduced) {
    const nBlocks = 12;
    for (let b = 0; b < nBlocks; b++) {
      const seed = (b + 1) * 9949;
      const edge = b % 4;
      const phase = t * 0.065 + b * 0.63;
      const sz = 3.5 + (b % 3) * 2;
      let x = 0;
      let y = 0;
      if (edge === 0) {
        x = ((seed * 0.001) % 0.14) * w;
        y = (h * (0.12 + (Math.sin(phase + b) * 0.5 + 0.5) * 0.78)) % h;
      } else if (edge === 1) {
        x = w - ((seed * 0.0019) % 0.11) * w;
        y = (h * (0.06 + (Math.cos(phase) * 0.5 + 0.5) * 0.84)) % h;
      } else if (edge === 2) {
        y = ((seed * 0.0014) % 0.11) * h;
        x = (w * (0.06 + (Math.sin(phase * 1.07) * 0.5 + 0.5) * 0.88)) % w;
      } else {
        y = h - ((seed * 0.0017) % 0.1) * h;
        x = (w * (0.03 + (Math.cos(phase * 0.95) * 0.5 + 0.5) * 0.94)) % w;
      }
      ctx.fillStyle = `hsla(${h2}, 58%, 58%, ${0.034 + 0.018 * Math.sin(t * 1.2 + b) + pulse * 0.03})`;
      ctx.fillRect(x, y, sz, sz * 0.85);
    }
  }

  raf = requestAnimationFrame(drawLoop);
}

onMounted(() => {
  t0 = performance.now();
  raf = requestAnimationFrame(drawLoop);
});

onUnmounted(() => {
  cancelAnimationFrame(raf);
});
</script>

<template>
  <canvas
    ref="canvasRef"
    class="pointer-events-none fixed inset-0 z-0 h-full min-h-screen w-full"
    aria-hidden="true"
  />
</template>
