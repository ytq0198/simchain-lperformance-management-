<script setup lang="ts">
import { useRouter } from 'vue-router';

const router = useRouter();
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-xl font-semibold text-white sm:text-2xl">我的证书</h1>
      <p class="mt-1 text-sm text-slate-400">
        学生视图：在此汇总与成绩相关的链上能力入口。查询到成绩后可在「成绩查询」页导出 PDF、生成验真二维码（需用人单位账号扫码）。
      </p>
    </div>

    <div class="grid gap-4 sm:grid-cols-2">
      <button
        type="button"
        class="rounded-xl border border-slate-700/60 bg-slate-950/50 p-5 text-left transition hover:border-cyan-500/30"
        @click="router.push('/scores')"
      >
        <div class="text-sm font-medium text-cyan-200/90">成绩查询</div>
        <p class="mt-2 text-xs text-slate-500">按学号、课程、学期读取当前世界状态</p>
      </button>
      <button
        type="button"
        class="rounded-xl border border-slate-700/60 bg-slate-950/50 p-5 text-left transition hover:border-cyan-500/30"
        @click="router.push('/scores/history')"
      >
        <div class="text-sm font-medium text-cyan-200/90">全链路溯源</div>
        <p class="mt-2 text-xs text-slate-500">查看该键的版本链与 Diff</p>
      </button>
    </div>

    <el-alert type="info" :closable="false" class="border border-slate-700/50 bg-slate-900/40" title="关于绩点与曲线">
      <template #default>
        <span class="text-xs text-slate-400">
          综合看板中的「个人学分 / 成绩波动」为演示占位；对接教务系统后可改为按学号聚合多门课程的真实统计。
        </span>
      </template>
    </el-alert>
  </div>
</template>
