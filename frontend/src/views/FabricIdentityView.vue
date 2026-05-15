<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { fetchFabricIdentity } from '../api/score';

const loading = ref(false);
const info = ref<{
  profile: string;
  mspId: string;
  certPath: string;
  pemPreview: string;
  note: string;
} | null>(null);

onMounted(async () => {
  loading.value = true;
  try {
    info.value = await fetchFabricIdentity();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '加载失败');
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-xl font-semibold text-white sm:text-2xl">链上身份（证书摘要）</h1>
      <p class="mt-1 max-w-2xl text-sm text-slate-400">
        演示环境使用 <strong class="text-cyan-200/90">test-network</strong> 固定磁盘证书经 Gateway 签名；与 JWT 应用角色分离。此处<strong>仅展示签名证书 PEM 前几行</strong>，不暴露私钥。
      </p>
    </div>

    <el-skeleton v-if="loading" :rows="6" animated />
    <template v-else-if="info">
      <el-descriptions :column="1" border class="max-w-3xl">
        <el-descriptions-item label="Gateway 配置">{{ info.profile }}</el-descriptions-item>
        <el-descriptions-item label="MSP">{{ info.mspId }}</el-descriptions-item>
        <el-descriptions-item label="证书路径">
          <code class="break-all text-xs text-cyan-100/90">{{ info.certPath }}</code>
        </el-descriptions-item>
      </el-descriptions>
      <div class="text-xs font-medium text-slate-400">签名证书 PEM（截断）</div>
      <pre
        class="mt-1 max-h-[50vh] max-w-3xl overflow-auto rounded-lg border border-slate-700 bg-slate-950 p-4 text-xs leading-relaxed text-emerald-100/90"
      >{{ info.pemPreview }}</pre>
      <p class="max-w-3xl text-xs text-slate-500">{{ info.note }}</p>
    </template>
  </div>
</template>
