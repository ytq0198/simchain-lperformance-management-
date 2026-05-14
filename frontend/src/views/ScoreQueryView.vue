<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import type { FormInstance, FormRules } from 'element-plus';
import { fetchScore, type ScoreRecord } from '../api/score';
import { formatUnixSeconds } from '../utils/format';

const router = useRouter();
const formRef = ref<FormInstance>();
const form = reactive({
  studentId: '2021003',
  courseId: 'PHYS101',
  semester: '2024-3',
});

const rules: FormRules = {
  studentId: [{ required: true, message: '请输入学号', trigger: 'blur' }],
  courseId: [{ required: true, message: '请输入课程代码', trigger: 'blur' }],
  semester: [{ required: true, message: '请输入学期', trigger: 'blur' }],
};

const loading = ref(false);
const record = ref<ScoreRecord | null>(null);

async function onQuery() {
  if (!formRef.value) return;
  await formRef.value.validate();
  loading.value = true;
  record.value = null;
  try {
    record.value = await fetchScore(form.studentId, form.courseId, form.semester);
  } finally {
    loading.value = false;
  }
}

function goHistory() {
  router.push({
    path: '/scores/history',
    query: { studentId: form.studentId, courseId: form.courseId, semester: form.semester },
  });
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-xl font-semibold text-white sm:text-2xl">成绩查询</h1>
      <p class="mt-1 text-sm text-slate-400">按学号、课程、学期读取链上当前 composite key 对应记录。</p>
    </div>
    <el-form ref="formRef" :model="form" :rules="rules" label-width="88px" class="form max-w-xl">
      <el-form-item label="学号" prop="studentId">
        <el-input v-model="form.studentId" placeholder="如 2021003" clearable />
      </el-form-item>
      <el-form-item label="课程" prop="courseId">
        <el-input v-model="form.courseId" placeholder="如 PHYS101" clearable />
      </el-form-item>
      <el-form-item label="学期" prop="semester">
        <el-input v-model="form.semester" placeholder="如 2024-3" clearable />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" :loading="loading" @click="onQuery">查询链上成绩</el-button>
        <el-button :disabled="!record" @click="goHistory">查看链上历史</el-button>
      </el-form-item>
    </el-form>

    <el-card v-if="record" shadow="never" class="border border-slate-700/50 bg-slate-950/40">
      <template #header>当前链上记录</template>
      <el-descriptions :column="1" border>
        <el-descriptions-item label="学号">{{ record.studentId }}</el-descriptions-item>
        <el-descriptions-item label="课程">{{ record.courseId }}</el-descriptions-item>
        <el-descriptions-item label="学期">{{ record.semester }}</el-descriptions-item>
        <el-descriptions-item label="分数">{{ record.score }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag>{{ record.status }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="更新时间">{{ formatUnixSeconds(record.updatedAt) }}</el-descriptions-item>
        <el-descriptions-item label="操作者 MSP">{{ record.operator }}</el-descriptions-item>
        <el-descriptions-item label="备注">{{ record.remark || '—' }}</el-descriptions-item>
      </el-descriptions>
    </el-card>
  </div>
</template>

<style scoped>
.form {
  max-width: 520px;
}
</style>
