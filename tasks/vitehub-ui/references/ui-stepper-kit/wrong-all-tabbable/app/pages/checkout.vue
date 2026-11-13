<script setup lang="ts">
useHead({ title: "Checkout" })

const steps = ["Shipping", "Payment", "Review"]

const step = ref(1)
const reached = ref(1)
const address = ref("")
const cardName = ref("")
const placing = ref(false)
const placed = ref(false)

async function go(value: number) {
  reached.value = Math.max(reached.value, value)
  step.value = value
  await nextTick()
  document.getElementById(`step-${value}-heading`)?.focus()
}

async function placeOrder() {
  placing.value = true
  try {
    await $fetch("/api/orders", { method: "POST", body: { address: address.value, cardName: cardName.value } })
    placed.value = true
  }
  finally {
    placing.value = false
  }
}
</script>

<template>
  <div class="stack">
    <h1 class="title">
      Checkout
    </h1>
    <ol class="steps">
      <li v-for="(label, index) in steps" :key="label">
        <button type="button" :aria-current="step === index + 1 ? 'step' : undefined" :aria-disabled="index + 1 > reached" @click="index + 1 <= reached && go(index + 1)">
          {{ index + 1 }}. {{ label }}
        </button>
      </li>
    </ol>
    <form v-if="step === 1" data-slot="stack" @submit.prevent="go(2)">
      <h2 id="step-1-heading" tabindex="-1">
        Shipping
      </h2>
      <Field name="address">
        <FieldLabel>Address</FieldLabel>
        <Input v-model="address" required autocomplete="street-address" />
        <FieldError match="valueMissing">
          Enter the address.
        </FieldError>
      </Field>
      <div data-slot="row">
        <Button type="submit" data-variant="solid">
          Continue
        </Button>
      </div>
    </form>
    <form v-else-if="step === 2" data-slot="stack" @submit.prevent="go(3)">
      <h2 id="step-2-heading" tabindex="-1">
        Payment
      </h2>
      <Field name="cardName">
        <FieldLabel>Name on card</FieldLabel>
        <Input v-model="cardName" required autocomplete="cc-name" />
        <FieldError match="valueMissing">
          Enter the name on the card.
        </FieldError>
      </Field>
      <div data-slot="row">
        <Button type="button" @click="go(1)">
          Back
        </Button>
        <Button type="submit" data-variant="solid">
          Continue
        </Button>
      </div>
    </form>
    <section v-else data-slot="stack" aria-labelledby="step-3-heading">
      <h2 id="step-3-heading" tabindex="-1">
        Review
      </h2>
      <dl>
        <dt>Address</dt>
        <dd>{{ address }}</dd>
        <dt>Name on card</dt>
        <dd>{{ cardName }}</dd>
      </dl>
      <div data-slot="row">
        <Button type="button" @click="go(2)">
          Back
        </Button>
        <Button type="button" data-variant="solid" :disabled="placing || placed" @click="placeOrder">
          Place order
        </Button>
      </div>
      <p role="status">
        {{ placed ? "Your order is placed." : "" }}
      </p>
    </section>
  </div>
</template>
