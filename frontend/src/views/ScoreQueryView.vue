<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import type { FormInstance, FormRules } from 'element-plus';
import QRCode from 'qrcode';
import { fetchHistory, fetchScore, type ScoreRecord } from '../api/score';
import { formatUnixSeconds } from '../utils/format';
import { courseIdRules, semesterRules, studentIdRules } from '../utils/validators';

const router = useRouter();
const formRef = ref<FormInstance>();
const form = reactive({
  studentId: '2021003',
  courseId: 'PHYS101',
  semester: '2024-3',
});

const rules: FormRules = {
  studentId: studentIdRules,
  courseId: courseIdRules,
  semester: semesterRules,
};

const loading = ref(false);
const record = ref<ScoreRecord | null>(null);
/** 键历史迭代器通常最新在前，取首条交易的 txId 用于验真二维码 */
const latestTxId = ref('');
const verifyQrSrc = ref('');

const verifyPageUrl = computed(() => {
  if (!record.value) return '';
  const path = router.resolve({
    path: '/verify',
    query: {
      studentId: form.studentId,
      courseId: form.courseId,
      semester: form.semester,
      claimedScore: String(record.value.score),
      ...(latestTxId.value ? { txId: latestTxId.value } : {}),
      auto: '1',
    },
  }).href;
  try {
    return new URL(path, window.location.origin).toString();
  } catch {
    return path;
  }
});

watch(verifyPageUrl, (url) => {
  if (!url) {
    verifyQrSrc.value = '';
    return;
  }
  void QRCode.toDataURL(url, { width: 160, margin: 1, color: { dark: '#0f172a', light: '#ffffff' } })
    .then((src) => {
      verifyQrSrc.value = src;
    })
    .catch(() => {
      verifyQrSrc.value = '';
    });
});

async function onQuery() {
  if (!formRef.value) return;
  await formRef.value.validate();
  loading.value = true;
  record.value = null;
  latestTxId.value = '';
  try {
    const [rec, hist] = await Promise.all([
      fetchScore(form.studentId, form.courseId, form.semester),
      fetchHistory(form.studentId, form.courseId, form.semester).catch(() => []),
    ]);
    record.value = rec;
    const first = hist[0];
    if (first?.txId) latestTxId.value = first.txId;
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

function openVerifyFromQrLink() {
  if (!verifyPageUrl.value) return;
  window.open(verifyPageUrl.value, '_blank', 'noopener,noreferrer');
}

function exportTranscriptPdf() {
  if (!record.value) return;
  const w = window.open('', '_blank', 'noopener,noreferrer,width=820,height=1100');
  if (!w) return;
  const title = `成绩单_${form.studentId}_${form.courseId}`;
  const txLine = latestTxId.value
    ? `<p class="mono">最新链上交易 ID：${escapeHtml(latestTxId.value)}</p>`
    : '';
  const printBoot = '<' + 'script>window.onload=function(){window.print();}<' + '/script>';
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${escapeHtml(title)}</title>
  <style>
    body{font-family:system-ui,Segoe UI,sans-serif;padding:32px;color:#0f172a;background:#f8fafc;}
    h1{font-size:20px;margin:0 0 8px;}
    .sub{color:#64748b;font-size:13px;margin-bottom:24px;}
    table{width:100%;border-collapse:collapse;font-size:14px;}
    th,td{text-align:left;padding:10px 12px;border-bottom:1px solid #e2e8f0;}
    th{width:28%;color:#475569;font-weight:600;}
    .foot{margin-top:32px;font-size:11px;color:#94a3b8;}
    .mono{word-break:break-all;font-family:ui-monospace,monospace;font-size:11px;}
    @media print{body{background:#fff}}
  </style></head><body>
  <h1>区块链电子成绩单（演示）</h1>
  <p class="sub">由成绩链上存证系统生成 · 用于答辩与存档</p>
  <table>
    <tr><th>学号</th><td>${escapeHtml(record.value.studentId)}</td></tr>
    <tr><th>课程代码</th><td>${escapeHtml(record.value.courseId)}</td></tr>
    <tr><th>学期</th><td>${escapeHtml(record.value.semester)}</td></tr>
    <tr><th>分数</th><td>${escapeHtml(String(record.value.score))}</td></tr>
    <tr><th>状态</th><td>${escapeHtml(record.value.status)}</td></tr>
    <tr><th>更新时间</th><td>${escapeHtml(formatUnixSeconds(record.value.updatedAt))}</td></tr>
    <tr><th>操作者 MSP</th><td>${escapeHtml(record.value.operator)}</td></tr>
    <tr><th>备注</th><td>${escapeHtml(record.value.remark || '—')}</td></tr>
  </table>
  ${txLine}
  <p class="foot">本 PDF 由浏览器打印生成；验真请使用系统中「验真与凭证」或扫描成绩查询页二维码。</p>
  ${printBoot}
  </body></html>`);
  w.document.close();
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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
        <el-input v-model="form.studentId" placeholder="4～24 位字母数字" clearable />
      </el-form-item>
      <el-form-item label="课程" prop="courseId">
        <el-input v-model="form.courseId" placeholder="如 PHYS101" clearable />
      </el-form-item>
      <el-form-item label="学期" prop="semester">
        <el-input v-model="form.semester" placeholder="如 2024-1" clearable />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" :loading="loading" @click="onQuery">查询链上成绩</el-button>
        <el-button :disabled="!record" @click="goHistory">查看链上历史</el-button>
      </el-form-item>
    </el-form>

    <el-card v-if="record" shadow="never" class="border border-slate-700/50 bg-slate-950/40">
      <template #header>
        <div class="flex flex-wrap items-center justify-between gap-3">
          <span>当前链上记录</span>
          <div class="flex flex-wrap gap-2">
            <el-button type="primary" plain size="small" @click="exportTranscriptPdf">导出 PDF 成绩单</el-button>
            <el-button size="small" @click="openVerifyFromQrLink">新窗口打开验真页</el-button>
          </div>
        </div>
      </template>
      <div class="flex flex-col gap-6 lg:flex-row lg:items-start">
        <el-descriptions class="min-w-0 flex-1" :column="1" border>
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
          <el-descriptions-item v-if="latestTxId" label="最新交易 ID">
            <code class="break-all text-xs text-cyan-200/90">{{ latestTxId }}</code>
          </el-descriptions-item>
        </el-descriptions>
        <div
          v-if="verifyQrSrc"
          class="flex shrink-0 flex-col items-center rounded-xl border border-cyan-500/20 bg-slate-900/50 p-4"
        >
          <div class="mb-2 text-center text-[11px] font-medium text-cyan-200/80">扫码验真（自动填表）</div>
          <img :src="verifyQrSrc" alt="验真链接二维码" class="h-40 w-40 rounded-lg bg-white p-1.5" />
          <p class="mt-2 max-w-[200px] text-center text-[10px] leading-snug text-slate-500">
            手机扫描后打开验真页并携带链上分数与交易 ID
          </p>
        </div>
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.form {
  max-width: 520px;
}
</style>
