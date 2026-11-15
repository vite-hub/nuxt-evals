<template>
  <div class="page">
    <NuxtPage />
  </div>
</template>

<style>
body { font-family: system-ui, sans-serif; margin: 0; color: #1f2328; background: #fafafa; }
.page { max-width: 40rem; margin: 0 auto; padding: 2rem 1rem; }
header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 1.5rem; }
form { display: grid; gap: 0.5rem; margin: 1.5rem 0; }
input, textarea, button { font: inherit; padding: 0.5rem; }
ul { padding: 0; list-style: none; }
li { padding: 0.75rem 0; border-bottom: 1px solid #ddd; }
.error { color: #b42318; }
</style>
