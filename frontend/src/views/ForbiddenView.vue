<script setup lang="ts">
import { useRouter } from 'vue-router';
import { authUser, roleLabel } from '../stores/auth';

const router = useRouter();
</script>

<template>
  <div class="mx-auto max-w-lg space-y-6 text-center">
    <div class="text-6xl font-light text-rose-400/90">403</div>
    <h1 class="text-xl font-semibold text-white">无权访问该功能</h1>
    <p class="text-sm text-slate-400">
      当前身份为「{{ roleLabel(authUser?.role) }}」，此路由需要更高权限或不同组织证书。写操作在链码层亦校验 Org1MSP（答辩可演示学生账号调写入接口被双重拒绝）。
    </p>
    <div class="flex flex-wrap justify-center gap-3">
      <el-button type="primary" @click="router.replace('/dashboard')">返回看板</el-button>
      <el-button @click="router.replace('/login')">重新登录</el-button>
    </div>
  </div>
</template>
