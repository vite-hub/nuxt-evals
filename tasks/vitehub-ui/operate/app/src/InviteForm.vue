<script setup lang="ts">
import { Button } from "@ui-sdk/vue/button"
import { Checkbox, CheckboxIndicator } from "@ui-sdk/vue/checkbox"
import { DatePicker, DatePickerContent, DatePickerHint, DatePickerInput, DatePickerTrigger } from "@ui-sdk/vue/date-picker"
import { Field, FieldError, FieldLabel } from "@ui-sdk/vue/field"
import { Input } from "@ui-sdk/vue/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ui-sdk/vue/select"
import { Textarea } from "@ui-sdk/vue/textarea"
import { ref } from "vue"

const roles = [
  { value: "viewer", label: "Viewer" },
  { value: "developer", label: "Developer" },
  { value: "admin", label: "Admin" },
  { value: "billing", label: "Billing" },
]

const name = ref("")
const role = ref<string | null>(null)
const startDate = ref<string | null>(null)
const agreed = ref(false)
const note = ref("")
const status = ref("")
const problem = ref("")

async function submit() {
  problem.value = ""
  status.value = ""
  if (!name.value.trim() || !role.value || !startDate.value || !agreed.value) {
    problem.value = "Fill in every required field."
    return
  }
  const response = await fetch("/api/invites", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: name.value, role: role.value, startDate: startDate.value, agreed: agreed.value, note: note.value }),
  })
  if (!response.ok) {
    problem.value = "Could not send the invite."
    return
  }
  status.value = `Invite sent to ${name.value}`
  name.value = ""
  role.value = null
  startDate.value = null
  agreed.value = false
  note.value = ""
}
</script>

<template>
  <h1>Invite a teammate</h1>
  <form novalidate @submit.prevent="submit">
    <Field>
      <FieldLabel>Full name</FieldLabel>
      <Input v-model:value="name" required autocomplete="off" />
      <FieldError match="valueMissing">Enter a name.</FieldError>
    </Field>
    <Field>
      <FieldLabel>Role</FieldLabel>
      <Select v-model:value="role" :items="roles" placeholder="Choose a role" required>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem v-for="option in roles" :key="option.value" :value="option.value">{{ option.label }}</SelectItem>
        </SelectContent>
      </Select>
    </Field>
    <Field>
      <FieldLabel>Start date</FieldLabel>
      <DatePicker v-model:value="startDate" required>
        <DatePickerInput />
        <DatePickerTrigger>Calendar</DatePickerTrigger>
        <DatePickerHint />
        <DatePickerContent />
      </DatePicker>
    </Field>
    <Field>
      <label data-slot="label">
        <Checkbox v-model:checked="agreed" required>
          <CheckboxIndicator><span aria-hidden="true">✓</span></CheckboxIndicator>
        </Checkbox>
        They agreed to the security policy
      </label>
    </Field>
    <Field>
      <FieldLabel>Note for the invite email (optional)</FieldLabel>
      <Textarea v-model:value="note" />
    </Field>
    <Button type="submit">Send invite</Button>
    <p class="status" role="status">{{ status }}</p>
    <p v-if="problem" class="error" role="alert">{{ problem }}</p>
  </form>
</template>
