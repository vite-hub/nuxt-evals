<script setup lang="ts">
const emit = defineEmits<{ created: [] }>()

const open = ref(false)
const name = ref("")
const visibility = ref("private")
const serverError = ref("")
const pending = ref(false)

watch(open, (value) => {
  if (!value) return
  name.value = ""
  visibility.value = "private"
  serverError.value = ""
})

async function create() {
  pending.value = true
  try {
    await $fetch("/api/projects", { method: "POST", body: { name: name.value, visibility: visibility.value } })
    open.value = false
    emit("created")
  }
  catch (error) {
    serverError.value = (error as { data?: { message?: string } }).data?.message ?? "The project could not be created"
  }
  finally {
    pending.value = false
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogTrigger>New project</DialogTrigger>
    <DialogBackdrop />
    <DialogContent>
      <div data-slot="stack">
        <DialogTitle>New project</DialogTitle>
        <DialogDescription>Projects hold your deployments and settings.</DialogDescription>
      </div>
      <form data-slot="stack" @submit.prevent="create">
        <Field name="name" :invalid="serverError ? true : undefined">
          <FieldLabel>Name</FieldLabel>
          <Input v-model="name" required maxlength="40" autocomplete="off" @value-change="serverError = ''" />
          <FieldError match="valueMissing">
            Enter a name.
          </FieldError>
          <FieldError v-if="serverError" match>
            {{ serverError }}
          </FieldError>
        </Field>
        <Field>
          <FieldLabel>Visibility</FieldLabel>
          <RadioGroup v-model:value="visibility" name="visibility">
            <label data-slot="label">
              <Radio value="private"><RadioIndicator /></Radio>
              Private
            </label>
            <label data-slot="label">
              <Radio value="public"><RadioIndicator /></Radio>
              Public
            </label>
          </RadioGroup>
        </Field>
        <div data-slot="row">
          <DialogClose>Cancel</DialogClose>
          <Button type="submit" data-variant="solid" :disabled="pending">
            Create project
          </Button>
        </div>
      </form>
    </DialogContent>
  </Dialog>
</template>
