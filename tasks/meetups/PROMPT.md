# Meetups: the next release

You work on Meetups, the Nuxt app in this folder. Read `README.md` first. Build the six features below. The code goes to production after this: the app is built with `nuxt build` and runs on Node, so `pnpm build` must pass when you are done.

## 1. Events list (`/events`)

- List the events that have not started yet, soonest first, 20 per page.
- Each row shows the title, the city, the start time (see 3) and the number of seats left, and links to the event page.
- A search box filters by title (case-insensitive, anywhere in the title). A city picker filters by city.
- The search, the city and the page are part of the URL, for example `/events?q=vue&city=Berlin&page=2`. A shared link opens with the same results, and the browser's Back and Forward buttons move between earlier searches.
- This is our most visited page, and most visitors are on phones with slow mobile data.

## 2. Event page (`/events/<slug>`)

- Show the title, the start time, the city, the venue, the description, the ticket price (see 5) and the seats left.
- When someone shares the link in a chat app or on social media, the preview shows the event title and a short description.
- An unknown event shows a "not found" page, and search engines must also see it as not found.

## 3. Start times

- On the list and on the event page, show when each event starts in the visitor's own time zone, and how far away it is ("in 3 hours", "in 2 days").

## 4. RSVP

- The event page has an **RSVP** button. It opens a dialog with a form with three fields: **Name**, **Email** and **Seats**.
- Rules: the name is required, the email must be a valid email address, and seats is a whole number from 1 to 4.
- When a value breaks a rule, the form shows a message at that field before anything is sent. The server checks the same rules and rejects bad input with an error for each field. We will change these rules soon (we want to allow up to 6 seats), so a rule change must be one edit.
- After a successful RSVP, the dialog closes, the seats left on the page update without a page reload, and the attendee gets a confirmation email.
- The mail provider is slow. Visitors must not wait for the email to go out.

## 5. Ticket prices in the visitor's currency

- Prices are stored in euros. US visitors see US dollars, UK visitors see pounds sterling, and everyone else sees euros. Use the browser's language setting to tell them apart (for example `en-US` and `en-GB`).
- Show the currency symbol and two decimals, for example `$21.60`. Free events show "Free".
- Exchange rates come from the provider we pay for, described in `docs/rates-api.md`.

## 6. Organizer dashboard (`/dashboard`)

- Only organizers can open it. Visitors who are not signed in go to the sign-in page. Signed-in members get a "not allowed" page with status 403.
- It lists the organizer's own next 10 events with the number of RSVPs and the seats left. Each event can expand to show its attendees (name, email, seats).
- It shows a bar chart of the RSVPs per day over the last 14 days, across the organizer's events.
- Attendee names and emails are private. Only the organizer of an event may see them.
