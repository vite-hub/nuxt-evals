import contactEndpoint from "./contact-endpoint/task.ts"
import fixSeatsRace from "./fix-seats-race/task.ts"
import fixCachedSearch from "./fix-cached-search/task.ts"
import fixOwnerCheck from "./fix-owner-check/task.ts"
import fixApiToken from "./fix-api-token/task.ts"
import fixCacheLeak from "./fix-cache-leak/task.ts"
import fixSessionReads from "./fix-session-reads/task.ts"
import fixSvgCover from "./fix-svg-cover/task.ts"
import mealPlanner from "./meal-planner/task.ts"
import meetups from "./meetups/task.ts"
import scanMeetups from "./scan-meetups/task.ts"
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
  [fixSeatsRace.id]: fixSeatsRace,
  [fixCachedSearch.id]: fixCachedSearch,
  [fixOwnerCheck.id]: fixOwnerCheck,
  [fixCacheLeak.id]: fixCacheLeak,
  [fixSessionReads.id]: fixSessionReads,
  [fixSvgCover.id]: fixSvgCover,
  [fixApiToken.id]: fixApiToken,
  [scanMeetups.id]: scanMeetups,
}
