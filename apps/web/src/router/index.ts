import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'

export const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'overview',
    component: () => import('@/views/OverviewView.vue'),
    meta: { title: '總覽' },
  },
  {
    path: '/machines/:id',
    name: 'machine',
    component: () => import('@/views/MachineDetailView.vue'),
    props: true,
    meta: { title: '機台詳情' },
  },
  {
    path: '/history',
    name: 'history',
    component: () => import('@/views/HistoryView.vue'),
    meta: { title: '歷史查詢' },
  },
  {
    path: '/alerts',
    name: 'alerts',
    component: () => import('@/views/AlertsView.vue'),
    meta: { title: '告警中心' },
  },
  {
    path: '/lab/array',
    name: 'array-lab',
    component: () => import('@/views/ArrayLabView.vue'),
    meta: { title: '陣列方法實驗室' },
  },
  {
    path: '/about',
    name: 'about',
    component: () => import('@/views/AboutView.vue'),
    meta: { title: '架構說明' },
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/views/NotFoundView.vue'),
    meta: { title: '找不到頁面' },
  },
]

declare module 'vue-router' {
  interface RouteMeta {
    title?: string
  }
}

export function createAppRouter() {
  // Hash history works on any static host and sub-path without server rewrites.
  const router = createRouter({
    history: createWebHashHistory(import.meta.env.BASE_URL),
    routes,
    // New page starts at the top; query-only changes (filters, paging) keep the position.
    scrollBehavior: (to, from, saved) => saved ?? (to.path === from.path ? false : { top: 0 }),
  })
  router.afterEach((to) => {
    document.title = `${to.meta.title ?? ''}｜機台戰情室`
  })
  return router
}
