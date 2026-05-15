<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useRouter, RouterLink } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { fetchHealth } from '../api/score';
import { apiRegister, type AppRole } from '../api/authApi';
import LoginHexBackground from '../components/decorative/LoginHexBackground.vue';

const router = useRouter();

const form = reactive({
  username: '',
  password: '',
  displayName: '',
  role: 'Student' as AppRole,
  inviteCode: '',
});

const loading = ref(false);
const healthHint = ref('');
const enrollStep = ref(0);
const enrollLabel = ref('');

const roleOptions: { value: AppRole; label: string; hint: string }[] = [
  { value: 'Student', label: '学生（Org2 · 读 / 溯源）', hint: 'Org2MSP' },
  { value: 'DepartmentTeacher', label: '院系教师（Org1 · 写）', hint: 'Org1MSP' },
  { value: 'ExternalVerifier', label: '用人单位 / 外部核验（Org2）', hint: 'Org2MSP' },
  { value: 'Academic_Affairs', label: '教务处（Org1 · 全域）', hint: '须邀请码' },
];

const showInvite = computed(() => form.role === 'Academic_Affairs');

const DEMO_MNEMONIC =
  'fabric · score · chain · edu · enroll · campus · ledger · gateway · abac · verify · merit · demo';

async function pingHealth() {
  try {
    const h = await fetchHealth();
    healthHint.value = h.fabricConfigured ? '后端与 Fabric 自检通过' : '后端在线，Fabric 未配置';
  } catch {
    healthHint.value = '无法连接后端，请检查 VITE_API_BASE 与后端是否启动';
  }
}

void pingHealth();

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function runEnrollPhases() {
  enrollStep.value = 1;
  enrollLabel.value = '正在向 Fabric CA 提交注册请求（演示）…';
  await sleep(520);
  enrollStep.value = 2;
  enrollLabel.value = '生成密钥对并签发 X.509 身份凭证（演示动画）…';
  await sleep(620);
  enrollStep.value = 3;
  enrollLabel.value = '登记组织 MSP 与 ABAC 属性映射…';
  await sleep(480);
}

async function onSubmit() {
  if (loading.value) return;
  loading.value = true;
  enrollStep.value = 0;
  enrollLabel.value = '';
  try {
    await runEnrollPhases();
    const payload = {
      username: form.username.trim(),
      password: form.password,
      displayName: form.displayName.trim(),
      role: form.role,
      ...(showInvite.value && form.inviteCode.trim()
        ? { inviteCode: form.inviteCode.trim() }
        : {}),
    };
    const res = await apiRegister(payload);
    ElMessage.success(res.message || '注册成功');
    enrollStep.value = 4;
    enrollLabel.value = '身份已写入演示会话，可返回登录';

    try {
      await ElMessageBox.alert(
        `以下为演示用助记词备份（不等同真实链上私钥）。答辩可说明生产环境由 Fabric CA 与 HSM 托管真实证书材料。\n\n${DEMO_MNEMONIC}`,
        '备份提示（演示）',
        { confirmButtonText: '去登录' },
      );
    } catch {
      /* 用户关闭弹窗 */
    }
    await router.replace('/login');
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '注册失败');
  } finally {
    loading.value = false;
    enrollStep.value = 0;
    enrollLabel.value = '';
  }
}
</script>

<template>
  <div
    class="relative flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_center,#1a1c2c_0%,#0d0e17_100%)] px-4 py-12 text-slate-200"
  >
    <LoginHexBackground />
    <div
      class="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(ellipse_at_top,_rgba(99,102,241,0.14),_transparent_55%),radial-gradient(ellipse_at_bottom,_rgba(34,211,238,0.1),_transparent_50%)]"
    />
    <div
      class="pointer-events-none absolute -left-24 top-1/3 z-[1] h-72 w-72 rounded-full bg-indigo-500/10 blur-3xl"
    />
    <div
      class="pointer-events-none absolute -right-20 bottom-1/4 z-[1] h-80 w-80 rounded-full bg-cyan-500/10 blur-3xl"
    />

    <div class="relative z-10 w-full max-w-lg">
      <div class="mb-8 text-center">
        <div class="text-xs font-medium uppercase tracking-[0.35em] text-indigo-300/90">Identity Mint</div>
        <h1 class="mt-2 text-2xl font-semibold tracking-tight text-white">链上身份注册（演示）</h1>
        <p class="mt-2 text-sm text-slate-400">
          登录是「验证」；注册是「铸造」——本页模拟向 CA 登记并获得组织 / 角色。数据仅存后端内存，进程重启即清空。
        </p>
        <p v-if="healthHint" class="mt-2 text-xs" :class="healthHint.includes('无法') ? 'text-amber-400/90' : 'text-emerald-400/80'">
          {{ healthHint }}
        </p>
      </div>

      <div
        class="rounded-2xl border border-indigo-500/20 bg-slate-950/55 p-8 shadow-2xl shadow-black/40 backdrop-blur-xl"
      >
        <div
          v-if="loading && enrollStep > 0 && enrollStep < 4"
          class="mb-4 rounded-xl border border-cyan-500/20 bg-slate-900/50 px-4 py-3 text-xs text-cyan-100/90"
        >
          <div class="font-medium text-cyan-200/95">CA 登记流程（演示）</div>
          <div class="mt-2 space-y-1.5 text-slate-400">
            <div :class="enrollStep >= 1 ? 'text-slate-200' : ''">① {{ enrollStep >= 1 ? '✓' : '…' }} 提交 register</div>
            <div :class="enrollStep >= 2 ? 'text-slate-200' : ''">② {{ enrollStep >= 2 ? '✓' : '…' }} enroll 签发证书</div>
            <div :class="enrollStep >= 3 ? 'text-slate-200' : ''">③ {{ enrollStep >= 3 ? '✓' : '…' }} MSP / ABAC 映射</div>
          </div>
          <div class="mt-2 text-[11px] text-cyan-200/80">{{ enrollLabel }}</div>
        </div>

        <el-form :model="form" label-position="top" class="space-y-1" @submit.prevent="onSubmit">
          <el-form-item label="用户名（4～24 位字母数字下划线）">
            <el-input v-model="form.username" autocomplete="username" size="large" clearable placeholder="如 new_student" />
          </el-form-item>
          <el-form-item label="密码（至少 6 位）">
            <el-input
              v-model="form.password"
              type="password"
              autocomplete="new-password"
              size="large"
              show-password
            />
          </el-form-item>
          <el-form-item label="显示名称">
            <el-input v-model="form.displayName" maxlength="32" show-word-limit size="large" clearable placeholder="如 王同学" />
          </el-form-item>
          <el-form-item label="角色与组织归属">
            <el-select v-model="form.role" class="w-full" size="large">
              <el-option v-for="o in roleOptions" :key="o.value" :label="o.label" :value="o.value">
                <div class="flex flex-col py-0.5">
                  <span>{{ o.label }}</span>
                  <span class="text-[11px] text-slate-500">{{ o.hint }}</span>
                </div>
              </el-option>
            </el-select>
          </el-form-item>
          <el-form-item v-if="showInvite" label="教务处邀请码">
            <el-input
              v-model="form.inviteCode"
              size="large"
              clearable
              show-password
              placeholder="默认 CHAIN-EDU-2026，可由 DEMO_REGISTRATION_INVITE 覆盖"
            />
            <template #extra>
              <span class="text-[11px] text-slate-500">模拟「教务处授权」；与后端环境变量或默认值一致方可通过。</span>
            </template>
          </el-form-item>
          <el-button type="primary" class="mt-2 w-full" size="large" :loading="loading" @click="onSubmit">
            提交注册（演示 CA）
          </el-button>
        </el-form>

        <p class="mt-6 text-center text-sm text-slate-500">
          已有账号？
          <RouterLink to="/login" class="text-cyan-400 hover:text-cyan-300">返回登录</RouterLink>
        </p>
      </div>
    </div>
  </div>
</template>
