<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { fetchOpenAppeals, postResolveAppeal, type AppealListItem } from '../api/score';

const loading = ref(false);
const list = ref<AppealListItem[]>([]);

async function refresh() {
  loading.value = true;
  try {
    list.value = await fetchOpenAppeals();
  } finally {
    loading.value = false;
  }
}

async function resolveRow(row: AppealListItem) {
  try {
    const { value } = await ElMessageBox.prompt('请输入处理说明（将写入链上）', '办结申诉', {
      confirmButtonText: '上链办结',
      cancelButtonText: '取消',
      inputPattern: /.+/,
      inputErrorMessage: '不能为空',
    });
    await postResolveAppeal({ compositeKey: row.compositeKey, resolution: String(value) });
    ElMessage.success('已办结');
    await refresh();
  } catch {
    /* cancel */
  }
}

onMounted(() => {
  void refresh();
});
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="text-xl font-semibold text-white sm:text-2xl">申诉处理</h1>
        <p class="mt-1 max-w-2xl text-sm text-slate-400">
          待处理申诉来自学生 Org2 提交；教师 / 教务处使用 Org1 调用 <code class="text-cyan-200/80">ResolveAppeal</code> 写入处理说明。
        </p>
      </div>
      <el-button :loading="loading" @click="refresh">刷新</el-button>
    </div>

    <el-table :data="list" stripe class="appeal-table" empty-text="暂无待处理申诉">
      <el-table-column prop="appeal.studentId" label="学号" width="120" />
      <el-table-column prop="appeal.courseId" label="课程" width="120" />
      <el-table-column prop="appeal.semester" label="学期" width="100" />
      <el-table-column prop="appeal.reason" label="申诉理由" min-width="220" show-overflow-tooltip />
      <el-table-column label="操作" width="120" fixed="right">
        <template #default="{ row }">
          <el-button type="primary" link @click="resolveRow(row)">办结</el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<style scoped>
.appeal-table :deep(.el-table__header th) {
  background: rgba(15, 23, 42, 0.95);
  color: #94a3b8;
}
.appeal-table :deep(.el-table__row) {
  background: rgba(15, 23, 42, 0.35);
}
</style>
