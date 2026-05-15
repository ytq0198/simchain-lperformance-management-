<script setup lang="ts">
/**
 * 综合看板：细等值线式流动曲线，由父组件传入归一化鼠标位置产生视差
 */
const props = defineProps<{
  mx: number;
  my: number;
}>();

const parallaxX = () => (props.mx - 0.5) * 18;
const parallaxY = () => (props.my - 0.5) * 14;
</script>

<template>
  <div class="pointer-events-none absolute inset-0 z-0 overflow-hidden">
    <svg
      class="h-full w-full opacity-[0.22]"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="none"
      :style="{
        transform: `translate(${parallaxX()}px, ${parallaxY()}px)`,
        transition: 'transform 0.35s ease-out',
      }"
    >
      <defs>
        <linearGradient id="flowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#22d3ee" stop-opacity="0.35" />
          <stop offset="50%" stop-color="#6366f1" stop-opacity="0.2" />
          <stop offset="100%" stop-color="#22d3ee" stop-opacity="0.12" />
        </linearGradient>
      </defs>
      <path
        fill="none"
        stroke="url(#flowGrad)"
        stroke-width="0.6"
        vector-effect="non-scaling-stroke"
        d="M0,120 C180,80 320,200 520,100 S820,40 1000,160 L1000,400 L0,400 Z"
      />
      <path
        fill="none"
        stroke="rgba(148,163,184,0.25)"
        stroke-width="0.45"
        vector-effect="non-scaling-stroke"
        d="M0,200 C220,260 400,120 640,220 S900,300 1000,180"
      />
      <path
        fill="none"
        stroke="rgba(34,211,238,0.15)"
        stroke-width="0.5"
        vector-effect="non-scaling-stroke"
        d="M0,280 C200,200 500,360 720,240 S920,180 1000,320"
      />
    </svg>
  </div>
</template>
