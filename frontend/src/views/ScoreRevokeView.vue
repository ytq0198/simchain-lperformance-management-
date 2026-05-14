<script setup lang="ts">
import { reactive, ref } from 'vue';
import type { FormInstance, FormRules } from 'element-plus';
import { ElMessage, ElMessageBox } from 'element-plus';
import { postRevoke } from '../api/score';

const formRef = ref<FormInstance>();
const form = reactive({
  studentId: '',
  courseId: '',
  semester: '',
  remark: '',
});

const rules: FormRules = {
  studentId: [{ required: true, message: '请输入学号', trigger: 'blur' }],
  courseId: [{ required: true, message: '请输入课程代码', trigger: 'blur' }],
  semester: [{ required: true, message: '请输入学期', trigger: 'blur' }],
  remark: [{ required: true, message: '请输入作废说明', trigger: 'blur' }],
};

const loading = ref(false);
const lastTx = ref('');

async function onSubmit() {
  if (!formRef.value) return;
  await formRef.value.validate();
  try {
    await ElMessageBox.confirm('作废后链上状态将变为 REVOKED，且验真将失败。是否继续？', '确认作废', {
      type: 'warning',
    });
  } catch {
    return;
  }
  loading.value = true;
  lastTx.value = '';
  try {
    const res = await postRevoke({
      studentId: form.studentId,
      courseId: form.courseId,
      semester: form.semester,
      remark: form.remark,
    });
    lastTx.value = res.transactionId;
    ElMessage.success('作废已上链');
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-xl font-semibold text-white sm:text-2xl">成绩作废</h1>
      <p class="mt-1 text-sm text-slate-400">逻辑删除：状态变更为 REVOKED，历史仍可溯源。</p>
    </div>
    <el-form ref="formRef" :model="form" :rules="rules" label-width="100px" class="form max-w-xl">
      <el-form-item label="学号" prop="studentId">
        <el-input v-model="form.studentId" clearable />
      </el-form-item>
      <el-form-item label="课程代码" prop="courseId">
        <el-input v-model="form.courseId" clearable />
      </el-form-item>
      <el-form-item label="学期" prop="semester">
        <el-input v-model="form.semester" clearable />
      </el-form-item>
      <el-form-item label="作废说明" prop="remark">
        <el-input v-model="form.remark" type="textarea" :rows="2" />
      </el-form-item>
      <el-form-item>
        <el-button type="danger" :loading="loading" @click="onSubmit">提交作废</el-button>
      </el-form-item>
    </el-form>
    <transition name="txpop">
      <el-alert
        v-if="lastTx"
        type="success"
        :closable="false"
        show-icon
        title="作废交易已提交"
        class="max-w-xl border border-amber-500/25 bg-amber-500/10"
      >
        <template #default>
          <div class="text-xs text-amber-100/90">transactionId</div>
          <code class="txid mt-1 block text-amber-50">{{ lastTx }}</code>
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
