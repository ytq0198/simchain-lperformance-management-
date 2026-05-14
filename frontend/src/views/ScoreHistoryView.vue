<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useClipboard } from '@vueuse/core';
import { ElMessage } from 'element-plus';
import { fetchHistory, type HistoryEntry } from '../api/score';
import { formatUnixSeconds } from '../utils/format';

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

/** API 返回为「新版本在前」；时间轴按时间正序展示 */
const chronological = computed(() => [...list.value].reverse());

function syncFromRoute() {
  form.studentId = (route.query.studentId as string) || '';
  form.courseId = (route.query.courseId as string) || '';
  form.semester = (route.query.semester as string) || '';
}

function eventLabel(entry: HistoryEntry, idx: number, total: number): string {
  if (entry.record.status === 'REVOKED') return '成绩作废（终态）';
  const r = entry.record.remark || '';
  if (r.includes('更正')) return '成绩更正';
  if (r.includes('作废')) return '作废操作';
  if (idx === 0) return '初始上链 / 早期版本';
  if (idx === total - 1) return '当前链上版本';
  return '链上状态变更';
}

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

function openDetail(row: HistoryEntry) {
  selected.value = row;
  dialogVisible.value = true;
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
        垂直时间轴展示同一复合键下的版本演进，体现「不可篡改、可追溯」。点击节点查看
        <strong class="text-cyan-200/90">Transaction ID</strong> 与原始 JSON。
      </p>
    </div>

    <div class="flex flex-wrap gap-3 rounded-xl border border-slate-700/50 bg-slate-950/40 p-4">
      <el-input v-model="form.studentId" clearable placeholder="学号" class="w-40" />
      <el-input v-model="form.courseId" clearable placeholder="课程代码" class="w-40" />
      <el-input v-model="form.semester" clearable placeholder="学期" class="w-36" />
      <el-button type="primary" :loading="loading" @click="load">加载链上历史</el-button>
    </div>

    <el-empty
      v-if="!loading && chronological.length === 0"
      description="请输入完整学号 / 课程 / 学期后加载"
    />

    <div v-else class="relative pl-2">
      <div class="absolute bottom-0 left-[11px] top-2 w-px bg-gradient-to-b from-cyan-500/50 via-slate-600 to-transparent" />
      <div
        v-for="(item, idx) in chronological"
        :key="item.txId + idx"
        class="relative mb-8 flex gap-4 pl-8 last:mb-0"
      >
        <div
          class="absolute left-0 top-1 flex h-6 w-6 items-center justify-center rounded-full border border-cyan-400/50 bg-slate-900 text-[10px] font-bold text-cyan-200 shadow-[0_0_12px_rgba(34,211,238,0.35)]"
        >
          {{ idx + 1 }}
        </div>
        <div
          class="flex-1 cursor-pointer rounded-xl border border-slate-700/60 bg-slate-950/50 p-4 transition hover:border-cyan-500/35 hover:shadow-glow"
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
              <span
                class="rounded-full border border-slate-600 px-2 py-0.5 text-xs text-slate-300"
              >
                分数 {{ item.record.score }} · {{ item.record.status }}
              </span>
              <el-button size="small" @click.stop="copyTx(item.txId)">复制 TxID</el-button>
            </div>
          </div>
          <p class="mt-2 line-clamp-2 text-xs text-slate-500">
            {{ item.record.remark || '（无备注）' }} · 点击卡片查看完整 JSON
          </p>
          <code class="mt-2 block truncate font-mono text-[11px] text-cyan-100/80">{{ item.txId }}</code>
        </div>
      </div>
    </div>

    <el-dialog
      v-model="dialogVisible"
      title="版本详情 · 链上原始数据"
      width="min(720px, 96vw)"
      class="history-dialog"
      destroy-on-close
    >
      <template v-if="selected">
        <div class="mb-3 flex flex-wrap items-center gap-2">
          <el-tag type="info">TxID</el-tag>
          <code class="break-all text-xs text-cyan-100/90">{{ selected.txId }}</code>
          <el-button size="small" type="primary" @click="copyTx(selected.txId)">复制</el-button>
        </div>
        <pre
          class="max-h-[55vh] overflow-auto rounded-lg border border-slate-700 bg-slate-950 p-3 text-xs leading-relaxed text-emerald-100/90"
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
