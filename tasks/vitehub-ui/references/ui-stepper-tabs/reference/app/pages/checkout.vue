<script setup lang="ts">
useHead({ title: "Checkout" })

const steps = [
  { value: "shipping", label: "Shipping" },
  { value: "payment", label: "Payment" },
  { value: "review", label: "Review" },
]

const step = ref("shipping")
const reached = ref(0)
const address = ref("")
const cardName = ref("")
const placing = ref(false)
const placed = ref(false)

async function go(index: number) {
  reached.value = Math.max(reached.value, index)
  step.value = steps[index]!.value
  await nextTick()
  document.getElementById(`${steps[index]!.value}-heading`)?.focus()
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
    <Tabs v-model:value="step">
      <TabsList aria-label="Checkout steps">
        <TabsTab v-for="(item, index) in steps" :key="item.value" :value="item.value" :disabled="index > reached">
          {{ index + 1 }}. {{ item.label }}
        </TabsTab>
      </TabsList>
      <TabsPanel value="shipping">
        <form data-slot="stack" @submit.prevent="go(1)">
          <h2 id="shipping-heading" tabindex="-1">
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
      </TabsPanel>
      <TabsPanel value="payment">
        <form data-slot="stack" @submit.prevent="go(2)">
          <h2 id="payment-heading" tabindex="-1">
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
            <Button type="button" @click="go(0)">
              Back
            </Button>
            <Button type="submit" data-variant="solid">
              Continue
            </Button>
          </div>
        </form>
      </TabsPanel>
      <TabsPanel value="review">
        <div data-slot="stack">
          <h2 id="review-heading" tabindex="-1">
            Review
          </h2>
          <dl>
            <dt>Address</dt>
            <dd>{{ address }}</dd>
            <dt>Name on card</dt>
            <dd>{{ cardName }}</dd>
          </dl>
          <div data-slot="row">
            <Button type="button" @click="go(1)">
              Back
            </Button>
            <Button type="button" data-variant="solid" :disabled="placing || placed" @click="placeOrder">
              Place order
            </Button>
          </div>
          <p role="status">
            {{ placed ? "Your order is placed." : "" }}
          </p>
        </div>
      </TabsPanel>
    </Tabs>
  </div>
</template>
