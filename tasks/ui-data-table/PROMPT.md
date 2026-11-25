This is Acme Console, a Nuxt app built with Nuxt UI and ViteHub UI. Read its README first.

Add a Deployments page at `/deployments` with a table of every deployment from `GET /api/deployments`, all on one page. The columns are Deployment (the id), Project, Branch, Status, Author, Created and Duration.

- Users can sort by Created and by Duration, in both directions.
- A **Filter deployments** search box filters the rows by branch or author while the user types.
- When no deployment matches, the table says so and offers a way to clear the filter.

People who use only a keyboard or a screen reader must be able to do all of this, and to know which column the table is sorted by.

Use the UI parts the project already has. Make sure the production build passes before you finish.
