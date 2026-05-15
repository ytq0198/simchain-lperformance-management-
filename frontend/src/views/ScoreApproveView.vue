<script setup lang="ts">
import { reactive, ref } from 'vue';
import type { FormInstance, FormRules } from 'element-plus';
import { ElMessage } from 'element-plus';
import { postApproveScore } from '../api/score';
import { courseIdRules, semesterRules, studentIdRules } from '../utils/validators';

const formRef = ref<FormInstance>();
const form = reactive({
  studentId: '',
  courseId: '',
  semester: '',
});
const rules: FormRules = {
  studentId: studentIdRules,
  courseId: courseIdRules,
  semester: semesterRules,
};
const loading = ref(false);
const lastTx = ref('');

async function onSubmit() {
  if (!formRef.value) return;
  await formRef.value.validate();
  loading.value = true;
  lastTx.value = '';
  try {
    const res = await postApproveScore({
      studentId: form.studentId,
      courseId: form.courseId,
      semester: form.semester,
    });
    lastTx.value = res.transactionId;
    ElMessage.success('审核通过，成绩已转为 ACTIVE');
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '审核失败');
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-xl font-semibold text-white sm:text-2xl">成绩审核（教务处）</h1>
      <p class="mt-1 max-w-2xl text-sm text-slate-400">
        教师录入后链上状态为 <strong class="text-amber-200/90">PENDING</strong>，需教务处在此执行
        <code class="text-cyan-200/80">ApproveScore</code> 后转为 <strong class="text-emerald-200/90">ACTIVE</strong> 方视为正式发布。
      </p>
    </div>

    <el-alert type="warning" :closable="false" class="max-w-2xl border border-amber-500/25 bg-amber-950/20" title="链码须已升级">
      若虚拟机仍运行旧版链码（无 ApproveScore），请先按仓库 <code class="text-cyan-200/80">score-chaincode/README-VM.md</code> 升版部署（建议 <strong>1.2</strong>）。
    </el-alert>

    <el-form ref="formRef" :model="form" :rules="rules" label-width="100px" class="form max-w-xl">
      <el-form-item label="学号" prop="studentId">
        <el-input v-model="form.studentId" clearable placeholder="待审核记录的学号" />
      </el-form-item>
      <el-form-item label="课程" prop="courseId">
        <el-input v-model="form.courseId" clearable />
      </el-form-item>
      <el-form-item label="学期" prop="semester">
        <el-input v-model="form.semester" clearable />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" :loading="loading" @click="onSubmit">审核通过（上链）</el-button>
      </el-form-item>
    </el-form>

    <el-card v-if="lastTx" shadow="never" class="max-w-xl border border-emerald-500/25 bg-emerald-950/15">
      <div class="text-sm text-emerald-100/90">交易 ID</div>
      <code class="mt-1 block break-all text-xs text-emerald-200/90">{{ lastTx }}</code>
    </el-card>
  </div>
</template>

<style scoped>
.form {
  max-width: 520px;
}
</style>
