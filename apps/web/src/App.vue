<script setup lang="ts">
import { ref, useTemplateRef, watch } from 'vue'
import { useRoute } from 'vue-router'
import ConnectionBadge from '@/components/ConnectionBadge.vue'
import ToastHost from '@/components/ToastHost.vue'
import { useLiveStream } from '@/composables/useLiveStream.ts'
import { useTheme } from '@/composables/useUiPrefs.ts'
import { useConnectionStore } from '@/stores/connection.ts'
import { useLiveStore } from '@/stores/live.ts'

const conn = useConnectionStore()
const live = useLiveStore()
const { theme, toggle } = useTheme()
const route = useRoute()
const navOpen = ref(false)
const mainEl = useTemplateRef<HTMLElement>('main')

useLiveStream()

watch(
  () => route.fullPath,
  () => (navOpen.value = false),
)

const links = [
  { to: '/', label: '總覽', icon: '▦' },
  { to: '/history', label: '歷史查詢', icon: '☰' },
  { to: '/alerts', label: '告警中心', icon: '⚠' },
  { to: '/lab/array', label: '陣列方法實驗室', icon: '[ ]' },
  { to: '/about', label: '架構說明', icon: 'ⓘ' },
]
</script>

<template>
  <!-- Hash routing owns the URL fragment, so focus <main> instead of linking to #main. -->
  <a class="skip" href="#" @click.prevent="mainEl?.focus()">跳到主要內容</a>
  <div class="layout" :class="{ 'nav-open': navOpen }">
    <aside class="sidebar" aria-label="主選單">
      <div class="brand">
        <span class="logo" aria-hidden="true">◢</span>
        <div>
          <strong>AIoT Monitor</strong>
          <small>AIoT Monitor</small>
        </div>
      </div>
      <nav>
        <RouterLink
          v-for="link in links"
          :key="link.to"
          :to="link.to"
          class="nav-link"
          :exact-active-class="link.to === '/' ? 'active' : ''"
          :active-class="link.to === '/' ? '' : 'active'"
        >
          <span aria-hidden="true" class="nav-icon">{{ link.icon }}</span>
          {{ link.label }}
          <span
            v-if="link.to === '/alerts' && live.openAlerts > 0"
            class="count"
            :aria-label="`${live.openAlerts} 筆未處理`"
          >
            {{ live.openAlerts > 99 ? '99+' : live.openAlerts }}
          </span>
        </RouterLink>
      </nav>
      <p class="data-note">
        資料{{
          conn.isMock
            ? '由瀏覽器內模擬器產生（僅存在記憶體）'
            : '存放於後端 SQLite（apps/api/data/aiot.db）'
        }}
      </p>
    </aside>

    <div class="main-col">
      <header class="topbar">
        <button
          type="button"
          class="btn btn-sm menu-btn"
          :aria-expanded="navOpen"
          aria-label="開關選單"
          @click="navOpen = !navOpen"
        >
          ☰
        </button>
        <div class="spacer" />
        <ConnectionBadge />
        <button
          type="button"
          class="btn btn-sm"
          :aria-label="theme === 'dark' ? '切換為淺色主題' : '切換為深色主題'"
          @click="toggle"
        >
          {{ theme === 'dark' ? '☀ 淺色' : '☾ 深色' }}
        </button>
      </header>

      <div v-if="!conn.isMock && conn.health === 'down'" class="banner" role="alert">
        <span>
          無法連線到 API（{{ conn.healthError }}）。請執行
          <code>npm run dev</code> 啟動後端，或改用瀏覽器內的模擬資料。
        </span>
        <span class="banner-actions">
          <button type="button" class="btn btn-sm" @click="conn.checkHealth()">重新檢查</button>
          <button type="button" class="btn btn-sm btn-primary" @click="conn.switchMode('mock')">
            切換為模擬資料
          </button>
        </span>
      </div>

      <main id="main" ref="main" tabindex="-1">
        <RouterView :key="`${conn.mode}:${route.path}`" />
      </main>
    </div>
  </div>
  <ToastHost />
</template>

<style scoped>
.skip {
  position: absolute;
  left: -999px;
  top: 0;
  z-index: 100;
  padding: 0.5rem 1rem;
  background: var(--color-primary);
  color: #fff;
}
.skip:focus {
  left: 0.5rem;
}
.layout {
  display: grid;
  grid-template-columns: var(--sidebar-width) 1fr;
  min-height: 100vh;
}
.sidebar {
  position: sticky;
  top: 0;
  height: 100vh;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem 0.75rem;
  background: var(--color-surface);
  border-right: 1px solid var(--color-border);
}
.brand {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0 0.4rem;
}
.brand small {
  display: block;
  color: var(--color-text-muted);
  font-size: 0.72rem;
}
.logo {
  display: grid;
  place-items: center;
  width: 2rem;
  height: 2rem;
  border-radius: 8px;
  background: var(--color-primary);
  color: #fff;
}
nav {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}
.nav-link {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.5rem 0.6rem;
  border-radius: 8px;
  color: var(--color-text);
  text-decoration: none;
  font-size: 0.92rem;
}
.nav-link:hover {
  background: var(--color-surface-2);
}
.nav-link.active {
  background: var(--color-primary-soft);
  color: var(--color-primary);
  font-weight: 600;
}
.nav-icon {
  width: 1.4rem;
  text-align: center;
  font-size: 0.85rem;
}
.count {
  margin-left: auto;
  min-width: 1.4rem;
  padding: 0 0.35rem;
  border-radius: 999px;
  background: var(--color-alarm);
  color: #fff;
  font-size: 0.72rem;
  text-align: center;
}
.data-note {
  margin-top: auto;
  padding: 0 0.4rem;
  font-size: 0.72rem;
  color: var(--color-text-muted);
}
.main-col {
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.topbar {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 1.25rem;
  background: color-mix(in srgb, var(--color-bg) 85%, transparent);
  backdrop-filter: blur(6px);
  border-bottom: 1px solid var(--color-border);
}
.spacer {
  flex: 1;
}
.menu-btn {
  display: none;
}
.banner {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin: 1rem 1.25rem 0;
  padding: 0.75rem 1rem;
  border: 1px solid var(--color-warn);
  border-radius: var(--radius);
  background: color-mix(in srgb, var(--color-warn) 10%, var(--color-surface));
  font-size: 0.9rem;
}
.banner-actions {
  display: flex;
  gap: 0.4rem;
}
main {
  padding: 1.25rem;
  outline: none;
}

@media (max-width: 860px) {
  .layout {
    grid-template-columns: 1fr;
  }
  .sidebar {
    position: fixed;
    z-index: 20;
    left: 0;
    width: var(--sidebar-width);
    transform: translateX(-100%);
    transition: transform 0.2s;
    box-shadow: var(--shadow-lg);
  }
  .nav-open .sidebar {
    transform: none;
  }
  .menu-btn {
    display: inline-flex;
  }
  main {
    padding: 1rem 0.75rem;
  }
  .topbar {
    padding: 0.5rem 0.75rem;
  }
}
</style>
