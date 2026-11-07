<template>
  <div class="min-h-screen">
    <header class="border-b border-default">
      <UContainer class="flex h-14 items-center justify-between">
        <NuxtLink to="/" class="font-semibold">
          Meetups
        </NuxtLink>
        <nav class="flex items-center gap-1">
          <UButton to="/events" variant="ghost" color="neutral" label="Events" />
          <UButton to="/dashboard" variant="ghost" color="neutral" label="Dashboard" />
          <UButton to="/login" variant="ghost" color="neutral" label="Sign in" />
        </nav>
      </UContainer>
    </header>
    <UContainer as="main" class="py-8">
      <slot />
    </UContainer>
  </div>
</template>
