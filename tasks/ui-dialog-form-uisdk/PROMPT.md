This is Acme Console, a Nuxt app built with ui-sdk (`@ui-sdk/vue`). Read its README first.

On the Projects page (`/`), add a **New project** button. It opens a dialog titled "New project" with two fields:

- **Name**: required, at most 40 characters.
- **Visibility**: Private or Public. Private is selected at first.

**Create project** sends the project to `POST /api/projects`. When that works, the dialog closes and the new project shows in the list without a page reload. When the API refuses the name (for example, a name that is taken), the dialog stays open and shows the API's message. An empty name never reaches the API.

People who use only a keyboard or a screen reader must be able to do all of this.

Use the UI parts the project already has. Make sure the production build passes before you finish.
