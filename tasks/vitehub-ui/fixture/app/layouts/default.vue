<template>
  <div class="min-h-screen">
    <header class="border-b border-default">
      <UContainer class="flex h-14 items-center justify-between">
        <NuxtLink to="/" class="font-semibold">
          Acme Console
        </NuxtLink>
        <nav aria-label="Main" class="flex items-center gap-1">
          <UButton to="/" variant="ghost" color="neutral" label="Projects" />
        </nav>
      </UContainer>
    </header>
    <UContainer as="main" class="py-8">
      <slot />
    </UContainer>
  </div>
</template>
