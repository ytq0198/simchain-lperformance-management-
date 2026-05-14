<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { LineChart } from 'echarts/charts';
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
} from 'echarts/components';
import VChart from 'vue-echarts';
import { fetchHealth, type HealthResponse } from '../api/score';

use([CanvasRenderer, LineChart, GridComponent, TooltipComponent, LegendComponent, TitleComponent]);

const health = ref<HealthResponse | null>(null);
const loadErr = ref('');

function last7DayLabels(): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    out.push(`${d.getMonth() + 1}/${d.getDate()}`);
  }
  return out;
}

/** 演示曲线：后端可替换为真实按日聚合的写入笔数 */
const demoTxSeries = [4, 7, 5, 12, 9, 14, 11];

const chartOption = computed(() => ({
  backgroundColor: 'transparent',
  title: {
    text: '近 7 日链上写入（演示）',
    left: 0,
    top: 0,
    textStyle: { color: '#94a3b8', fontSize: 13, fontWeight: 500 },
  },
  tooltip: {
    trigger: 'axis',
    backgroundColor: 'rgba(15,23,42,0.95)',
    borderColor: '#334155',
    textStyle: { color: '#e2e8f0' },
  },
  legend: { show: false },
  grid: { left: '2%', right: '3%', bottom: '4%', top: 52, containLabel: true },
  xAxis: {
    type: 'category',
    boundaryGap: false,
    data: last7DayLabels(),
    axisLine: { lineStyle: { color: '#475569' } },
    axisLabel: { color: '#94a3b8' },
  },
  yAxis: {
    type: 'value',
    name: '笔数',
    nameTextStyle: { color: '#64748b' },
    splitLine: { lineStyle: { color: 'rgba(51,65,85,0.45)' } },
    axisLabel: { color: '#94a3b8' },
  },
  series: [
    {
      name: '写入',
      type: 'line',
      smooth: true,
      symbol: 'circle',
      symbolSize: 7,
      showSymbol: true,
      lineStyle: { width: 2.5, color: '#22d3ee' },
      itemStyle: { color: '#67e8f9', borderColor: '#0e7490', borderWidth: 1 },
      areaStyle: {
        color: {
          type: 'linear',
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(34,211,238,0.35)' },
            { offset: 1, color: 'rgba(15,23,42,0)' },
          ],
        },
      },
      data: demoTxSeries,
    },
  ],
}));

function pseudoBlockHash(seed: string): string {
  const parts: string[] = [];
  let x = 0;
  for (let k = 0; k < 4; k++) {
    let h = x + k;
    for (let i = 0; i < seed.length; i++) {
      h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    }
    x = h;
    parts.push(h.toString(16).padStart(8, '0'));
  }
  return `0x${parts.join('').padEnd(64, '0').slice(0, 64)}`;
}

const blockStream = computed(() => {
  const base = health.value?.channel ?? 'mychannel';
  return [0, 1, 2, 3, 4].map((i) => ({
    height: 18420 - i * 3,
    hash: pseudoBlockHash(`${base}-stream-${i}`),
    txs: 2 + (i % 4),
    time: `${12 + i}:0${(i * 7) % 9}`,
  }));
});

onMounted(async () => {
  try {
    health.value = await fetchHealth();
  } catch (e) {
    loadErr.value = e instanceof Error ? e.message : '无法连接后端';
  }
});

const statCards = computed(() => {
  const h = health.value;
  return [
    {
      title: '网关与账本',
      value: h?.fabricConfigured ? '已连接' : '未就绪',
      sub: h ? `${h.service}` : '等待 /api/health',
      tone: h?.fabricConfigured ? 'ok' : 'warn',
    },
    {
      title: '通道 · 链码',
      value: h ? `${h.channel} / ${h.chaincode}` : '—',
      sub: 'evaluate / submitAsync',
      tone: 'neutral',
    },
    {
      title: '区块高度（演示）',
      value: '18,420',
      sub: '可对接 GET /api/chain/summary',
      tone: 'demo',
    },
    {
      title: '背书组织（示意）',
      value: 'Org1 + Org2',
      sub: 'test-network 默认策略',
      tone: 'neutral',
    },
  ];
});
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 class="text-xl font-semibold tracking-tight text-white sm:text-2xl">综合数据看板</h1>
        <p class="mt-1 max-w-2xl text-sm text-slate-400">
          聚合 Fabric 网关健康状态与「链上活动」可视化。带「演示」标签的卡片为占位数据，答辩时可接 Orderer / Couch
          统计接口替换。
        </p>
      </div>
      <div
        v-if="health?.fabricConfigured"
        class="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200"
      >
        <span class="relative flex h-2 w-2">
          <span
            class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60"
          />
          <span class="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
        </span>
        账本可读 · 写通道就绪
      </div>
    </div>

    <el-alert v-if="loadErr" type="error" :closable="false" :title="loadErr" />

    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <div
        v-for="(c, idx) in statCards"
        :key="idx"
        class="group relative overflow-hidden rounded-xl border border-slate-700/60 bg-slate-950/50 p-4 shadow-lg transition hover:border-cyan-500/25"
      >
        <div
          class="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-cyan-500/10 blur-2xl transition group-hover:bg-cyan-400/15"
        />
        <div class="text-xs font-medium uppercase tracking-wider text-slate-500">{{ c.title }}</div>
        <div class="mt-2 truncate text-lg font-semibold text-white">{{ c.value }}</div>
        <div class="mt-1 text-xs text-slate-500">{{ c.sub }}</div>
        <div
          v-if="c.tone === 'demo'"
          class="mt-2 inline-block rounded bg-amber-500/15 px-2 py-0.5 text-[10px] text-amber-200/90"
        >
          演示数据
        </div>
      </div>
    </div>

    <div class="grid gap-6 lg:grid-cols-5">
      <div class="rounded-xl border border-slate-700/60 bg-slate-950/40 p-4 lg:col-span-3">
        <v-chart class="h-72 w-full" :option="chartOption" autoresize />
      </div>
      <div class="rounded-xl border border-slate-700/60 bg-slate-950/40 p-4 lg:col-span-2">
        <div class="mb-3 flex items-center justify-between">
          <span class="text-sm font-medium text-slate-200">最新区块流（演示）</span>
          <span class="text-[10px] text-amber-200/80">哈希为前端占位 · 可接区块 API</span>
        </div>
        <ul class="max-h-72 space-y-2 overflow-y-auto pr-1 text-xs">
          <li
            v-for="b in blockStream"
            :key="b.hash"
            class="cursor-pointer rounded-lg border border-slate-700/50 bg-slate-900/60 p-3 transition hover:border-cyan-500/40 hover:bg-slate-800/80"
            :title="b.hash"
          >
            <div class="flex justify-between text-[11px] text-slate-500">
              <span>高度 #{{ b.height }}</span>
              <span>{{ b.time }} · {{ b.txs }} tx</span>
            </div>
            <div class="mt-1 font-mono text-[11px] leading-snug text-cyan-100/90">{{ b.hash }}</div>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<style scoped>
:deep(.echarts) {
  width: 100%;
}
</style>
