<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import type { FormInstance, FormRules } from 'element-plus';
import { ElMessage } from 'element-plus';
import { fetchMyAppeals, postAppeal, type AppealListItem } from '../api/score';
import { courseIdRules, semesterRules, studentIdRules } from '../utils/validators';

const formRef = ref<FormInstance>();
const form = reactive({
  studentId: '2021003',
  courseId: 'PHYS101',
  semester: '2024-3',
  reason: '',
});
const rules: FormRules = {
  studentId: studentIdRules,
  courseId: courseIdRules,
  semester: semesterRules,
  reason: [{ required: true, message: '请填写申诉理由', trigger: 'blur' }],
};

const loading = ref(false);
const list = ref<AppealListItem[]>([]);

async function refresh() {
  if (!form.studentId.trim()) return;
  loading.value = true;
  try {
    list.value = await fetchMyAppeals(form.studentId.trim());
  } finally {
    loading.value = false;
  }
}

async function onSubmit() {
  if (!formRef.value) return;
  await formRef.value.validate();
  loading.value = true;
  try {
    await postAppeal({
      studentId: form.studentId.trim(),
      courseId: form.courseId.trim(),
      semester: form.semester.trim(),
      reason: form.reason.trim(),
    });
    ElMessage.success('申诉已上链');
    form.reason = '';
    await refresh();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '提交失败');
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  void refresh();
});
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-xl font-semibold text-white sm:text-2xl">成绩申诉</h1>
      <p class="mt-1 max-w-2xl text-sm text-slate-400">
        使用 <strong class="text-cyan-200/90">student01</strong> 登录后在此发起链上申诉记录（Org2MSP 提交）；教师 / 教务在「申诉处理」中办结。
      </p>
    </div>

    <el-form ref="formRef" :model="form" :rules="rules" label-width="88px" class="max-w-2xl space-y-2">
      <el-form-item label="学号" prop="studentId">
        <el-input v-model="form.studentId" clearable />
      </el-form-item>
      <el-form-item label="课程" prop="courseId">
        <el-input v-model="form.courseId" clearable />
      </el-form-item>
      <el-form-item label="学期" prop="semester">
        <el-input v-model="form.semester" clearable />
      </el-form-item>
      <el-form-item label="理由" prop="reason">
        <el-input v-model="form.reason" type="textarea" :rows="3" placeholder="说明异议与期望处理" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" :loading="loading" @click="onSubmit">提交链上申诉</el-button>
        <el-button :loading="loading" @click="refresh">刷新列表</el-button>
      </el-form-item>
    </el-form>

    <el-table :data="list" stripe class="appeal-table" empty-text="暂无申诉记录">
      <el-table-column prop="appeal.status" label="状态" width="100" />
      <el-table-column prop="appeal.courseId" label="课程" width="120" />
      <el-table-column prop="appeal.semester" label="学期" width="100" />
      <el-table-column prop="appeal.reason" label="理由" min-width="200" show-overflow-tooltip />
      <el-table-column prop="appeal.resolution" label="处理说明" min-width="180" show-overflow-tooltip />
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
