import type { Locator, Page } from "playwright-core"
import type { Task } from "../types.ts"
import { fixture, startApp, type UiRuntime } from "../vitehub-ui/harness.ts"
import { buildGate, focused, noDivButtons, noHandRolledFocusTrap, noPageErrors, outcome, pageGate, press, type UiProbe } from "../vitehub-ui/probes.ts"

interface Project { slug: string }

const id = "ui-chat-approval"
const path = "/assistant"
const prompt = (page: Page) => page.getByRole("textbox").first()
const approveButton = (page: Page) => page.getByRole("button", { name: /approve|allow|confirm|^\s*yes|run it/i }).first()
const denyButton = (page: Page) => page.getByRole("button", { name: /deny|reject|decline|don.t|^\s*no\b|cancel/i }).first()

/** Sends a message the way a keyboard user does: Enter in the prompt, or the send button when Enter adds a line. */
async function send(page: Page, text: string): Promise<void> {
  const box = prompt(page)
  await box.focus({ timeout: 4000 })
  await box.fill(text)
  await box.press("Enter")
  await page.waitForTimeout(300)
  if ((await box.inputValue()).trim()) await press(page.getByRole("button", { name: /send|submit/i }).first())
}

/** Asks to archive a project and waits for the approval request. */
async function requestArchive(page: Page, name: string): Promise<{ approve: Locator, deny: Locator }> {
  await send(page, `Archive ${name}`)
  const approve = approveButton(page)
  const deny = denyButton(page)
  await approve.waitFor({ state: "visible", timeout: 10_000 })
  await deny.waitFor({ state: "visible", timeout: 2000 })
  return { approve, deny }
}

const listed = async (runtime: UiRuntime, slug: string) => Boolean((await runtime.json<Project[]>("/api/projects"))?.some(project => project.slug === slug))

const probes: UiProbe[] = [
  buildGate,
  pageGate(path),
  {
    id: "prompt-labelled",
    title: "The message box has an accessible name",
    layer: "runtime",
    check: ({ runtime }) => runtime.withPage(path, page => outcome(async () => {
      if (!await prompt(page).count()) return { passed: false, detail: "No text box on the page." }
      const snapshot = await prompt(page).ariaSnapshot()
      return { passed: /textbox "[^"]+"/.test(snapshot), detail: snapshot.trim().slice(0, 120) }
    })),
  },
  {
    id: "vitehub-chat-parts",
    title: "The conversation renders with ViteHub UI's chat parts (Chat, ChatMessage or MessageParts)",
    why: "The task asks for ViteHub UI. Hand-made message lists miss its log role, scrolling and streaming states.",
    layer: "runtime",
    check: ({ runtime }) => runtime.withPage(path, page => outcome(async () => {
      await send(page, "Hello")
      await page.getByText(/I can archive a project/).first().waitFor({ state: "visible", timeout: 10_000 })
      const parts = await page.locator(".vh-chat, [data-slot='message-parts']").count()
      return { passed: parts > 0, detail: parts ? `${parts} ViteHub chat parts` : "No .vh-chat or [data-slot=message-parts] in the page." }
    })),
  },
  {
    id: "replies-announced",
    title: "The assistant's reply is inside a live region (role log or aria-live), so screen readers announce it",
    layer: "runtime",
    check: ({ runtime }) => runtime.withPage(path, page => outcome(async () => {
      await send(page, "Hello")
      const reply = page.getByText(/I can archive a project/).first()
      await reply.waitFor({ state: "visible", timeout: 10_000 })
      const live = await reply.evaluate(element => Boolean(element.closest("[role=log], [role=status], [aria-live]:not([aria-live=off])")))
      return { passed: live, detail: live ? "Inside a live region." : "No live region around the reply." }
    })),
  },
  {
    id: "approval-requested",
    title: "\"Archive Atlas\" shows Approve and Deny buttons that name the project, and nothing is archived yet",
    why: "An assistant that acts before the user agrees can destroy work the user never meant to touch.",
    layer: "runtime",
    check: ({ runtime }) => runtime.withPage(path, page => outcome(async () => {
      const { approve, deny } = await requestArchive(page, "Atlas")
      // From the element that holds both buttons, look outward for the project's name, but stop before the region
      // that also holds the user's own "Archive Atlas": that message doesn't tell which project the tool will touch.
      const card = await approve.evaluate((button, other) => {
        let node: Element | null = button.parentElement
        while (node && other && !node.contains(other)) node = node.parentElement
        for (; node; node = node.parentElement) {
          if ([...node.querySelectorAll("*")].some(element => element.textContent?.trim().toLowerCase() === "archive atlas")) return ""
          if (/atlas/i.test(node.textContent ?? "")) return node.textContent ?? ""
        }
        return ""
      }, await deny.elementHandle())
      if (!/atlas/i.test(card)) return { passed: false, detail: "The approval doesn't say which project." }
      return { passed: await listed(runtime, "atlas"), detail: "Atlas is still listed while the request waits." }
    })),
  },
  {
    id: "approve-runs-tool",
    title: "Approve (with Enter) archives Atlas and the assistant confirms it",
    layer: "runtime",
    check: ({ runtime }) => runtime.withPage(path, page => outcome(async () => {
      const { approve } = await requestArchive(page, "Atlas")
      await press(approve)
      await page.getByText(/atlas is archived/i).first().waitFor({ state: "visible", timeout: 10_000 })
      const gone = !await listed(runtime, "atlas")
      return { passed: gone, detail: gone ? "Archived and confirmed." : "The assistant confirmed, but Atlas is still listed." }
    })),
  },
  {
    id: "deny-tells-model",
    title: "Deny (with Enter) keeps Borealis, and the assistant answers that it left it alone",
    why: "If the model never hears the denial, it retries or claims it did the work.",
    layer: "runtime",
    check: ({ runtime }) => runtime.withPage(path, page => outcome(async () => {
      const { deny } = await requestArchive(page, "Borealis")
      await press(deny)
      await page.getByText(/left borealis as it is/i).first().waitFor({ state: "visible", timeout: 10_000 })
      const kept = await listed(runtime, "borealis")
      return { passed: kept, detail: kept ? "Kept, and the assistant said so." : `Borealis was archived; focus on ${await focused(page)}` }
    })),
  },
  noDivButtons,
  noHandRolledFocusTrap,
  noPageErrors,
]

/**
 * A chat with a tool that waits for the user's approval. Target 90%: ViteHub UI renders the messages and the prompt,
 * but the approval card, its wiring to the AI SDK and the resend after approval are the agent's to get right.
 */
const task: Task<UiRuntime> = {
  id,
  title: "ViteHub UI: Chat with tool approval",
  fixture,
  target: 0.9,
  timeLimitMinutes: 30,
  probes,
  start: work => startApp(work, { id, fixture }),
}

export default task
