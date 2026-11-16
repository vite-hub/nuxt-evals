<script setup lang="ts">
import { Button } from "@ui-sdk/vue/button"
import { Field, FieldDescription, FieldLabel } from "@ui-sdk/vue/field"
import { Input } from "@ui-sdk/vue/input"
import { Radio, RadioGroup, RadioIndicator } from "@ui-sdk/vue/radio"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ui-sdk/vue/select"
import { Switch, SwitchThumb } from "@ui-sdk/vue/switch"
import { Textarea } from "@ui-sdk/vue/textarea"
import { onMounted, ref } from "vue"

interface Settings {
  name: string
  description: string
  region: string
  visibility: string
  autoDeploy: boolean
  previews: boolean
  emailOnFailure: boolean
  weeklyDigest: boolean
  slackAlerts: boolean
}

const regions = [
  { value: "iad", label: "Virginia (us-east-1)" },
  { value: "pdx", label: "Oregon (us-west-2)" },
  { value: "yul", label: "Montreal (ca-central-1)" },
  { value: "gru", label: "São Paulo (sa-east-1)" },
  { value: "dub", label: "Dublin (eu-west-1)" },
  { value: "lhr", label: "London (eu-west-2)" },
  { value: "cdg", label: "Paris (eu-west-3)" },
  { value: "fra", label: "Frankfurt (eu-central-1)" },
  { value: "arn", label: "Stockholm (eu-north-1)" },
  { value: "bom", label: "Mumbai (ap-south-1)" },
  { value: "sin", label: "Singapore (ap-southeast-1)" },
  { value: "nrt", label: "Tokyo (ap-northeast-1)" },
]
const visibilities = [
  { value: "private", label: "Private", description: "Only you" },
  { value: "team", label: "Team", description: "Everyone in Acme" },
  { value: "public", label: "Public", description: "Anyone with the link" },
]
const members = [
  { name: "Ada Lovelace", email: "ada@acme.dev", role: "Owner" },
  { name: "Grace Hopper", email: "grace@acme.dev", role: "Admin" },
  { name: "Alan Turing", email: "alan@acme.dev", role: "Developer" },
  { name: "Edsger Dijkstra", email: "edsger@acme.dev", role: "Viewer" },
]

const settings = ref<Settings>()
const status = ref("")

onMounted(async () => {
  settings.value = await (await fetch("/api/settings")).json() as Settings
})

async function save() {
  status.value = ""
  const response = await fetch("/api/settings", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(settings.value) })
  status.value = response.ok ? "Saved" : "Could not save"
}
</script>

<template>
  <h1>Project settings · Atlas</h1>
  <form v-if="settings" @submit.prevent="save">
    <section>
      <h2>General</h2>
      <Field>
        <FieldLabel>Project name</FieldLabel>
        <Input v-model:value="settings.name" />
      </Field>
      <Field>
        <FieldLabel>Description</FieldLabel>
        <Textarea v-model:value="settings.description" />
      </Field>
      <Field>
        <FieldLabel>Default region</FieldLabel>
        <FieldDescription>New deployments run here.</FieldDescription>
        <Select v-model:value="settings.region" :items="regions">
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="region in regions" :key="region.value" :value="region.value">{{ region.label }}</SelectItem>
          </SelectContent>
        </Select>
      </Field>
    </section>
    <section>
      <h2>Deployments</h2>
      <Field>
        <FieldLabel>Visibility</FieldLabel>
        <RadioGroup v-model:value="settings.visibility">
          <div v-for="option in visibilities" :key="option.value">
            <label data-slot="label">
              <Radio :value="option.value">
                <RadioIndicator />
              </Radio>
              {{ option.label }}
            </label>
            <small>{{ option.description }}</small>
          </div>
        </RadioGroup>
      </Field>
      <Field>
        <FieldLabel>Auto-deploy main</FieldLabel>
        <Switch v-model:checked="settings.autoDeploy"><SwitchThumb /></Switch>
      </Field>
      <Field>
        <FieldLabel>Preview deployments</FieldLabel>
        <Switch v-model:checked="settings.previews"><SwitchThumb /></Switch>
      </Field>
    </section>
    <section>
      <h2>Notifications</h2>
      <Field>
        <FieldLabel>Email me when a deploy fails</FieldLabel>
        <Switch v-model:checked="settings.emailOnFailure"><SwitchThumb /></Switch>
      </Field>
      <Field>
        <FieldLabel>Weekly digest</FieldLabel>
        <Switch v-model:checked="settings.weeklyDigest"><SwitchThumb /></Switch>
      </Field>
      <Field>
        <FieldLabel>Slack alerts</FieldLabel>
        <Switch v-model:checked="settings.slackAlerts"><SwitchThumb /></Switch>
      </Field>
    </section>
    <section>
      <h2>Members</h2>
      <table class="members">
        <thead><tr><th>Name</th><th>Email</th><th>Role</th></tr></thead>
        <tbody>
          <tr v-for="member in members" :key="member.email"><td>{{ member.name }}</td><td>{{ member.email }}</td><td>{{ member.role }}</td></tr>
        </tbody>
      </table>
    </section>
    <Button type="submit">Save changes</Button>
    <span class="status" role="status">{{ status }}</span>
  </form>
</template>
