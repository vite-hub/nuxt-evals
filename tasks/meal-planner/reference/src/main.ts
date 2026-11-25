import { createApp } from "vue"
import App from "./App.vue"
import { useAppUpdate } from "./composables/app-update"
import { notify } from "./composables/toasts"
import { messages } from "./i18n"
import { createAppRouter } from "./router"
import "./styles.css"

const app = createApp(App)
app.config.errorHandler = (error) => {
  console.error(error)
  notify(messages.value.app.error, "error")
}
const router = createAppRouter()
app.use(router)
app.mount("#app")

// Offline support and updates. A navigation is a good moment to look for a new version.
const update = useAppUpdate()
void update.register()
router.afterEach(update.check)
