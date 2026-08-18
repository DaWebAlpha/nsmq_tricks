# Section 5 — The Express App Shell

[← Back to index](../README.md) · Previous: [The Base Model Pattern](04-base-model-pattern.md) · Next: [User Model & Auth Backend →](06-auth-backend.md)

## Why

So far `app.js` is just `const app = express()` — it doesn't know how to serve a webpage, parse a
form submission, or find your CSS files. This section assembles the real app shell: **this is
also where the frontend enters the picture**, because Express needs to be told *where your HTML
templates live* and *where your CSS/JS/images live* before any page can render.

```bash
npm install ejs helmet cookie-parser
```

**What each is for:**

| Package | Why you need it |
|---|---|
| `ejs` | The template language — lets you write HTML with embedded JavaScript (`<%= user.name %>`) instead of building strings by hand. |
| `helmet` | Sets a batch of security-related HTTP response headers in one call (more in Section 8). |
| `cookie-parser` | Reads cookies off incoming requests into `request.cookies`, so you can read the login session cookie later. |

## Step 1 — Create the frontend folder

This is the moment backend and frontend connect. Create:

```bash
mkdir -p frontend/views/pages
mkdir -p frontend/views/partials
mkdir frontend/public
```

**What each folder is for:**

- `frontend/views/pages/` — one `.ejs` file per page (`home.ejs`, `dashboard.ejs`, …).
- `frontend/views/partials/` — reusable pieces shared across pages (a nav bar, a footer) that get
  `include`d into multiple pages instead of copy-pasted.
- `frontend/public/` — anything the browser downloads directly: CSS files, client-side JavaScript,
  images. Express will serve this folder's contents as-is, at the URL path matching their location
  inside it (a file at `frontend/public/css/base.css` becomes reachable at `/css/base.css`).

## Step 2 — Tell Express where the frontend lives

Update `backend/src/app.js`:

```javascript
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "..", "..", "frontend", "views"));

app.use(express.static(path.join(__dirname, "..", "..", "frontend", "public")));

export { app };
```

**What this does:**

- `fileURLToPath`/`path.dirname` reconstruct `__dirname` (the folder this file lives in) — ES
  Modules don't provide `__dirname` automatically the way older Node.js code style did.
- `app.set("view engine", "ejs")` tells Express: whenever a route calls `response.render("home", ...)`,
  look for `home.ejs` and run it through the EJS template engine.
- `app.set("views", ...)` tells Express *where* to look for those `.ejs` files —
  `frontend/views`, not the default `views` folder next to `app.js`.
- `express.static(...)` makes the entire `frontend/public` folder directly downloadable by the
  browser. This is what makes `<link rel="stylesheet" href="/css/base.css">` in an HTML page
  actually work.

**A mistake worth knowing about, because it fails silently:** `app.set(...)` and `app.use(...)`
are not interchangeable, even though both take a single call. `app.set(key, value)` stores a named
*setting* — pass it something that isn't a `(key, value)` pair (say,
`app.set(express.static(...))`, missing the `"views"`-style key entirely) and Express doesn't
throw; it just quietly does nothing useful with it, because `arguments.length === 1` makes
`app.set` behave as a *getter* instead. Static file serving would silently never work, with no
error to point you at why. Middleware — anything that should run on every matching request, like
`express.static(...)` — belongs in `app.use(...)`, not `app.set(...)`.

## Step 3 — Your first real page

Create `frontend/views/pages/home.ejs`:

```html
<!DOCTYPE html>
<html lang="en">
    <head>
        <meta charset="UTF-8" />
        <title>NSMQ Tricks</title>
    </head>
    <body>
        <h1>Welcome to NSMQ Tricks</h1>
    </body>
</html>
```

And a route to render it. For now, add this directly in `app.js` (Section 6 moves routes into
their own files):

```javascript
app.get("/", (request, response) => {
    return response.status(200).render("pages/home", {
        success: true,
        title: "home",
        message: "rendering page"
    })
})
```

**What this does:** `response.render("pages/home", {...})` finds `frontend/views/pages/home.ejs`,
runs it (with `success`/`title`/`message` available inside the template as variables, even though
this particular template doesn't use any of them yet), and sends the resulting HTML back to the
browser. Note `app.get("/", ...)`, not `app.use("/", ...)` — `app.use` at that path would match
*every* HTTP method (`POST`, `DELETE`, …), not just page loads; `app.get` only responds to `GET`.

## Step 4 — Parse incoming request data

Add these two lines, which let your routes read data the browser sends:

```javascript
app.use(express.json());
app.use(express.urlencoded({extended: true}));
```

**What each does:** `express.json()` parses a JSON request body (used by `fetch()` calls with
`Content-Type: application/json`) into `request.body`. `express.urlencoded(...)` does the same for
traditional HTML `<form>` submissions (`Content-Type: application/x-www-form-urlencoded`). Without
these, `request.body` would be `undefined` no matter what the client sent.

## Step 5 — A first pass at security headers

```javascript
import helmet from "helmet";
import cookieParser from "cookie-parser";

app.use(helmet());
app.use(cookieParser());
```

**What this does (the short version — Section 8 goes deep):** `helmet()` sets ~10 HTTP response
headers that block common attacks by default (clickjacking, MIME-sniffing, and more) — you get
solid defaults with zero configuration. `cookieParser()` reads the `Cookie` header off incoming
requests and populates `request.cookies` as a plain object, which you'll need the moment you build
login sessions in the next section.

## Step 6 — Mount routers (a preview)

Real apps don't define routes directly in `app.js` — they group related routes into their own
files ("routers") and mount them at a base path. You'll build the actual routers in Section 6, but
here's the shape you're aiming for:

```javascript
import { pageRouter } from "./routes/pages/pages.routes.js";

app.use("/", pageRouter);
```

**What this does:** every route defined inside `pageRouter` (say, `router.get("/about", ...)`)
becomes reachable at `/about`, because it's mounted at the `"/"` base path. Mount a different
router at `"/admin"` instead, and all its routes automatically live under `/admin/...` — no need
to repeat the prefix in every single route definition.

## Step 7 — 404s and the error handler, last

Section 3 already built `errorHandler`. Now build its counterpart — a handler for requests that
didn't match *any* route at all. Create `backend/src/middlewares/notFound.middleware.js`:

```javascript
import { HTTP_STATUS } from "../constants/index.js";

/**
 * Catch-all 404 handler — registered after every real route, so it only
 * runs when nothing else matched the request. Renders the `404` view
 * rather than calling `next()`, ending the request-response cycle here.
 *
 * @param {import("express").Request} request
 * @param {import("express").Response} response
 * @param {import("express").NextFunction} next
 * @returns {void}
 */
const notFound = (request, response, next) => {
    return response.status(HTTP_STATUS.NOT_FOUND).render('404',{
        success: false,
        message: `The requested resource ${request.originalUrl} could not be found on the server`,
    })
}

export {
    notFound,
}
```

It needs a `404.ejs` view to render, the same way the home route needs `home.ejs` — create
`frontend/views/404.ejs`:

```html
<!DOCTYPE html>
<html lang="en">
    <head>
        <meta charset="UTF-8" />
        <title>404 - Not Found</title>
    </head>
    <body>
        <h1>404 - Page Not Found</h1>
        <p><%= message %></p>
    </body>
</html>
```

Now tie `notFound` and Section 3's `errorHandler` together with a barrel file,
`backend/src/middlewares/index.js`, so `app.js` can import both from one place:

```javascript
/**
 * Barrel file re-exporting every shared middleware.
 */
export {
    notFound
} from "./notFound.middleware.js";

export {
    errorHandler
} from "./errorHandler.middleware.js";
```

Finally, wire both into `app.js`:

```javascript
import {
    notFound,
    errorHandler
} from "./middlewares/index.js";

// ... all your routes go here ...

app.use(notFound);
app.use(errorHandler);
```

**Why order matters here, specifically:** Express processes middleware and routes **top to
bottom**, in the exact order you `app.use(...)` them. If a request reaches `notFound`, it means
none of the routes above matched — so it must come *after* every real route. `errorHandler` (four
arguments, from Section 3) must be the **very last** `app.use(...)` call in the file — it only
receives requests that were explicitly forwarded to it via `next(error)`, and `notFound` itself is
one way a request can end up needing it: if `404.ejs` ever failed to render, Express would forward
that render error straight into `errorHandler`.

## Putting it together

Here's the complete `backend/src/app.js` after every step above:

```javascript
/**
 * The Express app shell: security/body-parsing middleware, the EJS view
 * engine, static assets, routes, and finally the 404/error handlers that
 * must be registered last. `server.js` imports `app` from here and starts
 * listening on it.
 */

import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import helmet from "helmet";
import cookieParser from "cookie-parser";

import {
    notFound,
    errorHandler
} from "./middlewares/index.js";


const app = express();


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(helmet());
app.use(cookieParser());

app.use(express.json());
app.use(express.urlencoded({extended: true}));


app.get("/", (request, response) => {
    return response.status(200).render("pages/home", {
        success: true,
        title: "home",
        message: "rendering page"
    })
})
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "..", "..", "frontend", "views"));
app.use(express.static(path.join(__dirname, "..", "..", "frontend", "public")));

app.use(notFound);
app.use(errorHandler);

export { app };
```

**One thing worth noticing about the ordering above:** `app.set("view engine", ...)` and
`app.set("views", ...)` are registered *after* the `"/"` route that already relies on them. That's
fine — `app.set(...)` just stores a setting for later, and `response.render(...)` only reads that
setting at the moment a request actually comes in, not at the moment the route was defined. It
would *not* be fine to reorder actual request-handling middleware this loosely: `helmet()`,
`cookieParser()`, the body parsers, and `express.static(...)` all run *per request*, in the exact
order they're registered, so those genuinely need to come before anything that depends on them.

## Checkpoint

```bash
npm run dev
```

**Demonstration:**
- Visit `http://localhost:4000/` — you should see your rendered "Welcome to NSMQ Tricks" page, not
  raw HTML text and not `Cannot GET /`.
- Visit `http://localhost:4000/nonexistent-page` — you should get your 404 page (status `404`),
  not Express's default plain-text error.
- Open your browser's DevTools → Network tab, reload the page, and click the request for `/`.
  Check the Response Headers — you should see several new headers helmet added
  (`X-Content-Type-Options`, `X-Frame-Options`, and others), confirming it's active.

---

Next: [Section 6 — User Model & Auth Backend →](06-auth-backend.md)
