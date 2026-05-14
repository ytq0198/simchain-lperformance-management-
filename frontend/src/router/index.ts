import { createRouter, createWebHistory } from 'vue-router';
import { ElMessage } from 'element-plus';
import { canWriteScores } from '../stores/role';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
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
      path: '/scores/new',
      name: 'scores-new',
      component: () => import('../views/ScoreNewView.vue'),
      meta: { title: '录入上链', requiresWrite: true },
    },
    {
      path: '/scores/correct',
      name: 'scores-correct',
      component: () => import('../views/ScoreCorrectView.vue'),
      meta: { title: '成绩更正', requiresWrite: true },
    },
    {
      path: '/scores/revoke',
      name: 'scores-revoke',
      component: () => import('../views/ScoreRevokeView.vue'),
      meta: { title: '成绩作废', requiresWrite: true },
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
  if (to.meta.requiresWrite && !canWriteScores()) {
    ElMessage.warning('当前角色无写权限，请切换为教务处或教师');
    return { path: '/scores' };
  }
});

router.afterEach((to) => {
  document.title = `${String(to.meta.title ?? '页面')} · 成绩链上存证`;
});

export default router;
