<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, RouterLink } from 'vue-router';
import { currentRole, type DemoRole } from './stores/role';

const route = useRoute();

const roleLabel: Record<DemoRole, string> = {
  admin: '教务处',
  teacher: '教师',
  student: '学生',
  third: '第三方',
};

const roleOptions: { value: DemoRole; label: string }[] = [
  { value: 'admin', label: '教务处' },
  { value: 'teacher', label: '教师' },
  { value: 'student', label: '学生' },
  { value: 'third', label: '第三方（用人单位验真）' },
];

const isThird = computed(() => currentRole.value === 'third');
const isStudent = computed(() => currentRole.value === 'student');
const canWrite = computed(
  () => currentRole.value === 'admin' || currentRole.value === 'teacher',
);

const breadcrumbs = computed(() =>
  route.matched
    .filter((m) => m.meta?.title)
    .map((m) => String(m.meta.title)),
);

const nav = computed(() => {
  const items: { to: string; label: string; show: boolean }[] = [
    { to: '/dashboard', label: '综合看板', show: true },
    { to: '/explorer', label: '链上浏览器', show: true },
    { to: '/scores', label: '成绩查询', show: !isThird.value },
    { to: '/scores/history', label: '全链路溯源', show: !isThird.value },
    { to: '/scores/new', label: '录入上链', show: canWrite.value },
    { to: '/scores/correct', label: '成绩更正', show: canWrite.value },
    { to: '/scores/revoke', label: '成绩作废', show: canWrite.value },
    { to: '/verify', label: '验真与凭证', show: !isStudent.value },
  ];
  return items.filter((i) => i.show);
});
</script>

<template>
  <div class="flex min-h-screen bg-[#0b1220] text-slate-200">
    <aside
      class="flex w-60 shrink-0 flex-col border-r border-cyan-500/10 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 shadow-[inset_-1px_0_0_rgba(34,211,238,0.06)]"
    >
      <div class="border-b border-slate-700/60 px-4 py-5">
        <div class="text-xs font-medium uppercase tracking-[0.2em] text-cyan-400/90">Fabric Console</div>
        <div class="mt-1 text-lg font-semibold text-white">成绩链上存证</div>
        <div class="mt-2 text-[11px] leading-relaxed text-slate-500">
          联盟链管理后台 · 将账本状态与交易语义可视化
        </div>
      </div>
      <nav class="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2">
        <RouterLink
          v-for="item in nav"
          :key="item.to"
          v-slot="{ isActive, href, navigate }"
          :to="item.to"
          custom
        >
          <a
            :href="href"
            class="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm transition"
            :class="
              isActive
                ? 'bg-cyan-500/15 text-cyan-100 shadow-glow ring-1 ring-cyan-500/30'
                : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-100'
            "
            @click="(e) => navigate(e)"
          >
            <span
              class="h-1.5 w-1.5 shrink-0 rounded-full"
              :class="isActive ? 'bg-cyan-400 shadow-[0_0_8px_#22d3ee]' : 'bg-slate-600'"
            />
            {{ item.label }}
          </a>
        </RouterLink>
      </nav>
      <div class="border-t border-slate-700/60 p-3 text-[10px] leading-snug text-slate-600">
        演示角色仅影响菜单与写权限；链上身份以 Gateway 固定 Org1 为准。
      </div>
    </aside>

    <div class="flex min-w-0 flex-1 flex-col">
      <header
        class="flex h-14 shrink-0 items-center justify-between border-b border-slate-700/60 bg-slate-950/80 px-6 backdrop-blur"
      >
        <div class="flex min-w-0 flex-col gap-0.5">
          <el-breadcrumb separator="/">
            <el-breadcrumb-item v-for="(t, i) in breadcrumbs" :key="i">{{ t }}</el-breadcrumb-item>
          </el-breadcrumb>
          <span class="truncate text-xs text-slate-500">{{ route.path }}</span>
        </div>
        <div class="flex shrink-0 items-center gap-4">
          <div class="hidden text-right text-xs leading-tight text-slate-500 sm:block">
            <div class="text-slate-300">当前身份</div>
            <div class="font-medium text-cyan-200/90">{{ roleLabel[currentRole] }}</div>
          </div>
          <el-select
            v-model="currentRole"
            class="role-select w-[200px]"
            size="default"
            placeholder="切换角色"
          >
            <el-option
              v-for="opt in roleOptions"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </div>
      </header>

      <main class="flex-1 overflow-auto p-4 sm:p-6">
        <div
          class="min-h-[calc(100vh-5.5rem)] rounded-2xl border border-slate-700/50 bg-slate-900/40 p-5 shadow-xl shadow-black/20 backdrop-blur-sm sm:p-8"
        >
          <router-view v-slot="{ Component }">
            <transition name="fade" mode="out-in">
              <component :is="Component" />
            </transition>
          </router-view>
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
.role-select :deep(.el-input__wrapper) {
  background-color: rgba(15, 23, 42, 0.9);
  box-shadow: 0 0 0 1px rgba(34, 211, 238, 0.25);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.18s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
