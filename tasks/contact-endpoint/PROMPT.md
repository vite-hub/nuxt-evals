This project is a small Nitro v3 server that uses h3 v2.

Add an endpoint that receives contact form submissions as JSON with `name`, `email` and `message`.

- All three fields are required. `email` must look like an email address. `message` must have at least 10 characters.
- Invalid input must get a 400 response that says which fields are wrong.
- Valid input returns `{ "ok": true }`.

Follow the style of the existing code.
