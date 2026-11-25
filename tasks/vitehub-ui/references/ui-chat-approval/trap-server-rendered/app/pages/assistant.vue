<script setup lang="ts">
// The same chat as the reference, rendered on the server too. A right form, but today's ViteHub UI fails `nuxt build`
// with it: its parts pull Nuxt UI's editor into the server bundle.
import { Chat as AiChat } from "@ai-sdk/vue"
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithApprovalResponses, type ToolUIPart } from "ai"

useHead({ title: "Assistant" })

const chat = new AiChat({
  transport: new DefaultChatTransport({ api: "/api/chat" }),
  sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
})
const draft = ref("")

function send({ text }: { text: string }) {
  chat.sendMessage({ text })
  draft.value = ""
}

function slugOf(part: ToolUIPart): string {
  return (part.input as { slug?: string } | undefined)?.slug ?? "this project"
}
</script>

<template>
  <Chat :messages="chat.messages" :status="chat.status">
    <template #tool="{ part }">
      <div v-if="(part as ToolUIPart).state === 'approval-requested'" role="group" :aria-label="`Approve archiving ${slugOf(part as ToolUIPart)}`" class="space-y-2 rounded-md border border-default p-3">
        <p>Archive <strong>{{ slugOf(part as ToolUIPart) }}</strong>? It leaves the project list.</p>
        <div class="flex gap-2">
          <UButton label="Approve" @click="chat.addToolApprovalResponse({ id: (part as ToolUIPart).approval!.id, approved: true })" />
          <UButton label="Deny" color="neutral" variant="outline" @click="chat.addToolApprovalResponse({ id: (part as ToolUIPart).approval!.id, approved: false })" />
        </div>
      </div>
    </template>
    <template #composer>
      <PromptInput v-model="draft" :status="chat.status" aria-label="Message the assistant" @submit="send" @stop="chat.stop()" />
    </template>
  </Chat>
</template>
