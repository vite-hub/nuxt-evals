# Notebook

A web app for the notes people keep in our mobile app.

The API in `server/api` is the same one the mobile app calls, and the mobile team owns it. Every route except `POST /api/login` takes the user's token in an `Authorization: Bearer <token>` header and answers 401 without it. It doesn't read cookies.

The web app signs in with `POST /api/login` and keeps the token it returns in the `token` cookie.

Data lives in memory and resets on restart. Two users are seeded: `ada@example.test` and `alan@example.test`, both with the password `notebook`.

```sh
pnpm install
pnpm dev          # http://localhost:3000
pnpm build
pnpm start        # the production build; PORT and HOST pick where it listens
```
