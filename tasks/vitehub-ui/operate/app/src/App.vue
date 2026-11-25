<script setup lang="ts">
import InviteForm from "./InviteForm.vue"
import ProjectSettings from "./ProjectSettings.vue"

const page = location.pathname.startsWith("/invite") ? "invite" : "settings"
</script>

<template>
  <header>
    <strong>Acme Console</strong>
    <nav aria-label="Main">
      <a href="/settings">Project settings</a>
      <a href="/invite">Invite a teammate</a>
    </nav>
  </header>
  <main>
    <ProjectSettings v-if="page === 'settings'" />
    <InviteForm v-else />
  </main>
</template>
