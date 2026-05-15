<script setup lang="ts">
import { reactive, ref } from 'vue';
import type { FormInstance, FormRules } from 'element-plus';
import { ElMessage } from 'element-plus';
import { postScore } from '../api/score';
import { useFabricSubmitFlow } from '../composables/useFabricSubmitFlow';
import { courseIdRules, semesterRules, studentIdRules } from '../utils/validators';

const formRef = ref<FormInstance>();
const form = reactive({
  studentId: '',
  courseId: '',
  semester: '',
  score: 88,
});

const rules: FormRules = {
  studentId: studentIdRules,
  courseId: courseIdRules,
  semester: semesterRules,
  score: [
    { required: true, message: '请输入分数', trigger: 'blur' },
    {
      validator: (_r, v: number, cb) => {
        if (v < 0 || v > 100) cb(new Error('分数须在 0～100'));
        else cb();
      },
      trigger: 'blur',
    },
  ],
};

const loading = ref(false);
const lastTx = ref('');
const { stepLabel, run } = useFabricSubmitFlow();

async function onSubmit() {
  if (!formRef.value) return;
  await formRef.value.validate();
  loading.value = true;
  lastTx.value = '';
  try {
    const res = await run(() =>
      postScore({
        studentId: form.studentId,
        courseId: form.courseId,
        semester: form.semester,
        score: Number(form.score),
      }),
    );
    lastTx.value = res.transactionId;
    ElMessage.success('已提交上链');
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-xl font-semibold text-white sm:text-2xl">录入上链</h1>
      <p class="mt-1 text-sm text-slate-400">
        提交后由 Peer 背书、Orderer 排序、区块落账；下方展示与 Fabric 流程对齐的阶段性说明。
      </p>
    </div>

    <el-alert
      v-if="stepLabel"
      type="info"
      :closable="false"
      class="max-w-xl border border-cyan-500/25 bg-cyan-950/30"
      :title="stepLabel"
    >
      <template #default>
        <el-progress :percentage="66" :indeterminate="true" :stroke-width="4" />
      </template>
    </el-alert>

    <el-form ref="formRef" :model="form" :rules="rules" label-width="100px" class="form max-w-xl">
      <el-form-item label="学号" prop="studentId">
        <el-input v-model="form.studentId" clearable placeholder="4～24 位字母数字" />
      </el-form-item>
      <el-form-item label="课程代码" prop="courseId">
        <el-input v-model="form.courseId" clearable />
      </el-form-item>
      <el-form-item label="学期" prop="semester">
        <el-input v-model="form.semester" placeholder="如 2024-1" clearable />
      </el-form-item>
      <el-form-item label="分数" prop="score">
        <el-input-number v-model="form.score" :min="0" :max="100" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" :loading="loading" @click="onSubmit">提交上链</el-button>
      </el-form-item>
    </el-form>
    <transition name="txpop">
      <el-alert
        v-if="lastTx"
        type="success"
        :closable="false"
        show-icon
        title="交易已提交至通道"
        class="max-w-xl border border-emerald-500/30 bg-emerald-500/10"
      >
        <template #default>
          <div class="text-xs text-emerald-100/90">transactionId（可写入实验报告）</div>
          <code class="txid mt-1 block text-emerald-50">{{ lastTx }}</code>
        </template>
      </el-alert>
    </transition>
  </div>
</template>

<style scoped>
.form {
  max-width: 480px;
}
.txid {
  word-break: break-all;
}

.txpop-enter-active {
  transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.txpop-enter-from {
  opacity: 0;
  transform: translateY(12px) scale(0.96);
}
</style>
