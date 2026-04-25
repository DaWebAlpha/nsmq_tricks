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









/*

<%- include("../partials/header", { title }) %>

<main>

    <!-- ============================= -->
    <!-- FLASH MESSAGES -->
    <!-- ============================= -->
    <% if (success) { %>
        <div class="alert success"><%= success %></div>
    <% } %>

    <% if (error) { %>
        <div class="alert error"><%= error %></div>
    <% } %>


    <!-- ============================= -->
    <!-- CREATE NOTE -->
    <!-- ============================= -->
    <% if (title === "Create Notes") { %>
        <h2>Create Note</h2>

        <form action="/notes" method="POST">
            <input type="text" name="subject" placeholder="Subject" value="<%= oldInput.subject %>" required />
            <input type="text" name="topic" placeholder="Topic" value="<%= oldInput.topic %>" required />
            <input type="text" name="subTopic" placeholder="Sub Topic" value="<%= oldInput.subTopic %>" required />

            <textarea name="content" placeholder="Content" required><%= oldInput.content %></textarea>

            <label>
                <input type="checkbox" name="isPremium" <%= oldInput.isPremium ? "checked" : "" %> />
                Premium
            </label>

            <button type="submit">Create Note</button>
        </form>
    <% } %>


    <!-- ============================= -->
    <!-- EDIT NOTE -->
    <!-- ============================= -->
    <% if (title === "Edit Note") { %>
        <h2>Edit Note</h2>

        <form action="/notes/<%= noteId %>/update" method="POST">
            <input type="text" name="subject" value="<%= oldInput.subject %>" required />
            <input type="text" name="topic" value="<%= oldInput.topic %>" required />
            <input type="text" name="subTopic" value="<%= oldInput.subTopic %>" required />

            <textarea name="content" required><%= oldInput.content %></textarea>

            <label>
                <input type="checkbox" name="isPremium" <%= oldInput.isPremium ? "checked" : "" %> />
                Premium
            </label>

            <button type="submit">Update Note</button>
        </form>
    <% } %>


    <!-- ============================= -->
    <!-- VIEW SINGLE NOTE -->
    <!-- ============================= -->
    <% if (title === "View Note" && note) { %>
        <h2>View Note</h2>

        <div class="card">
            <p><strong>Subject:</strong> <%= note.subject %></p>
            <p><strong>Topic:</strong> <%= note.topic %></p>
            <p><strong>SubTopic:</strong> <%= note.subTopic %></p>
            <p><strong>Content:</strong></p>
            <p><%= note.content %></p>
        </div>

        <a href="/notes/<%= noteId %>/edit">Edit</a>

        <form action="/notes/<%= noteId %>/remove" method="POST" style="display:inline;">
            <button type="submit">Delete</button>
        </form>
    <% } %>


    <!-- ============================= -->
    <!-- ALL NOTES LIST -->
    <!-- ============================= -->
    <% if (title === "Manage Notes") { %>
        <h2>All Notes</h2>

        <a href="/notes/create">Create New Note</a>

        <% if (notes.length === 0) { %>
            <p>No notes available</p>
        <% } %>

        <% notes.forEach(note => { %>
            <div class="card">
                <h3><%= note.topic %></h3>
                <p><%= note.subTopic %></p>

                <a href="/notes/<%= note.id %>">View</a>
                <a href="/notes/<%= note.id %>/edit">Edit</a>

                <form action="/notes/<%= note.id %>/remove" method="POST" style="display:inline;">
                    <button type="submit">Delete</button>
                </form>
            </div>
        <% }) %>
    <% } %>

</main>

<%- include("../partials/footer") %>
*/