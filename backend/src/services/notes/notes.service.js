import { notesRepository } from "../../repositories/notes.repository.js";
import { audit_logger } from "../../core/pino.logger.js";
import { normalizeValue } from "../../utils/string.utils.js";
import { BadRequestError } from "../../errors/badrequest.error.js";
import { NotFoundError } from "../../errors/notfound.error.js";
import { ForbiddenError } from "../../errors/forbidden.error.js";

const coerceBooleanField = (value) => {
    return value === "on" || value === true || value === "true";
};

const buildNotesFilter = (filter = {}) => {
    const safeFilter = {
        isDeleted: false,
    };

    if (filter.subject) {
        safeFilter.subject = normalizeValue(String(filter.subject));
    }

    if (filter.topic) {
        safeFilter.topic = normalizeValue(String(filter.topic));
    }

    if (filter.subTopic) {
        safeFilter.subTopic = normalizeValue(String(filter.subTopic));
    }

    if (filter.isPremium !== undefined && filter.isPremium !== "") {
        safeFilter.isPremium = coerceBooleanField(filter.isPremium);
    }

    return safeFilter;
};

class NotesService {
    async createNote(payload = {}, userId) {
        const subject = normalizeValue(String(payload?.subject ?? ""));
        const topic = normalizeValue(String(payload?.topic ?? ""));
        const subTopic = normalizeValue(String(payload?.subTopic ?? ""));
        const content = normalizeValue(String(payload?.content ?? ""), {
            maxLength: 15000,
        });
        const isPremium = coerceBooleanField(payload?.isPremium);

        if (!userId) throw new BadRequestError({ message: "UserId is required" });
        if (!subject) throw new BadRequestError({ message: "Subject is required" });
        if (!topic) throw new BadRequestError({ message: "Topic is required" });
        if (!subTopic) throw new BadRequestError({ message: "SubTopic is required" });
        if (!content) throw new BadRequestError({ message: "Content is required" });

        const note = await notesRepository.create({
            createdBy: userId,
            subject,
            topic,
            subTopic,
            content,
            isPremium,
        });

        audit_logger.info({
            userId,
            noteId: note.id ?? note._id,
            message: `Note ${note.subTopic} under ${note.topic}-${note.subject} created`,
        });

        return {
            note,
            message: "Note successfully created",
        };
    }

    async getAllNotes(filter = {}, options = {}) {
        const safeFilter = buildNotesFilter(filter);

        const result = await notesRepository.findAll(safeFilter, options);

        return {
            notes: result.docs ?? [],
            pagination: {
                total: result.total ?? 0,
                page: result.page ?? 1,
                limit: result.limit ?? 10,
                totalPages: result.totalPages ?? 0,
            },
            message: result.docs?.length
                ? "Successfully retrieved notes"
                : "No notes found",
        };
    }

    async getSingleNote(noteId, options = {}) {
        if (!noteId) {
            throw new BadRequestError({ message: "Note id is required" });
        }

        const note = await notesRepository.findById(noteId, options);

        if (!note) {
            throw new NotFoundError({ message: "Note not found" });
        }

        return {
            note,
            message: "Note successfully retrieved",
        };
    }

    async editNote(noteId, payload = {}, userId, options = {}) {
        if (!noteId) {
            throw new BadRequestError({ message: "Note id is required" });
        }

        if (!userId) {
            throw new BadRequestError({ message: "UserId is required" });
        }

        const existing = await notesRepository.findById(noteId);

        if (!existing) {
            throw new NotFoundError({ message: "Note not found" });
        }

        if (String(existing.createdBy) !== String(userId)) {
            throw new ForbiddenError({
                message: "Not authorised to edit this note",
            });
        }

        const updateData = {};

        if (payload.subject !== undefined) {
            const subject = normalizeValue(String(payload.subject ?? ""));
            if (!subject) throw new BadRequestError({ message: "Subject cannot be empty" });
            updateData.subject = subject;
        }

        if (payload.topic !== undefined) {
            const topic = normalizeValue(String(payload.topic ?? ""));
            if (!topic) throw new BadRequestError({ message: "Topic cannot be empty" });
            updateData.topic = topic;
        }

        if (payload.subTopic !== undefined) {
            const subTopic = normalizeValue(String(payload.subTopic ?? ""));
            if (!subTopic) throw new BadRequestError({ message: "SubTopic cannot be empty" });
            updateData.subTopic = subTopic;
        }

        if (payload.content !== undefined) {
            const content = normalizeValue(String(payload.content ?? ""), {
                maxLength: 15000,
            });
            if (!content) throw new BadRequestError({ message: "Content cannot be empty" });
            updateData.content = content;
        }

        if (payload.isPremium !== undefined) {
            updateData.isPremium = coerceBooleanField(payload.isPremium);
        }

        if (!Object.keys(updateData).length) {
            throw new BadRequestError({ message: "No update data provided" });
        }

        updateData.updatedBy = userId;

        const note = await notesRepository.updateById(
            noteId,
            updateData,
            options
        );

        audit_logger.info({
            userId,
            noteId: note.id ?? note._id,
            message: `Note ${note.subTopic} updated`,
        });

        return {
            note,
            message: "Note successfully updated",
        };
    }

    async deleteNote(noteId, userId) {
        if (!noteId) {
            throw new BadRequestError({ message: "NoteId is required" });
        }

        if (!userId) {
            throw new BadRequestError({ message: "UserId is required" });
        }

        const note = await notesRepository.findById(noteId, {
            lean: false,
        });

        if (!note) {
            throw new NotFoundError({ message: "Note not found" });
        }

        if (String(note.createdBy) !== String(userId)) {
            throw new ForbiddenError({
                message: "Not authorised to delete this note",
            });
        }

        await note.softDelete(userId);

        audit_logger.info({
            userId,
            noteId: note.id ?? note._id,
            message: "Note has been soft deleted",
        });

        return {
            note,
            message: "Note has been deleted",
        };
    }
}

const notesService = new NotesService();

export { notesService };