<script setup lang="ts">
/**
 * 录入页：半透明盾牌水印；提交中 / 上链成功后「上锁」动效
 */
defineProps<{
  /** 正在提交背书 */
  sealing: boolean;
  /** 已成功落链（盾牌更实、锁闭合） */
  locked: boolean;
}>();
</script>

<template>
  <div
    class="pointer-events-none absolute -right-4 bottom-0 top-8 w-44 select-none sm:w-52"
    aria-hidden="true"
  >
    <svg
      viewBox="0 0 120 140"
      class="h-full w-full drop-shadow-[0_0_24px_rgba(34,211,238,0.12)]"
      :class="{
        'opacity-[0.12] grayscale': !sealing && !locked,
        'opacity-40': sealing && !locked,
        'opacity-55': locked,
      }"
    >
      <defs>
        <linearGradient id="shieldGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#67e8f9" stop-opacity="0.9" />
          <stop offset="100%" stop-color="#6366f1" stop-opacity="0.5" />
        </linearGradient>
      </defs>
      <path
        d="M60 8 L100 28 V72 Q100 108 60 128 Q20 108 20 72 V28 Z"
        fill="url(#shieldGrad)"
        fill-opacity="0.25"
        stroke="rgba(34,211,238,0.45)"
        stroke-width="1.2"
      />
      <g
        class="origin-center transition-transform duration-500 ease-out"
        :class="{ 'scale-95': sealing, 'scale-100': locked }"
        style="transform-box: fill-box; transform-origin: 60px 78px"
      >
        <rect
          x="44"
          y="58"
          width="32"
          height="26"
          rx="4"
          fill="rgba(15,23,42,0.75)"
          stroke="rgba(34,211,238,0.6)"
          stroke-width="1.2"
        />
        <path
          d="M52 58 V50 Q60 42 68 50 V58"
          fill="none"
          stroke="rgba(148,163,184,0.9)"
          stroke-width="2.5"
          stroke-linecap="round"
          :class="['lock-shackle', { 'lock-shackle--closed': locked }]"
        />
        <rect
          x="54"
          y="68"
          width="12"
          height="10"
          rx="1"
          fill="none"
          stroke="rgba(34,211,238,0.85)"
          stroke-width="1.5"
          :class="{ 'opacity-40': !locked, 'opacity-100': locked }"
          class="transition-opacity duration-300"
        />
      </g>
    </svg>
    <div
      v-if="locked"
      class="absolute bottom-6 right-2 rounded border border-emerald-500/30 bg-emerald-950/40 px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider text-emerald-200/90"
    >
      On-chain
    </div>
  </div>
</template>

<style scoped>
.lock-shackle {
  transition: transform 0.45s ease, opacity 0.35s ease;
  transform: translateY(-2px);
  opacity: 0.85;
}
.lock-shackle--closed {
  transform: translateY(0);
  opacity: 1;
}
</style>
