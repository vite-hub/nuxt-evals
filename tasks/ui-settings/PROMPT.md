This is Acme Console, a Nuxt app built with Nuxt UI and ViteHub UI. Read its README first.

Add a settings page for each project at `/projects/<slug>/settings`, for example `/projects/atlas/settings`. It has three tabs:

- **General**: a **Public project** switch and a **Default branch** select (main, develop or release). Both show the project's current values. **Save changes** saves them with `PATCH /api/projects/<slug>` and tells the user that it worked.
- **Members**: the project's members from `GET /api/projects/<slug>/members`, with their name, email and role.
- **Danger zone**: a **Delete project** button. It asks the user to confirm first. Confirming deletes the project with `DELETE /api/projects/<slug>` and goes back to the Projects page. Canceling changes nothing.

People who use only a keyboard or a screen reader must be able to do all of this.

Use the UI parts the project already has. Make sure the production build passes before you finish.
