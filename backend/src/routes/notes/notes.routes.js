import express from "express";
import { notesController } from "../../controllers/notes/notes.controller.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";

const notesRouter = express.Router();

/**
 * ---------------------------------------------------------
 * NOTES ROUTES (EJS FRIENDLY + CLEAN NAMING)
 * ---------------------------------------------------------
 */

// Pages
notesRouter.get("/notes", authMiddleware, notesController.getAllNotes);
notesRouter.get("/notes/create", authMiddleware, notesController.getCreateNotesPage);

// Create
notesRouter.post("/notes", authMiddleware, notesController.createNote);

// Single + Edit pages
notesRouter.get("/notes/:noteId", authMiddleware, notesController.getSingleNote);
notesRouter.get("/notes/:noteId/edit", authMiddleware, notesController.getEditNotePage);

// Actions (clear naming)
notesRouter.post("/notes/:noteId/update", authMiddleware, notesController.updateNote);
notesRouter.post("/notes/:noteId/remove", authMiddleware, notesController.deleteNote);

export { notesRouter };
export default notesRouter;