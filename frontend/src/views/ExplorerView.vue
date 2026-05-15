<script setup lang="ts">
import { computed, ref } from 'vue';

type MockBlock = {
  height: number;
  hash: string;
  txs: number;
  ts: string;
};

const blocks = ref<MockBlock[]>([
  {
    height: 18420,
    hash: '0x9f2c8a1b4e6d7c3a5b8e9f0d1c2a4b6e8f0d2c4a6b8e0f2d4c6a8b0e2d4c6',
    txs: 5,
    ts: '2026-05-14 14:02:11',
  },
  {
    height: 18417,
    hash: '0x7e1d9b3c5f8a2e4d6c0b9a7f5e3d1c8b6a4f2e0d8c6b4a2f0e8d6c4b2a0f8',
    txs: 3,
    ts: '2026-05-14 13:58:44',
  },
  {
    height: 18414,
    hash: '0x5d0c8a2b4e7f9d1c3a5b7e9f1d3c5a7b9e1f3d5c7a9b1e3d5c7a9b1e3d5c7',
    txs: 4,
    ts: '2026-05-14 13:51:02',
  },
  {
    height: 18411,
    hash: '0x4c9b7a1e3d5f7c9a1b3e5d7f9a1b3e5d7f9a1b3e5d7f9a1b3e5d7f9a1b3e5',
    txs: 2,
    ts: '2026-05-14 13:45:19',
  },
]);

const filter = ref('');

const filtered = computed(() => {
  const q = filter.value.trim().toLowerCase();
  if (!q) return blocks.value;
  return blocks.value.filter(
    (b) =>
      b.hash.toLowerCase().includes(q) ||
      String(b.height).includes(q) ||
      b.ts.includes(q),
  );
});
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-xl font-semibold text-white sm:text-2xl">链上浏览器（精简版）</h1>
      <p class="mt-1 text-sm text-slate-400">
        教学演示用「迷你浏览器」：展示区块高度、时间戳与交易笔数。当前为<strong class="text-amber-200/90">静态演示数据</strong>；若对接
        Orderer / Couch 或后端聚合接口，可替换为实时区块流。
      </p>
      <p class="mt-2 max-w-3xl text-xs text-slate-500">
        单笔交易「读旧写新」的叙事化展示见 <strong class="text-cyan-200/80">全链路溯源</strong>：点击时间轴节点，对话框内「读写集叙事」由后端
        <code class="text-cyan-200/80">GET /api/scores/tx-insight</code> 基于 <code class="text-cyan-200/80">GetScoreHistory</code> 解析生成。
      </p>
    </div>

    <div class="flex flex-wrap items-center gap-3">
      <el-input
        v-model="filter"
        clearable
        placeholder="按高度 / 哈希片段 / 时间过滤"
        class="w-full max-w-md"
      />
    </div>

    <el-table :data="filtered" stripe class="explorer-table" empty-text="无匹配区块">
      <el-table-column prop="height" label="区块高度" width="120" />
      <el-table-column prop="ts" label="时间戳" width="180" />
      <el-table-column prop="txs" label="交易笔数" width="110" />
      <el-table-column prop="hash" label="区块哈希（节选）">
        <template #default="{ row }">
          <code class="break-all text-xs text-cyan-100/90">{{ row.hash }}</code>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<style scoped>
.explorer-table :deep(.el-table__header th) {
  background: rgba(15, 23, 42, 0.95);
  color: #94a3b8;
}
.explorer-table :deep(.el-table__row) {
  background: rgba(15, 23, 42, 0.35);
}
.explorer-table :deep(.el-table__row:hover > td) {
  background: rgba(30, 41, 59, 0.85) !important;
}
</style>
