<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
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
import { authUser } from '../stores/auth';
import TopologyOrg12 from '../components/TopologyOrg12.vue';

use([CanvasRenderer, LineChart, GridComponent, TooltipComponent, LegendComponent, TitleComponent]);

const health = ref<HealthResponse | null>(null);
const loadErr = ref('');
const pollOk = ref(true);

let pollTimer: ReturnType<typeof setInterval> | null = null;
let blockTimer: ReturnType<typeof setInterval> | null = null;

type BlockRow = { id: string; height: number; hash: string; txs: number; time: string };

const streamBlocks = ref<BlockRow[]>([]);
let streamTick = 0;

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

function seedStream() {
  const base = health.value?.channel ?? 'mychannel';
  streamBlocks.value = [0, 1, 2, 3, 4].map((i) => ({
    id: `seed-${i}`,
    height: 18420 - i * 3,
    hash: pseudoBlockHash(`${base}-stream-${i}`),
    txs: 2 + (i % 4),
    time: new Date(Date.now() - i * 170_000).toLocaleTimeString('zh-CN', { hour12: false }),
  }));
}

function pushDemoBlock() {
  streamTick += 1;
  const h = health.value?.channel ?? 'mychannel';
  const row: BlockRow = {
    id: `live-${Date.now()}-${streamTick}`,
    height: 18420 + streamTick,
    hash: pseudoBlockHash(`${h}-tick-${streamTick}`),
    txs: 1 + (streamTick % 5),
    time: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
  };
  streamBlocks.value = [row, ...streamBlocks.value].slice(0, 8);
}

async function refreshHealth() {
  try {
    const h = await fetchHealth();
    health.value = h;
    loadErr.value = '';
    pollOk.value = !!(h.ok && h.fabricConfigured);
  } catch (e) {
    loadErr.value = e instanceof Error ? e.message : '无法连接后端';
    pollOk.value = false;
  }
}

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

const liveTone = computed(() => {
  if (loadErr.value) return 'error';
  if (!health.value) return 'pending';
  return health.value.fabricConfigured && health.value.ok ? 'ok' : 'warn';
});

const isStudentView = computed(() => authUser.value?.role === 'Student');

const statCards = computed(() => {
  const h = health.value;
  return [
    {
      key: 'gw',
      title: '网关与账本',
      value: h?.fabricConfigured ? '已连接' : loadErr.value ? '连接异常' : '检测中…',
      sub: h ? `${h.service}` : '轮询 /api/health',
      tone: h?.fabricConfigured ? 'ok' : loadErr.value ? 'warn' : 'neutral',
    },
    {
      key: 'ch',
      title: '通道 · 链码',
      value: h ? `${h.channel} / ${h.chaincode}` : '—',
      sub: 'evaluate / submitAsync',
      tone: 'neutral',
    },
    {
      key: 'bh',
      title: '区块高度（演示）',
      value: '18,420',
      sub: '可对接 GET /api/chain/summary',
      tone: 'demo',
    },
    {
      key: 'topo',
      title: '背书拓扑（示意）',
      value: '',
      sub: 'Org1 + Org2 双 Peer 背书 → Orderer',
      tone: 'topo',
    },
  ];
});

onMounted(async () => {
  await refreshHealth();
  seedStream();
  pollTimer = setInterval(() => {
    void refreshHealth();
  }, 5000);
  blockTimer = setInterval(() => {
    pushDemoBlock();
  }, 7000);
});

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer);
  if (blockTimer) clearInterval(blockTimer);
});
</script>

<template>
  <div class="space-y-6">
    <el-alert
      v-if="isStudentView"
      type="success"
      :closable="false"
      class="border border-emerald-500/25 bg-emerald-950/25"
      title="学生视图 · 个人学习概况（演示）"
    >
      <template #default>
        <div class="text-xs text-slate-300">
          演示学分绩点 <strong class="text-emerald-200">3.72</strong> · 本学期已修
          <strong class="text-emerald-200">18</strong> 学分。曲线为占位数据；对接教务后可按本人学号聚合链上成绩。
        </div>
      </template>
    </el-alert>
    <el-alert
      v-else-if="authUser?.role === 'Academic_Affairs'"
      type="warning"
      :closable="false"
      class="border border-amber-500/25 bg-amber-950/20"
      title="教务视图 · 待处理异常（演示）"
    >
      <template #default>
        <ul class="list-inside list-disc text-xs text-slate-300">
          <li>3 条「分数与历史不一致」待复核（占位）</li>
          <li>1 条作废后仍被查询的访问告警（占位）</li>
        </ul>
      </template>
    </el-alert>

    <div class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 class="text-xl font-semibold tracking-tight text-white sm:text-2xl">综合数据看板</h1>
        <p class="mt-1 max-w-2xl text-sm text-slate-400">
          网关状态每 5 秒轮询；右侧「区块流」为演示数据定时滑入，答辩可换 WebSocket / 区块 API。
        </p>
      </div>
      <div
        class="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs"
        :class="
          liveTone === 'ok'
            ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-200'
            : liveTone === 'error'
              ? 'border-rose-500/40 bg-rose-500/10 text-rose-200'
              : 'border-amber-500/30 bg-amber-500/10 text-amber-100'
        "
      >
        <span class="relative flex h-2.5 w-2.5">
          <span
            v-if="liveTone === 'ok'"
            class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-55"
          />
          <span
            class="relative inline-flex h-2.5 w-2.5 rounded-full"
            :class="
              liveTone === 'ok'
                ? 'bg-emerald-400 shadow-[0_0_10px_#34d399]'
                : liveTone === 'error'
                  ? 'bg-rose-500 shadow-[0_0_10px_#fb7185]'
                  : 'bg-amber-400'
            "
          />
        </span>
        {{ liveTone === 'ok' ? 'Live · 网关可达' : liveTone === 'error' ? '离线 / 异常' : '自检中…' }}
      </div>
    </div>

    <el-alert v-if="loadErr" type="error" :closable="false" :title="loadErr" />

    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <div
        v-for="c in statCards"
        :key="c.key"
        class="group relative overflow-hidden rounded-xl border border-slate-700/60 bg-slate-950/50 p-4 shadow-lg transition hover:border-cyan-500/25"
      >
        <div
          class="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-cyan-500/10 blur-2xl transition group-hover:bg-cyan-400/15"
        />
        <div class="flex items-start justify-between gap-2">
          <div class="text-xs font-medium uppercase tracking-wider text-slate-500">{{ c.title }}</div>
          <span
            v-if="c.key === 'gw'"
            class="relative flex h-2 w-2 shrink-0 translate-y-1"
            :title="pollOk ? '后端与 Fabric 自检通过' : '未通过或检测中'"
          >
            <span
              v-if="pollOk"
              class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50"
            />
            <span
              class="relative inline-flex h-2 w-2 rounded-full"
              :class="pollOk ? 'bg-emerald-400' : loadErr ? 'bg-rose-500' : 'bg-slate-500'"
            />
          </span>
        </div>
        <template v-if="c.tone !== 'topo'">
          <div class="mt-2 truncate text-lg font-semibold text-white">{{ c.value }}</div>
          <div class="mt-1 text-xs text-slate-500">{{ c.sub }}</div>
        </template>
        <template v-else>
          <div class="mt-2 h-[100px] w-full">
            <TopologyOrg12 />
          </div>
          <div class="mt-1 text-xs text-slate-500">{{ c.sub }}</div>
        </template>
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
          <span class="text-sm font-medium text-slate-200">最新区块流（演示 · 自动滑入）</span>
          <span class="text-[10px] text-amber-200/80">约 7s 模拟新区块</span>
        </div>
        <transition-group
          name="block-slide"
          tag="ul"
          class="relative max-h-80 space-y-2 overflow-y-auto pr-1"
        >
          <li
            v-for="b in streamBlocks"
            :key="b.id"
            class="rounded-lg border border-slate-700/50 bg-slate-900/60 p-3 text-xs shadow-sm"
          >
            <div class="flex justify-between text-[11px] text-slate-500">
              <span>高度 #{{ b.height }}</span>
              <span>{{ b.time }} · {{ b.txs }} tx</span>
            </div>
            <div class="mt-1 font-mono text-[11px] leading-snug text-cyan-100/90">{{ b.hash }}</div>
          </li>
        </transition-group>
      </div>
    </div>
  </div>
</template>

<style scoped>
:deep(.echarts) {
  width: 100%;
}

.block-slide-move,
.block-slide-enter-active {
  transition: all 0.45s cubic-bezier(0.22, 1, 0.36, 1);
}
.block-slide-enter-from {
  opacity: 0;
  transform: translateY(-14px);
}
.block-slide-leave-active {
  transition: opacity 0.2s ease;
}
.block-slide-leave-to {
  opacity: 0;
}
</style>
