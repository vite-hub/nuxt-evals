// Preloaded with `node --import` by graders (never by agents): makes the app's local SQLite answer like a database
// across a network. libSQL's local client runs every query synchronously, so a request that reads, then writes, never
// yields to another request in between, and a check-then-insert race can't show on one machine. In production the
// database is Turso or D1, tens of milliseconds away, and the race is real. See load.mjs.
import { register } from "node:module"

register("./load.mjs", import.meta.url)
