<template>
  <div class="shell">
    <header class="header">
      <div class="container header-row">
        <NuxtLink to="/" class="brand">
          Acme Console
        </NuxtLink>
        <nav aria-label="Main" class="nav">
          <NuxtLink to="/">
            Projects
          </NuxtLink>
        </nav>
      </div>
    </header>
    <main class="container main">
      <slot />
    </main>
  </div>
</template>
