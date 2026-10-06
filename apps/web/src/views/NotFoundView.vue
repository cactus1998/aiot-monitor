<template>
  <div class="card not-found">
    <h1>找不到頁面</h1>
    <p class="muted">網址可能有誤，或頁面已移除。</p>
    <RouterLink to="/">返回總覽</RouterLink>
  </div>
</template>

<style scoped>
.not-found {
  max-width: 480px;
  margin: 3rem auto;
  text-align: center;
}
</style>
