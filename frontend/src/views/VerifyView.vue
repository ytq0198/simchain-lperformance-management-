<script setup lang="ts">
import { reactive, ref, watch } from 'vue';
import type { FormInstance, FormRules } from 'element-plus';
import QRCode from 'qrcode';
import { postVerify, type VerifyResponse } from '../api/score';

const formRef = ref<FormInstance>();
const form = reactive({
  studentId: '',
  courseId: '',
  semester: '',
  claimedScore: 0,
  /** 演示：可粘贴预计算指纹，未来可对接后端比对 */
  fingerprint: '',
});

const rules: FormRules = {
  studentId: [{ required: true, message: '请输入学号', trigger: 'blur' }],
  courseId: [{ required: true, message: '请输入课程代码', trigger: 'blur' }],
  semester: [{ required: true, message: '请输入学期', trigger: 'blur' }],
  claimedScore: [{ required: true, message: '请输入声称分数', trigger: 'blur' }],
};

const loading = ref(false);
const result = ref<VerifyResponse | null>(null);
const qrSrc = ref('');

async function refreshQr() {
  if (!result.value) {
    qrSrc.value = '';
    return;
  }
  const payload = {
    v: 1,
    studentId: form.studentId,
    courseId: form.courseId,
    semester: form.semester,
    claimedScore: form.claimedScore,
    match: result.value.match,
    reason: result.value.reason,
    chainScore: result.value.current ?? null,
    status: result.value.status ?? null,
    fp: form.fingerprint || undefined,
  };
  try {
    qrSrc.value = await QRCode.toDataURL(JSON.stringify(payload), {
      width: 168,
      margin: 1,
      color: { dark: '#0f172a', light: '#f8fafc' },
    });
  } catch {
    qrSrc.value = '';
  }
}

watch(
  () => [result.value, form.studentId, form.courseId, form.semester, form.claimedScore, form.fingerprint],
  () => {
    void refreshQr();
  },
);

async function onSubmit() {
  if (!formRef.value) return;
  await formRef.value.validate();
  loading.value = true;
  result.value = null;
  try {
    result.value = await postVerify({
      studentId: form.studentId,
      courseId: form.courseId,
      semester: form.semester,
      claimedScore: Number(form.claimedScore),
    });
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="space-y-8">
    <div>
      <h1 class="text-xl font-semibold text-white sm:text-2xl">成绩验证与链上凭证</h1>
      <p class="mt-1 max-w-3xl text-sm text-slate-400">
        调用 <code class="rounded bg-slate-800 px-1 py-0.5 text-cyan-200/90">POST /api/verify</code>
        与链上规则比对；下方电子成绩单与二维码用于答辩「确权和防篡改」叙事（二维码载荷为前端 JSON，可扩展为后端签发 JWT / 哈希）。
      </p>
    </div>

    <div class="grid gap-8 lg:grid-cols-2">
      <div class="rounded-xl border border-slate-700/50 bg-slate-950/40 p-5">
        <h2 class="text-sm font-medium text-slate-300">核验参数</h2>
        <el-form ref="formRef" :model="form" :rules="rules" label-position="top" class="mt-4 space-y-1">
          <el-form-item label="学号" prop="studentId">
            <el-input v-model="form.studentId" clearable />
          </el-form-item>
          <el-form-item label="课程代码" prop="courseId">
            <el-input v-model="form.courseId" clearable />
          </el-form-item>
          <el-form-item label="学期" prop="semester">
            <el-input v-model="form.semester" clearable />
          </el-form-item>
          <el-form-item label="声称分数" prop="claimedScore">
            <el-input-number v-model="form.claimedScore" :min="0" :max="100" class="w-full" />
          </el-form-item>
          <el-form-item label="成绩单指纹（可选 · 演示）">
            <el-input
              v-model="form.fingerprint"
              type="textarea"
              :rows="2"
              placeholder="可粘贴 SHA-256 等指纹；当前仅写入二维码载荷，链上比对仍以 claimedScore 为准"
            />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" :loading="loading" class="w-full sm:w-auto" @click="onSubmit">
              一键链上核验
            </el-button>
          </el-form-item>
        </el-form>
      </div>

      <div class="flex flex-col gap-4">
        <transition name="pop">
          <div
            v-if="result"
            key="badge"
            class="flex flex-col items-center justify-center rounded-2xl border p-6 text-center"
            :class="
              result.match
                ? 'border-emerald-500/40 bg-emerald-500/10 shadow-[0_0_40px_rgba(16,185,129,0.12)]'
                : 'border-rose-500/40 bg-rose-500/10 shadow-[0_0_40px_rgba(244,63,94,0.12)]'
            "
          >
            <div
              class="mb-2 flex h-16 w-16 items-center justify-center rounded-full text-3xl"
              :class="result.match ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'"
            >
              {{ result.match ? '✓' : '!' }}
            </div>
            <div class="text-lg font-semibold text-white">
              {{ result.match ? '验证通过' : '与链上规则不一致' }}
            </div>
            <p class="mt-2 text-sm text-slate-300">{{ result.reason }}</p>
            <p v-if="result.current != null" class="mt-1 text-xs text-slate-400">
              链上当前分数：<strong class="text-slate-100">{{ result.current }}</strong>
            </p>
            <p v-if="result.status" class="text-xs text-slate-500">状态：{{ result.status }}</p>
          </div>
        </transition>

        <div
          v-if="result"
          class="relative overflow-hidden rounded-2xl border border-cyan-500/25 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 p-6 shadow-glow"
        >
          <div
            class="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-cyan-500/10 blur-3xl"
          />
          <div class="text-center text-xs font-medium uppercase tracking-[0.25em] text-cyan-300/80">
            区块链电子成绩单（演示）
          </div>
          <div class="mt-4 grid gap-2 text-sm text-slate-300">
            <div class="flex justify-between border-b border-slate-700/50 py-1">
              <span class="text-slate-500">学号</span><span>{{ form.studentId }}</span>
            </div>
            <div class="flex justify-between border-b border-slate-700/50 py-1">
              <span class="text-slate-500">课程</span><span>{{ form.courseId }}</span>
            </div>
            <div class="flex justify-between border-b border-slate-700/50 py-1">
              <span class="text-slate-500">学期</span><span>{{ form.semester }}</span>
            </div>
            <div class="flex justify-between py-1">
              <span class="text-slate-500">核验声称分数</span>
              <span class="text-lg font-semibold text-white">{{ form.claimedScore }}</span>
            </div>
          </div>
          <div v-if="qrSrc" class="mt-6 flex justify-center">
            <div class="rounded-xl bg-white p-2 shadow-inner">
              <img :src="qrSrc" alt="verify qr" class="h-40 w-40" />
            </div>
          </div>
          <p class="mt-3 text-center text-[10px] text-slate-500">
            扫码读取核验摘要 JSON · 正式环境可换为教育部门签发 URL
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pop-enter-active {
  transition: all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.pop-leave-active {
  transition: opacity 0.2s ease;
}
.pop-enter-from {
  opacity: 0;
  transform: scale(0.85) translateY(8px);
}
.pop-leave-to {
  opacity: 0;
}
</style>
