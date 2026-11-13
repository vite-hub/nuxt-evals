This is Acme Console, a Nuxt app built with ui-sdk (`@ui-sdk/vue`). Read its README first.

Add a checkout on a new page, `/checkout`, in three steps: **Shipping**, **Payment** and **Review**.

- **Shipping** asks for an **Address**. It is required.
- **Payment** asks for the **Name on card**. It is required.
- **Review** shows both values and has a **Place order** button. Place order sends `{ address, cardName }` to `POST /api/orders`, which the project already has, and then tells the person that the order is placed.

Show the three steps and which one is current. **Continue** moves one step ahead, and only when the field of the step is filled. A person can go back to any step they reached and find what they typed there. They can never go to a step they have not reached yet, with the mouse or the keyboard.

People who use only a keyboard or a screen reader must be able to do all of this.

Use the UI parts the project already has. Make sure the production build passes before you finish.
