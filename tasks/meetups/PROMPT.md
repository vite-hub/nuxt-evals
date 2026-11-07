# Meetups: the next release

You work on Meetups, the Nuxt app in this folder. Read `README.md` first. Build the twelve features below. The code goes to production after this: the app is built with `nuxt build` and runs on Node, so `pnpm build` must pass when you are done.

## 1. Events list (`/events`)

- List the events that have not started yet, soonest first, 20 per page.
- Each row shows the title, the city, the start time (see 3) and the number of seats left, and links to the event page.
- A search box filters by title (case-insensitive, anywhere in the title). The results update while the visitor types, without pressing Enter. A city picker filters by city.
- The search, the city and the page are part of the URL, for example `/events?q=vue&city=Berlin&page=2`. A shared link opens with the same results, and the browser's Back and Forward buttons move between earlier searches.
- This is our most visited page, and most visitors are on phones with slow mobile data. Don't send a request for every key press.
- When a visitor goes back from an event page to the list, the list shows again at once, without waiting for the network.

## 2. Event page (`/events/<slug>`)

- Show the title, the start time, the city, the venue, the description, the ticket price (see 5) and the seats left.
- When someone shares the link in a chat app or on social media, the preview shows the event title and a short description.
- An unknown event, or any other unknown address, shows our "not found" page with the usual header and a link back to the events. Search engines must also see it as not found.
- Links to an event get shared with tracking parameters, for example `?utm_source=newsletter`. Search engines must still see one address for the event.

## 3. Start times

- On the list and on the event page, show when each event starts in the visitor's own time zone, and how far away it is ("in 3 hours", "in 2 days").

## 4. RSVP

- The event page has an **RSVP** button. It opens a dialog with a form with three fields: **Name**, **Email** and **Seats**.
- Rules: the name is required, the email must be a valid email address, and seats is a whole number from 1 to 4.
- When a value breaks a rule, the form shows a message at that field before anything is sent. The server checks the same rules and rejects bad input with an error for each field. We will change these rules soon (we want to allow up to 6 seats), so a rule change must be one edit.
- After a successful RSVP, the dialog closes, the seats left on the page update without a page reload, and the attendee gets a confirmation email.
- Visitors on slow connections often click twice. A double click books once.
- The mail provider is slow. Visitors must not wait for the email to go out.

## 5. Ticket prices in the visitor's currency

- Prices are stored in euros. US visitors see US dollars, UK visitors see pounds sterling, and everyone else sees euros. Use the browser's language setting to tell them apart (for example `en-US` and `en-GB`).
- Show the currency symbol and two decimals, for example `$21.60`. Free events show "Free".
- Visitors see the price in their currency right away, also in the first HTML the server sends, not a euro price that changes after the page loads.
- Exchange rates come from the provider we pay for, described in `docs/rates-api.md`.

## 6. Organizer dashboard (`/dashboard`)

- Only organizers can open it. Visitors who are not signed in go to the sign-in page. Signed-in members get a "not allowed" page with status 403.
- It lists the organizer's own next 10 events with the number of RSVPs and the seats left. Each event can expand to show its attendees (name, email, seats).
- It shows a bar chart of the RSVPs per day over the last 14 days, across the organizer's events.
- Attendee names and emails are private. Only the organizer of an event may see them.

## 7. Header

- Every page has a header. Signed-in people see their name and a **Sign out** button there. Everyone else sees a **Sign in** link.
- The first HTML the server sends already shows the right one.

## 8. Currency picker

- The header has a **Currency** picker with Auto, USD, EUR and GBP. Auto follows the rule in 5.
- The choice changes every price on the page at once, and this device remembers it. When the visitor comes back, the first page the server sends already shows prices in the chosen currency.

## 9. Live seats

- While an event page is open, its seats left update by themselves within 5 seconds when other people RSVP.
- We pay for every request. Stop checking when the visitor leaves the event page, and pause while the browser tab is hidden.

## 10. Brand and dark mode

- Our brand color is `#00DC82`. Primary buttons, links, focus rings and every other accent use it on every page, also on the pages that exist today.
- Every control has 2 px corners: buttons, inputs, selects, menus and dialogs.
- The header has a switch between light and dark. It starts with the system setting, and this device remembers the choice. A returning visitor never sees a flash of the other theme.

## 11. Old links

- Our previous app linked to events as `/e/<number>`, with the event's number (its `id`), for example `/e/1234`. Those links are all over the web. They must keep working, and browsers and search engines must learn the new address for good.
- An unknown number shows the "not found" page.

## 12. Attendee export

- Each event on the dashboard has a **Download CSV** link. It downloads that event's attendees (name, email, seats, RSVP time) as `attendees-<slug>.csv`, a file that opens in a spreadsheet.
- Only the event's organizer may download it.
