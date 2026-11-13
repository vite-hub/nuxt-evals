import contactEndpoint from "./contact-endpoint/task.ts"
import mealPlanner from "./meal-planner/task.ts"
import meetups from "./meetups/task.ts"
import type { Task } from "./types.ts"
import uiAgentForm from "./ui-agent-form/task.ts"
import uiChatApproval from "./ui-chat-approval/task.ts"
import uiDataTable from "./ui-data-table/task.ts"
import uiDialogForm from "./ui-dialog-form/task.ts"
import uiDialogFormUisdk from "./ui-dialog-form-uisdk/task.ts"
import uiSettings from "./ui-settings/task.ts"
import uiStepperKit from "./ui-stepper-kit/task.ts"
import uiStepperTabs from "./ui-stepper-tabs/task.ts"

/** Every project, by id. */
export const tasks: Record<string, Task<unknown>> = {
  [contactEndpoint.id]: contactEndpoint,
  [meetups.id]: meetups,
  [mealPlanner.id]: mealPlanner,
  [uiDialogForm.id]: uiDialogForm,
  [uiSettings.id]: uiSettings,
  [uiDataTable.id]: uiDataTable,
  [uiChatApproval.id]: uiChatApproval,
  [uiAgentForm.id]: uiAgentForm,
  [uiDialogFormUisdk.id]: uiDialogFormUisdk,
  [uiStepperKit.id]: uiStepperKit,
  [uiStepperTabs.id]: uiStepperTabs,
}
