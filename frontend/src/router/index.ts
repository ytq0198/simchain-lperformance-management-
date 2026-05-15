import { createRouter, createWebHistory } from 'vue-router';
import { ElMessage } from 'element-plus';
import type { AppRole } from '../api/authApi';
import { authToken, authUser, canWriteScores, isExternalVerifier, isStudent } from '../stores/auth';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue'),
      meta: { title: '登录', public: true },
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('../views/RegisterView.vue'),
      meta: { title: '身份注册', public: true },
    },
    {
      path: '/forbidden',
      name: 'forbidden',
      component: () => import('../views/ForbiddenView.vue'),
      meta: { title: '无权访问' },
    },
    { path: '/', redirect: '/dashboard' },
    {
      path: '/dashboard',
      name: 'dashboard',
      component: () => import('../views/DashboardView.vue'),
      meta: { title: '综合看板' },
    },
    {
      path: '/explorer',
      name: 'explorer',
      component: () => import('../views/ExplorerView.vue'),
      meta: { title: '链上浏览器' },
    },
    {
      path: '/scores',
      name: 'scores',
      component: () => import('../views/ScoreQueryView.vue'),
      meta: { title: '成绩查询' },
    },
    {
      path: '/scores/history',
      name: 'scores-history',
      component: () => import('../views/ScoreHistoryView.vue'),
      meta: { title: '全链路溯源' },
    },
    {
      path: '/my-certificates',
      name: 'my-certificates',
      component: () => import('../views/MyCertificatesView.vue'),
      meta: { title: '我的证书', roles: ['Student'] },
    },
    {
      path: '/scores/new',
      name: 'scores-new',
      component: () => import('../views/ScoreNewView.vue'),
      meta: {
        title: '录入上链',
        requiresWrite: true,
        roles: ['Academic_Affairs', 'DepartmentTeacher'],
      },
    },
    {
      path: '/scores/correct',
      name: 'scores-correct',
      component: () => import('../views/ScoreCorrectView.vue'),
      meta: {
        title: '成绩更正',
        requiresWrite: true,
        roles: ['Academic_Affairs', 'DepartmentTeacher'],
      },
    },
    {
      path: '/scores/revoke',
      name: 'scores-revoke',
      component: () => import('../views/ScoreRevokeView.vue'),
      meta: {
        title: '成绩作废',
        requiresWrite: true,
        roles: ['Academic_Affairs', 'DepartmentTeacher'],
      },
    },
    {
      path: '/scores/approve',
      name: 'scores-approve',
      component: () => import('../views/ScoreApproveView.vue'),
      meta: {
        title: '成绩审核',
        roles: ['Academic_Affairs'],
      },
    },
    {
      path: '/appeals',
      name: 'appeals',
      component: () => import('../views/StudentAppealsView.vue'),
      meta: { title: '成绩申诉', roles: ['Student'] },
    },
    {
      path: '/appeals/inbox',
      name: 'appeals-inbox',
      component: () => import('../views/AppealsInboxView.vue'),
      meta: {
        title: '申诉处理',
        roles: ['Academic_Affairs', 'DepartmentTeacher'],
      },
    },
    {
      path: '/fabric-identity',
      name: 'fabric-identity',
      component: () => import('../views/FabricIdentityView.vue'),
      meta: { title: '链上身份' },
    },
    {
      path: '/verify',
      name: 'verify',
      component: () => import('../views/VerifyView.vue'),
      meta: { title: '验真与凭证' },
    },
  ],
});

router.beforeEach((to) => {
  if (to.meta.public) {
    if (authToken.value && (to.path === '/login' || to.path === '/register')) {
      return { path: '/dashboard' };
    }
    return true;
  }

  if (!authToken.value) {
    return { path: '/login', query: { redirect: to.fullPath } };
  }

  const role = authUser.value?.role;

  if (isStudent() && to.path === '/explorer') {
    return { path: '/dashboard' };
  }

  if (isExternalVerifier() && to.path !== '/verify' && to.path !== '/explorer' && to.path !== '/forbidden') {
    return { path: '/verify', query: to.query };
  }

  if (isStudent() && to.path === '/verify') {
    ElMessage.info('当前身份无验真入口，已跳转到成绩查询');
    return { path: '/scores' };
  }

  const metaRoles = to.meta.roles as AppRole[] | undefined;
  if (metaRoles?.length && role && !metaRoles.includes(role)) {
    return { path: '/forbidden' };
  }

  if (to.meta.requiresWrite && !canWriteScores.value) {
    ElMessage.warning('当前身份无链上写权限');
    return { path: '/forbidden' };
  }

  return true;
});

router.afterEach((to) => {
  document.title = `${String(to.meta.title ?? '页面')} · 成绩链上存证`;
});

export default router;
