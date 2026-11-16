<script setup lang="ts">
// The tempting wrong form: a hand-made message list and a window.confirm on the client. The model never hears a denial.
import { Chat as AiChat } from "@ai-sdk/vue"
import { DefaultChatTransport } from "ai"

const chat = new AiChat({ transport: new DefaultChatTransport({ api: "/api/chat" }) })
const draft = ref("")
</script>

<template>
  <div>
    <div v-for="message in chat.messages" :key="message.id">
      <p v-for="(part, index) in message.parts" :key="index">
        {{ part.type === "text" ? part.text : "" }}
      </p>
    </div>
    <form @submit.prevent="chat.sendMessage({ text: draft }); draft = ''">
      <input v-model="draft" aria-label="Message">
    </form>
  </div>
</template>
