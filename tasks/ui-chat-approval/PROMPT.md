This is Acme Console, a Nuxt app built with Nuxt UI and ViteHub UI. Read its README first.

Add an assistant at `/assistant`. The user chats with it, and it answers with the model in `server/utils/model.ts`. Answers stream in as they arrive.

The assistant can archive projects with a tool named `archiveProject`, which takes `{ slug }` and archives the project with `archiveProject(slug)` from the store. It must never archive a project without the user's OK. When it wants to, the chat shows which project and lets the user approve or deny it. Nothing is archived until the user approves. When the user denies, the assistant is told, and it answers.

Show the conversation with ViteHub UI's chat parts. People who use only a keyboard or a screen reader must be able to chat and to approve or deny.

Make sure the production build passes before you finish.
