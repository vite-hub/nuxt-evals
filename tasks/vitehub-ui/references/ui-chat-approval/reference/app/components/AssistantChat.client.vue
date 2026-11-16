<!-- Client only: in a Nuxt 5 production build, ViteHub UI's chat parts pull Nuxt UI's editor into the server bundle,
     and `nuxt build` fails with "Vue app aliases are not allowed in server runtime". -->
<script setup lang="ts">
import { Chat as AiChat } from "@ai-sdk/vue"
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithApprovalResponses, type ToolUIPart } from "ai"

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
