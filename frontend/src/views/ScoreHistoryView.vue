<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useClipboard } from '@vueuse/core';
import { ElMessage } from 'element-plus';
import { fetchHistory, fetchTxInsight, type HistoryEntry, type ScoreRecord, type TxInsightResponse } from '../api/score';
import { formatUnixSeconds } from '../utils/format';
import TraceHelixBlocks from '../components/decorative/TraceHelixBlocks.vue';

const route = useRoute();
const { copy } = useClipboard();

const form = reactive({
  studentId: '',
  courseId: '',
  semester: '',
});
const loading = ref(false);
const list = ref<HistoryEntry[]>([]);

const dialogVisible = ref(false);
const selected = ref<HistoryEntry | null>(null);
const selectedIndex = ref(-1);
const txInsight = ref<TxInsightResponse | null>(null);
const insightLoading = ref(false);

/** API 返回为「新版本在前」；时间轴按时间正序展示 */
const chronological = computed(() => [...list.value].reverse());

function syncFromRoute() {
  form.studentId = (route.query.studentId as string) || '';
  form.courseId = (route.query.courseId as string) || '';
  form.semester = (route.query.semester as string) || '';
}

function eventLabel(entry: HistoryEntry, idx: number, total: number): string {
  if (entry.record.status === 'REVOKED') return '成绩作废（终态）';
  if (entry.record.status === 'PENDING') return '待教务处审核（PENDING）';
  const r = entry.record.remark || '';
  if (r.includes('更正')) return '成绩更正';
  if (r.includes('作废')) return '作废操作';
  if (idx === 0) return '初始上链 / 早期版本';
  if (idx === total - 1) return '当前链上版本';
  return '链上状态变更';
}

/** 节点配色：绿=初始、蓝=更正、红=作废、琥珀=待审 */
function nodeKind(entry: HistoryEntry, idx: number): 'initial' | 'correct' | 'revoke' | 'pending' | 'other' {
  if (entry.record.status === 'REVOKED') return 'revoke';
  if (entry.record.status === 'PENDING') return 'pending';
  const r = entry.record.remark || '';
  if (r.includes('更正')) return 'correct';
  if (idx === 0) return 'initial';
  return 'other';
}

const nodeRing = {
  initial: 'border-emerald-500/60 bg-emerald-500/15 text-emerald-200 shadow-[0_0_14px_rgba(16,185,129,0.25)]',
  correct: 'border-sky-500/60 bg-sky-500/15 text-sky-100 shadow-[0_0_14px_rgba(56,189,248,0.2)]',
  revoke: 'border-rose-500/60 bg-rose-500/15 text-rose-100 shadow-[0_0_14px_rgba(244,63,94,0.22)]',
  pending: 'border-amber-500/60 bg-amber-500/15 text-amber-100 shadow-[0_0_14px_rgba(245,158,11,0.22)]',
  other: 'border-cyan-400/50 bg-slate-900 text-cyan-200 shadow-[0_0_12px_rgba(34,211,238,0.2)]',
};

const cardBorder = {
  initial: 'hover:border-emerald-500/40',
  correct: 'hover:border-sky-500/40',
  revoke: 'hover:border-rose-500/40',
  pending: 'hover:border-amber-500/40',
  other: 'hover:border-cyan-500/35',
};

const prevRecord = computed<ScoreRecord | null>(() => {
  if (!selected.value || selectedIndex.value <= 0) return null;
  return chronological.value[selectedIndex.value - 1]?.record ?? null;
});

type DiffField = { key: string; label: string; before: string; after: string; changed: boolean };

const diffRows = computed<DiffField[]>(() => {
  if (!selected.value) return [];
  const cur = selected.value.record;
  const prev = prevRecord.value;
  const keys: { key: keyof ScoreRecord; label: string }[] = [
    { key: 'score', label: '分数' },
    { key: 'status', label: '状态' },
    { key: 'remark', label: '备注' },
    { key: 'operator', label: '操作者' },
    { key: 'updatedAt', label: '更新时间' },
  ];
  return keys.map(({ key, label }) => {
    const after =
      key === 'updatedAt' ? formatUnixSeconds(cur.updatedAt) : String(cur[key] ?? '—');
    const before = prev
      ? key === 'updatedAt'
        ? formatUnixSeconds(prev.updatedAt)
        : String(prev[key] ?? '—')
      : '—（首版无上一版本）';
    const changed = prev != null && before !== after;
    return { key, label, before, after, changed };
  });
});

async function load() {
  if (!form.studentId || !form.courseId || !form.semester) {
    list.value = [];
    return;
  }
  loading.value = true;
  try {
    list.value = await fetchHistory(form.studentId, form.courseId, form.semester);
  } finally {
    loading.value = false;
  }
}

async function loadTxInsight() {
  if (!selected.value || !form.studentId || !form.courseId || !form.semester) {
    txInsight.value = null;
    return;
  }
  insightLoading.value = true;
  txInsight.value = null;
  try {
    txInsight.value = await fetchTxInsight({
      studentId: form.studentId,
      courseId: form.courseId,
      semester: form.semester,
      txId: selected.value.txId,
    });
  } catch {
    txInsight.value = null;
  } finally {
    insightLoading.value = false;
  }
}

async function openDetail(row: HistoryEntry) {
  selected.value = row;
  selectedIndex.value = chronological.value.findIndex((e) => e.txId === row.txId);
  dialogVisible.value = true;
  await loadTxInsight();
}

async function copyTx(id: string) {
  await copy(id);
  ElMessage.success('TxID 已复制');
}

onMounted(() => {
  syncFromRoute();
  void load();
});

watch(
  () => route.query,
  () => {
    syncFromRoute();
    void load();
  },
);
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-xl font-semibold text-white sm:text-2xl">成绩全生命周期溯源</h1>
      <p class="mt-1 max-w-3xl text-sm text-slate-400">
        时间轴按版本上色；点击节点打开<strong class="text-cyan-200/90">左右 Diff</strong>（若有上一版本）及原始 JSON。
      </p>
    </div>

    <div class="flex flex-wrap gap-3 rounded-xl border border-slate-700/50 bg-slate-950/40 p-4">
      <el-input v-model="form.studentId" clearable placeholder="学号" class="w-40" />
      <el-input v-model="form.courseId" clearable placeholder="课程代码" class="w-40" />
      <el-input v-model="form.semester" clearable placeholder="学期" class="w-36" />
      <el-button type="primary" :loading="loading" @click="load">加载链上历史</el-button>
    </div>

    <div
      v-if="!loading && chronological.length === 0"
      class="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-600/80 bg-slate-950/30 py-16 text-center"
    >
      <svg class="mb-6 h-36 w-64 text-cyan-500/40" viewBox="0 0 240 120" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="beam" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#22d3ee" stop-opacity="0" />
            <stop offset="45%" stop-color="#22d3ee" stop-opacity="0.45" />
            <stop offset="100%" stop-color="#22d3ee" stop-opacity="0" />
          </linearGradient>
        </defs>
        <rect x="70" y="28" width="100" height="64" rx="10" fill="rgba(15,23,42,0.9)" stroke="currentColor" />
        <rect x="108" y="48" width="24" height="24" rx="4" fill="rgba(34,211,238,0.15)" stroke="#22d3ee" />
        <path d="M120 12 L120 28" stroke="url(#beam)" stroke-width="28" />
        <circle cx="120" cy="18" r="3" fill="#67e8f9" />
      </svg>
      <p class="text-sm font-medium text-slate-300">等待链上键入查询</p>
      <p class="mt-2 max-w-md text-xs text-slate-500">
        请输入学号、课程代码与学期后点击「加载链上历史」，将拉取 <code class="text-cyan-600/90">GetScoreHistory</code> 并渲染版本时间轴。
      </p>
    </div>

    <div v-else class="relative z-0 min-h-[120px] pl-2">
      <TraceHelixBlocks class="-left-1 sm:-left-0" :version-count="chronological.length" />
      <div class="relative z-10">
      <div class="absolute bottom-0 left-[11px] top-2 w-px bg-gradient-to-b from-cyan-500/50 via-slate-600 to-transparent" />
      <div
        v-for="(item, idx) in chronological"
        :key="item.txId + idx"
        class="relative mb-8 flex gap-4 pl-8 last:mb-0"
      >
        <div
          class="absolute left-0 top-1 flex h-7 w-7 items-center justify-center rounded-full border text-[10px] font-bold"
          :class="nodeRing[nodeKind(item, idx)]"
        >
          {{ idx + 1 }}
        </div>
        <div
          class="flex-1 cursor-pointer rounded-xl border border-slate-700/60 bg-slate-950/50 p-4 transition hover:shadow-glow"
          :class="cardBorder[nodeKind(item, idx)]"
          role="button"
          tabindex="0"
          @click="openDetail(item)"
          @keydown.enter.prevent="openDetail(item)"
        >
          <div class="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div class="text-xs text-slate-500">{{ formatUnixSeconds(item.timestampUnix) }}</div>
              <div class="mt-1 text-sm font-medium text-white">
                {{ eventLabel(item, idx, chronological.length) }}
              </div>
              <div class="mt-1 text-xs text-slate-400">
                操作者：<span class="text-slate-200">{{ item.record.operator }}</span>
              </div>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <span class="rounded-full border border-slate-600 px-2 py-0.5 text-xs text-slate-300">
                分数 {{ item.record.score }} · {{ item.record.status }}
              </span>
              <el-button size="small" @click.stop="copyTx(item.txId)">复制 TxID</el-button>
            </div>
          </div>
          <p class="mt-2 line-clamp-2 text-xs text-slate-500">
            {{ item.record.remark || '（无备注）' }} · 点击查看 Diff
          </p>
          <code class="mt-2 block truncate font-mono text-[11px] text-cyan-100/80">{{ item.txId }}</code>
        </div>
      </div>
      </div>
    </div>

    <el-dialog
      v-model="dialogVisible"
      title="版本对比 · 链上详情"
      width="min(880px, 96vw)"
      class="history-dialog"
      destroy-on-close
    >
      <template v-if="selected">
        <div class="mb-4 flex flex-wrap items-center gap-2">
          <el-tag type="info">TxID</el-tag>
          <code class="break-all text-xs text-cyan-100/90">{{ selected.txId }}</code>
          <el-button size="small" type="primary" @click="copyTx(selected.txId)">复制</el-button>
        </div>

        <div v-if="prevRecord" class="mb-4 space-y-2">
          <div class="grid grid-cols-2 gap-2 text-center text-[11px] font-medium uppercase tracking-wide text-slate-400">
            <span class="rounded bg-rose-950/40 py-1 text-rose-200/90">修改前</span>
            <span class="rounded bg-emerald-950/40 py-1 text-emerald-200/90">修改后</span>
          </div>
          <div
            v-for="row in diffRows"
            :key="row.key"
            class="grid grid-cols-2 gap-2 font-mono text-xs"
          >
            <div
              class="rounded border px-2 py-2"
              :class="row.changed ? 'border-rose-500/35 bg-rose-950/30 text-rose-50' : 'border-slate-700/50 text-slate-400'"
            >
              <span class="text-slate-500">{{ row.label }}：</span>{{ row.before }}
            </div>
            <div
              class="rounded border px-2 py-2"
              :class="row.changed ? 'border-emerald-500/35 bg-emerald-950/30 text-emerald-50' : 'border-slate-700/50 text-slate-400'"
            >
              <span class="text-slate-500">{{ row.label }}：</span>{{ row.after }}
            </div>
          </div>
        </div>
        <div v-else class="mb-4 rounded-lg border border-slate-600/50 bg-slate-900/50 p-3 text-xs text-slate-400">
          链上最早版本，无「上一版本」可对比；下方为完整 JSON。
        </div>

        <el-divider content-position="left">读写集叙事（后端解析历史）</el-divider>
        <el-skeleton v-if="insightLoading" :rows="3" animated />
        <div v-else-if="txInsight" class="mb-4 space-y-2 rounded-lg border border-cyan-500/20 bg-slate-950/60 p-3 text-xs">
          <p class="text-slate-300">{{ txInsight.narrative.summary }}</p>
          <div>
            <span class="text-slate-500">键：</span>
            <code class="break-all text-cyan-100/90">{{ txInsight.worldStateKey }}</code>
          </div>
          <div v-if="txInsight.narrative.readSet?.length" class="mt-2">
            <div class="font-medium text-amber-200/90">读取（上一版本摘要）</div>
            <pre class="mt-1 max-h-28 overflow-auto rounded bg-slate-900/80 p-2 text-[11px] text-slate-300">{{
              JSON.stringify(txInsight.narrative.readSet, null, 2)
            }}</pre>
          </div>
          <div v-if="txInsight.narrative.writeSet?.length" class="mt-2">
            <div class="font-medium text-emerald-200/90">写入（本交易后）</div>
            <pre class="mt-1 max-h-28 overflow-auto rounded bg-slate-900/80 p-2 text-[11px] text-slate-300">{{
              JSON.stringify(txInsight.narrative.writeSet, null, 2)
            }}</pre>
          </div>
        </div>
        <div v-else-if="!insightLoading" class="mb-4 text-xs text-slate-500">（无法加载 tx-insight）</div>

        <div class="text-xs font-medium text-slate-400">原始 JSON</div>
        <pre
          class="mt-1 max-h-[40vh] overflow-auto rounded-lg border border-slate-700 bg-slate-950 p-3 text-xs leading-relaxed text-emerald-100/90"
        >{{ JSON.stringify(selected, null, 2) }}</pre>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.history-dialog :deep(.el-dialog) {
  background: rgba(15, 23, 42, 0.98);
  border: 1px solid rgba(51, 65, 85, 0.7);
}
.history-dialog :deep(.el-dialog__title) {
  color: #e2e8f0;
}
</style>
