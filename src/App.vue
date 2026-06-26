<template>
  <div id="app-wrapper">
    <main class="main-content">
      <router-view />
    </main>
  </div>
</template>

<script setup>
// 根组件，仅承载 router-view
</script>

<style scoped>
.main-content {
  min-height: 100vh;
}
</style>
