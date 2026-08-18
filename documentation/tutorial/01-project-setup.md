# Section 1 — Project Setup

[← Back to index](../README.md) · Next: [Config & Database Connection →](02-config-and-database.md)

## Why

Every Node.js project starts the same way: a folder, a `package.json` file that describes it,
and a place for your code to live. Getting this right first means every later section just
works, instead of fighting folder paths.

## Step 1 — Create the project folder

```bash
mkdir nsmq_tricks && cd nsmq_tricks
```

**What this does:** `mkdir nsmq_tricks` creates a new, empty folder named `nsmq_tricks`. `cd nsmq_tricks`
moves your terminal *into* that folder, so every command you run next happens inside it.

**Demonstration:** run `pwd` (Mac/Linux) or `cd` with no arguments (Windows). You should see a path
ending in `.../nsmq_tricks`.

## Step 2 — Create the backend folder

The project has two halves: a `backend` (the server, the database logic, the API) and a
`frontend` (the pages the user actually sees). We'll build the backend first, so let's make room
for it now.

```bash
mkdir backend && mkdir backend/src
```

**Why a `src` folder specifically:** keeping source code inside `backend/src` (rather than loose
in `backend/`) means anything *generated* later — logs, `node_modules`, build output — stays
clearly separate from code you wrote by hand.

## Step 3 — Initialize the Node.js project

Move back to the project root and create `package.json`:

```bash
cd nsmq_tricks
npm init -y
```

**What this does:** `npm init -y` creates `package.json` — a file that lists your project's name,
its dependencies (the libraries it needs), and the commands you can run (`npm start`, `npm run dev`,
etc.). The `-y` flag accepts all the default answers instead of asking you questions one by one.

**Demonstration:** open the new `package.json`. It should look roughly like this:

```json
{
  "name": "nsmq_tricks",
  "version": "1.0.0",
  "main": "index.js",
  "scripts": {
    "test": "echo \"Error: no test specified\" && exit 1"
  }
}
```

## Step 4 — Turn on modern JavaScript imports

By default, Node.js expects the older `require(...)` style. This project uses the modern
`import ... from ...` style (called ES Modules), which is what you'll see in every code sample
from here on. Add one line to `package.json`:

```json
{
  "type": "module"
}
```

**Why:** `import`/`export` syntax is the current standard, matches what you'll see in frontend
JavaScript too, and lets you `import` a single named function instead of pulling in a whole object.
Without `"type": "module"`, Node.js would throw `SyntaxError: Cannot use import statement outside a module`
the moment you tried it.

## Step 5 — Add your start scripts

Still in `package.json`, replace the `"scripts"` section:

```json
{
  "scripts": {
    "start": "node ./backend/src/server.js",
    "dev": "nodemon ./backend/src/server.js"
  }
}
```

**What this does:** `npm start` runs your server the "production" way — once, plainly. `npm run dev`
runs it through **nodemon**, a tool that watches your files and automatically restarts the server
every time you save a change, so you don't have to stop and restart it by hand while developing.

## Step 6 — Install your first dependencies

```bash
npm install express mongoose dotenv
npm install --save-dev nodemon
```

**What each package is for:**

| Package | Why you need it |
|---|---|
| `express` | The web framework — handles incoming HTTP requests and sends responses. Nearly everything in `backend/` builds on it. |
| `mongoose` | Talks to MongoDB in a structured way (schemas, validation) instead of raw database queries. |
| `dotenv` | Loads settings (database URLs, secrets) from a `.env` file instead of hardcoding them in your code. |
| `nodemon` | Development-only — auto-restarts the server on file changes. The `--save-dev` flag means "only needed while developing, not in production." |

**Demonstration:** open `package.json` again. You should now see a `"dependencies"` block listing
`express`, `mongoose`, and `dotenv`, and a `"devDependencies"` block listing `nodemon`.

## Step 7 — Create your environment file

Environment variables are settings that change between your computer and a real server, and
that should never be committed to source control (database passwords, secret keys). Create a
file named exactly `.env` in the project root:

```bash
PORT=4000
```

We'll add more to this file as later sections need it (a database URL, a JWT secret, and so on).

## Step 8 — Keep secrets out of Git

Create a `.gitignore` file in the project root:

```
.env
node_modules
```

**Why:** `.env` holds secrets (database passwords, API keys) — if it's committed to a public Git
repository, anyone can read them. `node_modules` is the folder where all your installed packages
live; it's huge and 100% reproducible from `package.json`, so there's no reason to store it in Git.

## Step 9 — Your first file: a minimal server

Create `backend/src/app.js`:

```javascript
import express from "express";

const app = express();

export { app };
```

**What this does:** `express()` creates an Express *application* — an object that knows how to
receive HTTP requests and decide what to do with them. Right now it doesn't do anything yet; we're
just creating the object and making it available to other files via `export`.

Now create `backend/src/server.js`:

```javascript
import { app } from "./app.js";

const PORT = 4000;

const server = app.listen(PORT, () => {
    console.log(`Listening on PORT ${PORT}`);
});
```

**What this does:** `app.listen(PORT, ...)` starts the server and tells it to wait for incoming
requests on port 4000 (`http://localhost:4000`). The callback function runs once the server has
actually started, so you get a confirmation message.

## Checkpoint — run it

```bash
npm run dev
```

**Demonstration:** you should see:

```
Listening on PORT 4000
```

in your terminal, and it should stay running (not exit). Leave it running and open
`http://localhost:4000` in a browser — you'll see `Cannot GET /`, and that's correct! It means
your server is alive and responding; you just haven't told it what to do with `GET /` yet. That's
exactly what the next sections build.

Press `Ctrl+C` in the terminal to stop the server when you're done.

---

Next: [Section 2 — Config & Database Connection →](02-config-and-database.md)
