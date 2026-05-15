<script setup lang="ts">
/**
 * 溯源页：垂直「区块」双螺旋装饰（数字 DNA / 版本链意象）
 */
import { computed } from 'vue';

const props = defineProps<{
  /** 与列表长度弱关联，螺旋节点数量略随版本数变化 */
  versionCount: number;
}>();

const n = computed(() => Math.min(20, Math.max(10, props.versionCount + 6)));

const strandA = computed(() =>
  Array.from({ length: n.value }, (_, i) => ({
    x: 14 + Math.sin(i * 0.55) * 10 - 4,
    y: 20 + i * 38,
  })),
);
const strandB = computed(() =>
  Array.from({ length: n.value }, (_, i) => ({
    x: 34 + Math.cos(i * 0.55) * 10 - 4,
    y: 36 + i * 38,
  })),
);
</script>

<template>
  <svg
    class="pointer-events-none absolute inset-y-0 left-0 w-14 text-cyan-500/30 sm:w-[4.5rem]"
    viewBox="0 0 56 640"
    preserveAspectRatio="xMinYMid slice"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <defs>
      <linearGradient id="helixStroke" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#22d3ee" stop-opacity="0.4" />
        <stop offset="100%" stop-color="#818cf8" stop-opacity="0.12" />
      </linearGradient>
    </defs>
    <path
      d="M18 12 Q30 120 14 240 T18 420 T14 620"
      fill="none"
      stroke="url(#helixStroke)"
      stroke-width="1"
      stroke-dasharray="5 8"
    />
    <path
      d="M38 12 Q26 130 42 250 T38 430 T42 620"
      fill="none"
      stroke="url(#helixStroke)"
      stroke-width="1"
      stroke-dasharray="5 8"
    />
    <rect
      v-for="(p, i) in strandA"
      :key="'a' + i"
      :x="p.x"
      :y="p.y"
      width="8"
      height="8"
      rx="2"
      fill="rgba(15,23,42,0.9)"
      stroke="rgba(34,211,238,0.35)"
      stroke-width="0.7"
    />
    <rect
      v-for="(p, i) in strandB"
      :key="'b' + i"
      :x="p.x"
      :y="p.y"
      width="8"
      height="8"
      rx="2"
      fill="rgba(15,23,42,0.9)"
      stroke="rgba(129,140,248,0.35)"
      stroke-width="0.7"
    />
  </svg>
</template>
