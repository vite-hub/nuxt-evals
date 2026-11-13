This is Acme Console, a Nuxt app built with Nuxt UI, ViteHub and ViteHub UI. Read its README first.

Add a support assistant at `/support`, as a ViteHub Agent that answers with the model in `server/utils/model.ts`.

When the user asks to report a bug, the assistant answers with a form in the chat: **Title** (required), **Severity** (Low, Medium or High) and **Steps to reproduce**. The user fills it in and sends it from the chat. The assistant then files the bug with `fileBug()` from the store, with exactly the values the user entered, and answers with the bug's id.

The form must come from the assistant's answer, not from the page, so the assistant can ask for other forms later. People who use only a keyboard or a screen reader must be able to fill in and send the form.

Show the conversation with ViteHub UI's chat parts. Make sure the production build passes before you finish.
