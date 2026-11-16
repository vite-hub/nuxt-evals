<script setup lang="ts">
// The tempting wrong form: clickable header cells with no button and no aria-sort, filter on Enter only, no empty state.
interface Deployment { id: string, project: string, branch: string, status: string, author: string, createdAt: string, durationSeconds: number }
const { data: deployments } = await useFetch<Deployment[]>("/api/deployments", { default: () => [] })
const query = ref("")
const applied = ref("")
const sortKey = ref<"createdAt" | "durationSeconds">("createdAt")
const ascending = ref(false)
const rows = computed(() => deployments.value
  .filter(item => !applied.value || item.branch.includes(applied.value) || item.author.includes(applied.value))
  .toSorted((a, b) => (a[sortKey.value] < b[sortKey.value] ? -1 : 1) * (ascending.value ? 1 : -1)))

function sortBy(key: "createdAt" | "durationSeconds") {
  ascending.value = sortKey.value === key ? !ascending.value : true
  sortKey.value = key
}
</script>

<template>
  <div>
    <input v-model="query" placeholder="Filter deployments" @keyup.enter="applied = query">
    <table>
      <thead>
        <tr>
          <th>Deployment</th><th>Project</th><th>Branch</th><th>Status</th><th>Author</th>
          <th @click="sortBy('createdAt')">
            Created
          </th>
          <th @click="sortBy('durationSeconds')">
            Duration
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.id">
          <td>{{ row.id }}</td><td>{{ row.project }}</td><td>{{ row.branch }}</td><td>{{ row.status }}</td><td>{{ row.author }}</td><td>{{ row.createdAt }}</td><td>{{ row.durationSeconds }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
