import { notesService } from "../../services/notes/notes.service.js";
import { autoCatchFn } from "../../utils/autoCatchFn.js";
import { getAdminAuditMeta } from "../../utils/admin.audit.js";

const getUserId = (request) => {
    return request.user?.id ?? request.user?._id;
};

const getOldInput = (body = {}) => {
    return {
        subject: body.subject ?? "",
        topic: body.topic ?? "",
        subTopic: body.subTopic ?? "",
        content: body.content ?? "",
        isPremium: body.isPremium ?? "",
    };
};

const getNoteOldInput = (note = {}) => {
    return {
        subject: note.subject ?? "",
        topic: note.topic ?? "",
        subTopic: note.subTopic ?? "",
        content: note.content ?? "",
        isPremium: note.isPremium ?? "",
    };
};

const renderNotesPage = (response, data = {}) => {
    return response.status(data.statusCode ?? 200).render("pages/admin/notes", {
        title: data.title ?? "Notes",
        success: data.success ?? false,
        error: data.error ?? false,
        notes: data.notes ?? [],
        note: data.note ?? null,
        noteId: data.noteId ?? data.note?._id ?? data.note?.id ?? null,
        pagination: data.pagination ?? null,
        oldInput: data.oldInput ?? getOldInput(),
        filters: data.filters ?? {},
        totalActiveNotes: data.totalActiveNotes ?? 0,
        totalNotes: data.totalNotes ?? 0,
        totalDeletedNotes: data.totalDeletedNotes ?? 0,
    });
};

class NotesController {
    getAllActiveNotes = autoCatchFn(async (request, response) => {
        const { page, limit, subject, topic, subTopic, isPremium } = request.query;

        const result = await notesService.getAllActiveNotes(
            { subject, topic, subTopic, isPremium },
            { page, limit }
        );

        return renderNotesPage(response, {
            title: "Active Notes",
            success: request.flash?.("success")?.[0] ?? false,
            error: request.flash?.("error")?.[0] ?? false,
            notes: result.notes,
            pagination: result.pagination,
            filters: request.query,
        });
    });

    getAllNotes = autoCatchFn(async (request, response) => {
        const { page, limit, subject, topic, subTopic, isPremium } = request.query;

        const result = await notesService.getAllNotes(
            { subject, topic, subTopic, isPremium },
            { page, limit }
        );

        return renderNotesPage(response, {
            title: "Manage Notes",
            success: request.flash?.("success")?.[0] ?? false,
            error: request.flash?.("error")?.[0] ?? false,
            notes: result.notes,
            pagination: result.pagination,
            filters: request.query,
        });
    });

    getAllDeletedNotes = autoCatchFn(async (request, response) => {
        const { page, limit, subject, topic, subTopic, isPremium } = request.query;

        const result = await notesService.getAllDeletedNotes(
            { subject, topic, subTopic, isPremium },
            { page, limit }
        );

        return renderNotesPage(response, {
            title: "Deleted Notes",
            success: request.flash?.("success")?.[0] ?? false,
            error: request.flash?.("error")?.[0] ?? false,
            notes: result.notes,
            pagination: result.pagination,
            filters: request.query,
        });
    });

    getCreateNotesPage = autoCatchFn(async (request, response) => {
        return renderNotesPage(response, {
            title: "Create Notes",
            success: request.flash?.("success")?.[0] ?? false,
            error: request.flash?.("error")?.[0] ?? false,
        });
    });

    createNote = autoCatchFn(async (request, response) => {
        try {
            const userId = getUserId(request);

            const result = await notesService.createNote(
                request.body,
                userId,
                getAdminAuditMeta(request)
            );

            request.flash?.("success", result.message);

            return response.redirect("/admin/notes");
        } catch (error) {
            return renderNotesPage(response, {
                statusCode: error.statusCode ?? 400,
                title: "Create Notes",
                error: error?.message ?? "Note creation failed",
                oldInput: getOldInput(request.body),
            });
        }
    });

    getSingleNote = autoCatchFn(async (request, response) => {
        const { noteId } = request.params;

        const result = await notesService.getSingleNote(noteId);

        return renderNotesPage(response, {
            title: "View Note",
            success: request.flash?.("success")?.[0] ?? false,
            error: request.flash?.("error")?.[0] ?? false,
            note: result.note,
            noteId,
        });
    });

    getEditNotePage = autoCatchFn(async (request, response) => {
        const { noteId } = request.params;

        const result = await notesService.getSingleNote(noteId);

        return renderNotesPage(response, {
            title: "Edit Note",
            success: request.flash?.("success")?.[0] ?? false,
            error: request.flash?.("error")?.[0] ?? false,
            note: result.note,
            noteId,
            oldInput: getNoteOldInput(result.note),
        });
    });

    updateNote = autoCatchFn(async (request, response) => {
        try {
            const { noteId } = request.params;
            const userId = getUserId(request);

            const result = await notesService.editNote(
                noteId,
                request.body,
                userId,
                {
                    requireOwnership: false,
                },
                getAdminAuditMeta(request)
            );

            request.flash?.("success", result.message);

            return response.redirect("/admin/notes");
        } catch (error) {
            return renderNotesPage(response, {
                statusCode: error.statusCode ?? 400,
                title: "Edit Note",
                error: error?.message ?? "Note update failed",
                oldInput: getOldInput(request.body),
                noteId: request.params.noteId,
            });
        }
    });

    deleteNote = autoCatchFn(async (request, response) => {
        try {
            const { noteId } = request.params;
            const userId = getUserId(request);

            const result = await notesService.deleteNote(
                noteId,
                userId,
                {
                    requireOwnership: false,
                },
                getAdminAuditMeta(request)
            );

            request.flash?.("success", result.message);

            return response.redirect("/admin/notes");
        } catch (error) {
            request.flash?.("error", error?.message ?? "Note delete failed");

            return response.redirect("/admin/notes");
        }
    });
}

const notesController = new NotesController();

export { notesController, NotesController };
export default notesController;