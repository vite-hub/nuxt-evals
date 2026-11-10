build me a meetups site with nuxt nightly (nuxt 5) and vitehub (vitehub.dev). like a small meetup.com for tech events

people sign up with email and password or with a passkey, find events by city or with a search, open an event and rsvp (or cancel). events happen all over the world. events have a limited number of seats and some cost money, show the price in the visitor's currency (usd, gbp or eur). organizers create and edit their events, add a cover photo, see who's coming with a little chart, and can export the list as csv

seats left should update live on the event page. send a confirmation email when someone rsvps and a reminder the day before. we had an old site with links like /e/123, those have to keep working

use our green #00dc82, and dark mode too

real database and real auth, nothing fake. use vitehub for the database, auth, email, photo uploads and background jobs. vitehub on npm is old, use the pkg.pr.new build of commit 1e807fc (https://pkg.pr.new/vite-hub/vitehub/vite-hub@1e807fc). make it production ready
