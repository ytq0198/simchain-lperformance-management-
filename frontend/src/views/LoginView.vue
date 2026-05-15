<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { fetchHealth } from '../api/score';
import { login } from '../stores/auth';

const route = useRoute();
const router = useRouter();

const form = reactive({
  username: 'jiaowuchu',
  password: 'demo',
});

const loading = ref(false);
const healthHint = ref('');

async function pingHealth() {
  try {
    const h = await fetchHealth();
    healthHint.value = h.fabricConfigured ? '后端与 Fabric 自检通过' : '后端在线，Fabric 未配置';
  } catch {
    healthHint.value = '无法连接后端，请检查 VITE_API_BASE 与后端是否启动';
  }
}

void pingHealth();

async function onSubmit() {
  loading.value = true;
  try {
    await login(form.username.trim(), form.password);
    ElMessage.success('登录成功');
    const redir = typeof route.query.redirect === 'string' ? route.query.redirect : '';
    await router.replace(redir && redir !== '/login' ? redir : '/dashboard');
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '登录失败');
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div
    class="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#070b14] px-4 py-12 text-slate-200"
  >
    <div
      class="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(34,211,238,0.12),_transparent_55%),radial-gradient(ellipse_at_bottom,_rgba(99,102,241,0.08),_transparent_50%)]"
    />
    <div
      class="pointer-events-none absolute -left-24 top-1/4 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl"
    />
    <div
      class="pointer-events-none absolute -right-20 bottom-1/4 h-80 w-80 rounded-full bg-indigo-500/10 blur-3xl"
    />

    <div class="relative w-full max-w-md">
      <div class="mb-8 text-center">
        <div class="text-xs font-medium uppercase tracking-[0.35em] text-cyan-400/90">Hyperledger Fabric</div>
        <h1 class="mt-2 text-2xl font-semibold tracking-tight text-white">成绩链上存证</h1>
        <p class="mt-2 text-sm text-slate-400">登录后由 JWT 分发权限；写操作走 Org1 证书，学生/验真走 Org2 证书</p>
        <p v-if="healthHint" class="mt-2 text-xs" :class="healthHint.includes('无法') ? 'text-amber-400/90' : 'text-emerald-400/80'">
          {{ healthHint }}
        </p>
      </div>

      <div
        class="rounded-2xl border border-cyan-500/15 bg-slate-950/70 p-8 shadow-2xl shadow-black/40 backdrop-blur-md"
      >
        <el-form :model="form" label-position="top" class="space-y-1" @submit.prevent="onSubmit">
          <el-form-item label="用户名">
            <el-input v-model="form.username" autocomplete="username" size="large" clearable />
          </el-form-item>
          <el-form-item label="密码">
            <el-input
              v-model="form.password"
              type="password"
              autocomplete="current-password"
              size="large"
              show-password
              @keyup.enter="onSubmit"
            />
          </el-form-item>
          <el-button type="primary" class="mt-2 w-full" size="large" :loading="loading" @click="onSubmit">
            登录
          </el-button>
        </el-form>

        <div class="mt-6 rounded-lg border border-slate-700/50 bg-slate-900/50 p-3 text-[11px] leading-relaxed text-slate-500">
          <div class="mb-1 font-medium text-slate-400">演示账号（密码均为 demo）</div>
          <ul class="list-inside list-disc space-y-0.5 font-mono text-[10px] text-slate-400">
            <li>jiaowuchu — 教务处（Org1 · 写 + 验真）</li>
            <li>teacher01 — 教师（Org1 · 写）</li>
            <li>student01 — 学生（Org2 · 读 / 溯源 / 我的证书）</li>
            <li>hr001 — 用人单位（Org2 · 验真 + 链上浏览器）</li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>
