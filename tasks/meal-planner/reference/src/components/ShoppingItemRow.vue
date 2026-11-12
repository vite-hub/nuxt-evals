<script setup lang="ts">
import { computed } from "vue"
import { useSettings } from "../composables/settings"
import { displayItem, type ShoppingItem } from "../domain/shopping"
import { useI18n } from "../i18n"

// An item still to buy: tick it when it is in the basket.
const props = defineProps<{ item: ShoppingItem, ticked: boolean }>()
defineEmits<{ tick: [] }>()
const { units } = useSettings()
const { t, wording } = useI18n()
const shown = computed(() => displayItem(props.item, units.value, wording.value))
const quantity = computed(() => [...shown.value.missing, ...(props.item.toTaste ? [t.value.words.toTaste] : [])].join(" + "))
</script>

<template>
  <li class="row" :class="{ ticked }">
    <label class="what">
      <input type="checkbox" :checked="ticked" @change="$emit('tick')">
      <span class="name">{{ shown.name }}</span>
      <span class="quantity">{{ quantity }}<template v-if="item.inPantry"> ({{ t.shopping.stillNeeded }})</template></span>
    </label>
    <p v-if="item.apart" class="note">
      {{ t.shopping.apart }}
    </p>
  </li>
</template>

<style scoped>
.row {
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--border);
}

.what {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.25rem 0.6rem;
  min-height: 2.75rem;
}

.what input {
  width: 1.25rem;
  height: 1.25rem;
  accent-color: var(--brand-strong);
}

.name {
  font-weight: 600;
}

.quantity {
  color: var(--muted);
}

.note {
  margin: 0 0 0 1.85rem;
  color: var(--muted);
  font-size: 0.85rem;
}

.ticked .name,
.ticked .quantity {
  text-decoration: line-through;
  color: var(--muted);
}

@media print {
  .row {
    padding: 0.25rem 0;
  }
}
</style>
