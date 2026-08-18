# Section 4 — The Base Model Pattern

[← Back to index](../README.md) · Previous: [Logging & Error Handling](03-logging-and-error-handling.md) · Next: [The Express App Shell →](05-app-shell.md)

## Why

This app has many models — `User`, `Note`, `Subscription`, and more. Every one of them needs the
same handful of things:

- "Soft delete" — when an admin deletes a user, you almost never want to *actually* erase it from
  the database (you lose the audit trail, and undoing a mistake becomes impossible). Instead you
  flag it `isDeleted: true` and just hide it from normal queries.
- A record of *who* did *what*, and *when* — who created this, who last updated it, who deleted or
  restored it, and why.
- Consistent JSON output — Mongoose documents have internal fields (`_id`, `__v`) that shouldn't
  leak to the frontend as-is.
- Consistent pagination — every "list" endpoint (users, notes, subscriptions, …) needs the same
  page/limit/total-count bookkeeping.

Writing that logic into every single model file would mean copy-pasting the same ~40 lines
repeatedly, and fixing a bug in it 10 times over. Instead, we write it **once**, as a function
that *builds* a schema, and every model calls that function instead of `new mongoose.Schema(...)`
directly.

```bash
npm install mongoose
```
(You already installed this in Section 1 — just confirming it's there.)

## Step 1 — Fields every model shares

Create `backend/src/models/base/auditFields.js`:

```javascript
import mongoose from "mongoose";

const { ObjectId } = mongoose.Schema.Types;

/** Reference to the User who performed an audit-tracked action, nullable until set. */
const fieldOptions = Object.freeze({
    type: ObjectId,
    ref: "User",
    default: null,
})

/** A nullable timestamp for an audit event (e.g. when a document was deleted or restored). */
const dateOptions = ({
    type: Date,
    default: null
})

/** A nullable free-text reason attached to an audit action. */
const reasonOptions = {
    type: String,
    default: null,
}

/** A boolean audit flag, defaulting to false. */
const booleanOptions = ({
    type: Boolean,
    default: false,
})

/**
 * Schema fields every soft-deletable, audit-tracked model shares: who
 * created/updated/deleted/restored a document, when, why, and whether it's
 * currently soft-deleted. Meant to be spread into a model's own schema
 * definition rather than used standalone.
 */
const auditFields = Object.freeze({
    createdBy: fieldOptions,
    updatedBy: fieldOptions,
    deletedBy: fieldOptions,
    restoredBy: fieldOptions,

    deletedAt: dateOptions,
    restoredAt: dateOptions,

    isDeleted: booleanOptions,

    restoreReason: reasonOptions,
    deleteReason: reasonOptions,
});

export {
    auditFields
}
```

**What this does:** `ObjectId, ref: "User"` means "this field stores another document's ID, and it
refers to the User collection" (so you can later `.populate("deletedBy")` and get the full user
object back, not just their ID). We'll `spread` this object into every model's own fields in
Step 4.

Notice the four shared shapes (`fieldOptions`, `dateOptions`, `reasonOptions`, `booleanOptions`)
factored out above `auditFields` itself: `createdBy`/`updatedBy`/`deletedBy`/`restoredBy` are all
*exactly* the same field definition (a nullable reference to a User), so it's written once and
reused four times instead of copy-pasted four times with room for one copy to drift. And notice the
fields come in **pairs**: it's not just "who deleted this and why"
(`deletedBy`/`deletedAt`/`deleteReason`) — there's a matching `restoredBy`/`restoredAt`/
`restoreReason` for the other direction. A soft-delete system without a symmetric "undo" trail can
tell you a document was deleted, but not who brought it back or why — worth having both from the
start rather than bolting restoration on later. `Object.freeze(...)` on `auditFields` matches the
pattern from Section 2's constants files: it's shared, read-only data, not something any individual
model should be able to mutate.

## Step 2 — Consistent JSON output

Mongoose documents aren't plain JSON by default — they carry an `_id` (an ObjectId, not a string),
a `__v` version key, and whatever else you told it to store. Create
`backend/src/models/base/mongoose.schema.options.js`:

```javascript
import { SENSITIVE_FIELDS } from "../../constants/index.js";
import { config } from "../../config/index.js";

/**
 * Mongoose `toJSON`/`toObject` transform shared by every model built on
 * this base. Turns a raw Mongoose document into clean, predictable output:
 * swaps `_id` for a plain string `id`, strips the internal `__v`, deletes
 * any field listed in `SENSITIVE_FIELDS`, and drops nullish or
 * blank-string fields so the frontend never sees MongoDB internals or
 * placeholder empties.
 *
 * @param {object} _document - The original Mongoose document (unused; required by Mongoose's transform signature).
 * @param {object} returnedObject - The plain object Mongoose is about to serialize, mutated in place.
 * @returns {object} The same object, cleaned up.
 */
const transformDocument = (_document, returnedObject) => {
    if(returnedObject._id){
        returnedObject.id = returnedObject._id.toString();
        delete returnedObject._id;
    }

    delete returnedObject.__v;

    for (const field of SENSITIVE_FIELDS){
        delete returnedObject[field];
    }

    for(const key in returnedObject){
        const value = returnedObject[key];

        if(
            value === null ||
            value === undefined ||
            (typeof value === "string" && value.trim() === "")
        ){
            delete returnedObject[key]
        }
    }

    return returnedObject
}

/**
 * Options passed to both `toJSON` and `toObject` so serialized output is
 * identical either way: include virtuals and getters, and run every
 * document through `transformDocument`.
 */
const serializationOptions = Object.freeze({
    virtuals: true,
    getters: true,
    transform: transformDocument,
})

/**
 * Base `mongoose.Schema` options every model in this app spreads into its
 * own schema — timestamps, strict validation, optimistic concurrency, and
 * consistent serialization — so each model only has to declare what makes
 * it unique.
 */
const mongooseSchemaOptions = Object.freeze({
    timestamps: true,
    id: false,
    strict: true,
    strictQuery: true,
    minimize: false,
    optimisticConcurrency: true,
    autoIndex: config.nodeEnv === "development",
    toJSON: serializationOptions,
    toObject: serializationOptions,
})

export {
    mongooseSchemaOptions,
    transformDocument
}
```

**What this does:**

- `timestamps: true` — Mongoose automatically adds and maintains `createdAt`/`updatedAt` on every
  document. You never set these yourself.
- `id: false`, but `getters: true` — Mongoose's own virtual `id` getter is turned *off*, since
  `transformDocument` already builds a clean `id` field by hand above; `getters: true` still makes
  sure any *other* getters defined on a model's own schema fields run during serialization.
- `strict: true` / `strictQuery: true` — reject fields that aren't declared in the schema, both on
  writes (`strict`) and on query filters (`strictQuery`), instead of silently accepting a typo'd
  field name and doing nothing with it.
- `optimisticConcurrency: true` — adds a hidden version check so two concurrent updates to the same
  document don't silently clobber each other; the second save fails instead of overwriting.
- `autoIndex: config.nodeEnv === "development"` — Mongoose can automatically build database indexes
  every time it connects. Convenient in development, but on a real production database with
  existing data, rebuilding indexes on every restart is slow and unnecessary — so it's only
  enabled in development.
- `transformDocument` runs every time a document is converted to JSON (which happens automatically
  when you `response.json(someDocument)`). It swaps the MongoDB-flavored `_id` for a plain string
  `id`, strips the internal `__v`, deletes anything listed in `SENSITIVE_FIELDS` (Section 3's log
  redaction list, reused here so a field like `password` can never leak into an API response
  either), and drops empty fields — so what the frontend receives is clean, predictable JSON.
- `transformDocument` is exported alongside `mongooseSchemaOptions`, not kept private to this file
  — useful if another file ever needs to run the same cleanup logic outside a `toJSON` call (in a
  test, for instance) without duplicating it.

**Demonstration:** without this transform, `JSON.stringify(user)` would include
`"_id": { "$oid": "..." }` and `"__v": 0`. With it, you get `"id": "68f1a2..."` and no `__v`,
`password`, or empty fields at all — much easier for frontend code (and humans) to work with.

## Step 3 — Soft-delete, restore, and pagination helpers

The schema factory in Step 4 will need three behaviors that don't belong *inside* the factory
function itself — they're plain, testable operations on a document or a model, not schema-building
logic. Pulling them into their own files keeps `mongoose.schema.js` focused on wiring, and makes
each behavior independently readable (and testable) on its own.

Create `backend/src/models/base/helpers/softDelete.helper.js`:

```javascript
/**
 * Soft-deletes a document by flipping isDeleted and recording who/when/why,
 * then persists the change. No-ops (returns the document as-is) if it's
 * already deleted.
 * @param {object} options
 * @param {import("mongoose").Document} options.document - The document to soft-delete.
 * @param {string|import("mongoose").Types.ObjectId} [options.deletedByUserId] - User performing the deletion.
 * @param {string} [options.reason] - Optional justification for the deletion.
 * @param {import("mongoose").ClientSession} [options.session] - Transaction session, if any.
 * @returns {Promise<import("mongoose").Document>} The saved (or already-deleted) document.
 */
const softDeleteDocument = async({
    document,
    deletedByUserId = null,
    reason = null,
    session = null
} = {}) => {
    if(document.isDeleted){
        return document
    }

    document.isDeleted = true;
    document.deletedBy = deletedByUserId;
    document.deletedAt = new Date();
    document.deleteReason = reason;

    return document.save({
        session,
        validateBeforeSave: false
    })
}

export {
    softDeleteDocument,
}
```

Create `backend/src/models/base/helpers/restore.helper.js`:

```javascript
/**
 * Restores a soft-deleted document by clearing the delete fields and
 * recording who/when/why it was restored, then persists the change.
 * No-ops (returns the document as-is) if it isn't currently deleted.
 * @param {object} options
 * @param {import("mongoose").Document} options.document - The document to restore.
 * @param {string|import("mongoose").Types.ObjectId} [options.restoredByUserId] - User performing the restore.
 * @param {string} [options.reason] - Optional justification for the restore.
 * @param {import("mongoose").ClientSession} [options.session] - Transaction session, if any.
 * @returns {Promise<import("mongoose").Document>} The saved (or already-restored) document.
 */
const restoreDocument = async ({
    document,
    restoredByUserId = null,
    reason = null,
    session = null
} = {}) => {
    if(!document.isDeleted){
        return document;
    }

    document.isDeleted = false;
    document.deletedBy = null;
    document.deletedAt = null;
    document.deleteReason = null;

    document.restoredAt = new Date();
    document.restoredBy = restoredByUserId;
    document.restoreReason = reason;

    return document.save({
        session,
        validateBeforeSave: false
    })
}

export {
    restoreDocument,
}
```

Create `backend/src/models/base/helpers/pagination.helper.js`:

```javascript
const DEFAULT_PAGE_SIZE = 20;
const DEFAULT_MAX_LIMIT = 100;

/**
 * Safe own-property check, immune to a missing/shadowed hasOwnProperty on object.
 * @param {object} object - Object to check.
 * @param {string} key - Property name to look for.
 * @returns {boolean}
 */
const hasOwn = (object, key) =>
    Object.prototype.hasOwnProperty.call(object, key);


/**
 * Defaults every paginated read to isDeleted: false — the single place
 * this rule is enforced, instead of every list service having to remember
 * it. A caller that genuinely wants deleted documents (an admin "trash"
 * view) opts out by passing isDeleted explicitly in `filter`.
 * @param {object} options
 * @param {import("mongoose").Model} options.model - The Mongoose model to query.
 * @param {object} [options.filter={}] - Extra query conditions.
 * @param {object|string|null} [options.projection=null] - Fields to select.
 * @param {number} [options.page=1] - 1-indexed page number.
 * @param {number} [options.limit=DEFAULT_PAGE_SIZE] - Page size, clamped to DEFAULT_MAX_LIMIT.
 * @param {object} [options.options={}] - sort/populate/lean plus any raw Mongoose query options.
 * @param {import("mongoose").ClientSession} [options.session] - Transaction session, if any.
 * @returns {Promise<{data: object[], page: number, limit: number, total: number, totalPages: number, hasNextPage: boolean, hasPreviousPage: boolean}>}
 */
const paginateCollection = async({
    model,
    filter = {},
    projection = null,
    page = 1,
    limit = DEFAULT_PAGE_SIZE,
    options = {},
    session = null
} = {}) => {
    const safePage = Math.max(1, Number(page) || 1);
    const requestedLimit = Math.max(1, Number(limit) || DEFAULT_PAGE_SIZE);

    const safeLimit = Math.min(requestedLimit, DEFAULT_MAX_LIMIT);

    const skip = (safePage - 1) * safeLimit;

    const finalFilter = hasOwn(filter, "isDeleted")
        ? filter
        : {...filter, isDeleted: false};

    const { sort, populate, lean, ...queryOptions} = options;

    let query = model.find(finalFilter, projection).setOptions(queryOptions);

    if(session){
        query = query.session(session);
    }

    if(sort){
        query = query.sort(sort);
    }

    query = query.skip(skip).limit(safeLimit);

    if(populate){
        query = query.populate(populate);
    }

    if(lean === true){
        query = query.lean();
    }

    let countQuery = model.countDocuments(finalFilter);

    if(session){
        countQuery = countQuery.session(session);
    }

    const [data, total] = await Promise.all([
        query.exec(),
        countQuery.exec()
    ]);

    return {
        data,
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.max(1, Math.ceil(total / safeLimit)),
        hasNextPage: safePage * safeLimit < total,
        hasPreviousPage: safePage > 1,
    };
};

export { paginateCollection };
```

Create `backend/src/models/base/helpers/index.js` to tie them together:

```javascript
/**
 * Barrel for shared model-level helpers: soft-delete/restore lifecycle
 * operations and collection pagination.
 */
export { softDeleteDocument } from "./softDelete.helper.js";
export { restoreDocument } from "./restore.helper.js";
export { paginateCollection } from "./pagination.helper.js";
```

**What this does:** each helper takes the *document* (or *model*) it operates on as a parameter,
rather than being a method glued directly onto a schema — that's a deliberate separation. Step 4's
`createSchema` will eventually wire these up as `.softDelete()`/`.restore()` instance methods and a
`.paginate()` static, but the underlying logic here has no idea Mongoose schemas exist; it just
takes a document/model and does the work. That makes each one straightforward to unit test in
isolation, without spinning up a real schema or database connection.

A few details worth noticing:

- Both `softDeleteDocument` and `restoreDocument` **no-op** if the document is already in the
  target state (`document.isDeleted` already `true`/`false`) — calling `.softDelete()` twice in a
  row doesn't overwrite a real `deletedAt` timestamp with a new one, and doesn't touch `deletedBy`
  either.
- Both call `document.save({ session, validateBeforeSave: false })`. Skipping validation here
  matters: if a document has an existing validation error unrelated to soft-delete (say, a
  required field left over from a partial migration), you still want to be *able* to soft-delete
  or restore it — an admin "hide this broken record" action shouldn't be blocked by an unrelated
  validation bug. And forwarding `session` matters just as much: if a caller is running this
  inside a database transaction and that argument gets silently dropped, the save happens
  *outside* the transaction — worth double-checking whenever you write a `.save({...})` call that
  accepts a session parameter.
- `restoreDocument` clears `deleteReason` back to `null` rather than reusing it for anything —
  the *restore* reason belongs in `restoreReason`, not overwriting the record of why the document
  was deleted in the first place. Keeping the two fields distinct is what makes the audit trail
  useful later: you can tell *both* stories (why it was removed, and why it came back).
- `paginateCollection` defaults every query to `isDeleted: false`, and only lets a caller see
  deleted documents if they *explicitly* pass `isDeleted` in `filter` — the same "invisible by
  default, opt-in to see deleted" rule you'll see again once soft-delete is wired into query hooks.
- Page and limit are clamped with `Math.max(1, ...)`, not `Math.min(1, ...)` — worth pausing on
  why. The goal is a *floor*: a page or limit below 1 should be corrected *up* to 1, not down.
  `Math.min(1, requestedValue)` does the opposite — it can never produce anything *above* 1, so a
  legitimate `page: 5` would be silently crushed down to `1`. `Math.max` is what actually enforces
  "at least 1."
- `.lean()` is opt-in, not opt-out: by default Mongoose documents come back as full Mongoose
  documents so `toJSON`'s `transformDocument` still applies. Set `options.lean = true` explicitly
  once you've confirmed a particular list endpoint doesn't need that cleanup (lean documents are
  faster, since Mongoose skips wrapping them in document instances).

## Step 4 — The schema factory itself

This is the piece that ties everything above together. Create
`backend/src/models/base/mongoose.schema.js`:

```javascript
import mongoose from "mongoose";

import {
    softDeleteDocument,
    restoreDocument,
    paginateCollection,
} from "./helpers/index.js";

import {
    mongooseSchemaOptions
} from "./mongoose.schema.options.js";

import { auditFields } from "./auditFields.js";

const createSchema = (schemaDefinitions, options) => {
    const schema = new mongoose.Schema(
        {
            ...schemaDefinitions,
            ...auditFields,
        },
        {
            ...mongooseSchemaOptions,
            ...options
        }
    )

    return schema;
}

export {
    createSchema
}
```

**Where this stands right now, honestly:** this is the *starting point* of the factory, not the
finished version — worth calling out explicitly rather than pretending otherwise. `createSchema`
currently does exactly one thing: merge a model's own field definitions with the shared
`auditFields` from Step 1, and merge any schema-specific options over the shared
`mongooseSchemaOptions` from Step 2. That alone is already useful — every model built with it gets
consistent audit fields and serialization for free, without repeating Step 1/2's setup in every
model file.

What it *doesn't* do yet: `softDeleteDocument`, `restoreDocument`, and `paginateCollection` are
imported at the top, ready to be reached for, but nothing in the function body calls them. There's
no `schema.pre(/^find/, ...)` hook hiding soft-deleted documents by default, and no
`schema.methods.softDelete`/`.restore()`/`.statics.paginate` wiring them onto the schema. That's
the next piece to build: taking each helper from Step 3 and attaching it to `schema` the same way
you'd expect from the "Why" section at the top of this document — but it isn't there yet, and this
tutorial won't claim it is.

## Checkpoint — prove what's built so far actually works

Since `createSchema` doesn't attach `.softDelete()`/`.restore()`/`.paginate()` to a model yet,
today's checkpoint proves two separate things instead: that the schema factory correctly merges
audit fields and options, and that the Step 3 helpers work correctly *on their own*, ready to be
wired in later.

Create a temporary `backend/src/models/base/_scratch.js`:

```javascript
import mongoose from "mongoose";
import { createSchema } from "./mongoose.schema.js";
import { softDeleteDocument, restoreDocument } from "./helpers/index.js";

const scratchSchema = createSchema({ name: { type: String, required: true } });
const Scratch = mongoose.model("Scratch", scratchSchema);

export { Scratch, softDeleteDocument, restoreDocument };
```

Then, in a Node REPL or a temporary script (with your dev server's database connection already
open), try:

```javascript
const doc = await Scratch.create({ name: "Test" });
console.log(doc.toJSON());
// { id: '...', name: 'Test', createdAt: ..., updatedAt: ..., isDeleted: false }
// -- audit fields and clean serialization both came from createSchema, with zero
// extra code in this scratch model.

await softDeleteDocument({ document: doc, deletedByUserId: null, reason: "testing" });
console.log(doc.isDeleted, doc.deletedAt, doc.deleteReason);
// true <Date> "testing" -- the helper works standalone; it just isn't yet reachable
// as doc.softDelete() the way the "Why" section describes.

await restoreDocument({ document: doc, restoredByUserId: null, reason: "undo" });
console.log(doc.isDeleted, doc.deleteReason, doc.restoreReason);
// false null "undo" -- deleteReason is cleared, restoreReason is set — the two
// stay independent instead of one overwriting the other.
```

Delete `_scratch.js` once you've confirmed this behaves as expected. Wiring these helpers directly
onto the schema — so a real model can just call `someDoc.softDelete()` — is the next step in
building out this pattern.

---

Next: [Section 5 — The Express App Shell →](05-app-shell.md)
