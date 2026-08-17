import sanitizeHtml from "sanitize-html";
import { notesRepository } from "../../repositories/notes.repository.js";
import { audit_logger } from "../../core/pino.logger.js";
import { normalizeValue } from "../../utils/string.utils.js";
import { BadRequestError } from "../../errors/badrequest.error.js";
import { NotFoundError } from "../../errors/notfound.error.js";
import { UnauthorizedError } from "../../errors/unauthorized.error.js";
import { adminActivityRepository } from "../../repositories/adminActivity.repository.js";
import { ADMIN_ACTIVITY_ACTIONS } from "../../models/admin/adminActivity.model.js";

const MAX_NOTE_CONTENT_LENGTH = 100000;

const sanitizeNoteContent = (value = "") => {
    const rawContent = String(value ?? "").trim();

    if (rawContent.length > MAX_NOTE_CONTENT_LENGTH) {
        throw new BadRequestError({
            message: `Content cannot be more than ${MAX_NOTE_CONTENT_LENGTH} characters`,
        });
    }

    return sanitizeHtml(rawContent, {
        allowedTags: [
            ...sanitizeHtml.defaults.allowedTags,

            "b",
            "strong",
            "i",
            "em",
            "u",
            "s",
            "span",
            "div",

            "h1",
            "h2",
            "h3",
            "h4",
            "h5",
            "h6",

            "br",
            "hr",
            "pre",
            "code",
            "blockquote",

            "ul",
            "ol",
            "li",

            "table",
            "thead",
            "tbody",
            "tfoot",
            "tr",
            "th",
            "td",
            "caption",
            "colgroup",
            "col",

            "a",
            "img",
            "sub",
            "sup",
        ],

        allowedAttributes: {
            "*": [
                "class",
                "style",
                "title",
                "id",
                "dir",
                "lang",
            ],

            a: [
                "href",
                "name",
                "target",
                "rel",
                "title",
            ],

            img: [
                "src",
                "alt",
                "title",
                "width",
                "height",
                "loading",
                "style",
                "class",
            ],

            table: [
                "border",
                "cellpadding",
                "cellspacing",
                "width",
                "height",
                "style",
                "class",
            ],

            th: [
                "colspan",
                "rowspan",
                "scope",
                "width",
                "height",
                "style",
                "class",
            ],

            td: [
                "colspan",
                "rowspan",
                "width",
                "height",
                "style",
                "class",
            ],

            col: [
                "span",
                "width",
                "style",
                "class",
            ],
        },

        allowedSchemes: [
            "http",
            "https",
            "mailto",
            "tel",
            "data",
        ],

        allowedSchemesByTag: {
            img: [
                "http",
                "https",
                "data",
            ],
        },

        allowedStyles: {
            "*": {
                color: [/^.*$/],
                "background-color": [/^.*$/],

                "font-family": [/^.*$/],
                "font-size": [/^.*$/],
                "font-weight": [/^.*$/],
                "font-style": [/^.*$/],

                "text-align": [/^left$/, /^center$/, /^right$/, /^justify$/],
                "text-decoration": [/^.*$/],
                "text-indent": [/^.*$/],
                "text-transform": [/^.*$/],

                "line-height": [/^.*$/],
                "letter-spacing": [/^.*$/],
                "word-spacing": [/^.*$/],

                margin: [/^.*$/],
                "margin-top": [/^.*$/],
                "margin-right": [/^.*$/],
                "margin-bottom": [/^.*$/],
                "margin-left": [/^.*$/],

                padding: [/^.*$/],
                "padding-top": [/^.*$/],
                "padding-right": [/^.*$/],
                "padding-bottom": [/^.*$/],
                "padding-left": [/^.*$/],

                border: [/^.*$/],
                "border-top": [/^.*$/],
                "border-right": [/^.*$/],
                "border-bottom": [/^.*$/],
                "border-left": [/^.*$/],
                "border-color": [/^.*$/],
                "border-style": [/^.*$/],
                "border-width": [/^.*$/],
                "border-collapse": [/^collapse$/, /^separate$/],
                "border-spacing": [/^.*$/],

                width: [/^.*$/],
                height: [/^.*$/],
                "max-width": [/^.*$/],
                "min-width": [/^.*$/],
                "max-height": [/^.*$/],
                "min-height": [/^.*$/],

                display: [/^.*$/],
                float: [/^left$/, /^right$/, /^none$/],
                clear: [/^.*$/],

                "vertical-align": [/^.*$/],
                "white-space": [/^.*$/],
            },
        },

        transformTags: {
            a: sanitizeHtml.simpleTransform("a", {
                rel: "noopener noreferrer",
            }),
        },
    }).trim();
};
const coerceBooleanField = (value) => {
    if (value === true || value === "true" || value === "on" || value === "1") {
        return true;
    }

    if (value === false || value === "false" || value === "off" || value === "0") {
        return false;
    }

    return false;
};

const coerceOrderNumber = (value, fieldName) => {
    const numberValue = Number(value ?? 0);

    if (!Number.isInteger(numberValue)) {
        throw new BadRequestError({ message: `${fieldName} must be a whole number` });
    }

    if (numberValue < 0) {
        throw new BadRequestError({ message: `${fieldName} cannot be negative` });
    }

    return numberValue;
};

const resolveId = (doc) => doc?.id ?? doc?._id ?? null;

const notesDefaultSort = {
    subject: 1,
    topicNumber: 1,
    topic: 1,
    subTopicNumber: 1,
    subTopic: 1,
    updatedAt: -1,
};

const buildNotesFilter = (filter = {}) => {
    const safeFilter = {};

    if (filter.isDeleted !== undefined) {
        safeFilter.isDeleted = filter.isDeleted;
    }

    if (filter.subject) {
        safeFilter.subject = normalizeValue(String(filter.subject));
    }

    if (filter.topic) {
        safeFilter.topic = normalizeValue(String(filter.topic));
    }

    if (filter.subTopic) {
        safeFilter.subTopic = normalizeValue(String(filter.subTopic));
    }

    if (filter.topicNumber !== undefined && filter.topicNumber !== "") {
        safeFilter.topicNumber = coerceOrderNumber(filter.topicNumber, "Topic number");
    }

    if (filter.subTopicNumber !== undefined && filter.subTopicNumber !== "") {
        safeFilter.subTopicNumber = coerceOrderNumber(filter.subTopicNumber, "Sub topic number");
    }

    if (filter.isPremium !== undefined && filter.isPremium !== "") {
        safeFilter.isPremium = coerceBooleanField(filter.isPremium);
    }

    return safeFilter;
};

const buildActiveNotesFilter = (filter = {}) => {
    return buildNotesFilter({
        ...filter,
        isDeleted: false,
    });
};

const buildAllNotesFilter = (filter = {}) => {
    return buildNotesFilter({
        ...filter,
        isDeleted: { $in: [true, false] },
    });
};

const buildDeletedNotesFilter = (filter = {}) => {
    return buildNotesFilter({
        ...filter,
        isDeleted: true,
    });
};

const getPagination = (result = {}) => {
    return {
        total: result.total ?? 0,
        page: result.page ?? 1,
        limit: result.limit ?? 10,
        totalPages: result.totalPages ?? 0,
    };
};

class NotesService {
    async createNote(payload = {}, userId, auditMeta = {}) {
        const subject = normalizeValue(String(payload?.subject ?? ""));
        const topic = normalizeValue(String(payload?.topic ?? ""));
        const subTopic = normalizeValue(String(payload?.subTopic ?? ""));
        const topicNumber = coerceOrderNumber(payload?.topicNumber, "Topic number");
        const subTopicNumber = coerceOrderNumber(payload?.subTopicNumber, "Sub topic number");
        const content = sanitizeNoteContent(payload?.content);
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
            topicNumber,
            subTopic,
            subTopicNumber,
            content,
            isPremium,
        });

        await adminActivityRepository.create({
            actorId: userId,
            targetNoteId: resolveId(note),
            action: ADMIN_ACTIVITY_ACTIONS.CREATE_NOTE,
            description: "Admin created a note",
            metadata: {
                subject,
                topic,
                topicNumber,
                subTopic,
                subTopicNumber,
                isPremium,
            },
            ...auditMeta,
        });

        audit_logger.info({
            userId,
            noteId: resolveId(note),
            ...auditMeta,
            message: `Note ${note.subTopic} under ${note.topic}-${note.subject} created`,
        });

        return {
            note,
            message: "Note successfully created",
        };
    }

    async getTotalActiveNotes(filter = {}, options = {}) {
        const activeNotesFilter = buildActiveNotesFilter(filter);
        const result = await notesRepository.count(activeNotesFilter, options);

        return {
            totalActiveNotes: result,
        };
    }

    async getAllActiveNotes(filter = {}, options = {}) {
        const activeNotesFilter = buildActiveNotesFilter(filter);

        const result = await notesRepository.findAll(activeNotesFilter, {
            sort: notesDefaultSort,
            ...options,
        });

        return {
            notes: result.docs ?? [],
            pagination: getPagination(result),
            message: result.docs?.length
                ? "Successfully retrieved active notes"
                : "No active notes found",
        };
    }

    async getTotalNotes(filter = {}, options = {}) {
        const allNotesFilter = buildAllNotesFilter(filter);
        const result = await notesRepository.count(allNotesFilter, options);

        return {
            totalNotes: result,
        };
    }

    async getAllNotes(filter = {}, options = {}) {
        const allNotesFilter = buildAllNotesFilter(filter);

        const result = await notesRepository.findAll(allNotesFilter, {
            sort: notesDefaultSort,
            ...options,
        });

        return {
            notes: result.docs ?? [],
            pagination: getPagination(result),
            message: result.docs?.length
                ? "Successfully retrieved notes"
                : "No notes found",
        };
    }

    async getTotalDeletedNotes(filter = {}, options = {}) {
        const deletedNotesFilter = buildDeletedNotesFilter(filter);
        const result = await notesRepository.count(deletedNotesFilter, options);

        return {
            totalDeletedNotes: result,
        };
    }

    async getAllDeletedNotes(filter = {}, options = {}) {
        const deletedNotesFilter = buildDeletedNotesFilter(filter);

        const result = await notesRepository.findAll(deletedNotesFilter, {
            sort: {
                subject: 1,
                topicNumber: 1,
                topic: 1,
                subTopicNumber: 1,
                subTopic: 1,
                deletedAt: -1,
            },
            ...options,
        });

        return {
            notes: result.docs ?? [],
            pagination: getPagination(result),
            message: result.docs?.length
                ? "Successfully retrieved deleted notes"
                : "No deleted notes found",
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

    async editNote(noteId, payload = {}, userId, options = {}, auditMeta = {}) {
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

        const shouldRequireOwnership = options.requireOwnership !== false;

        if (shouldRequireOwnership && String(existing.createdBy) !== String(userId)) {
            throw new UnauthorizedError({
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

        if (payload.topicNumber !== undefined) {
            updateData.topicNumber = coerceOrderNumber(payload.topicNumber, "Topic number");
        }

        if (payload.subTopic !== undefined) {
            const subTopic = normalizeValue(String(payload.subTopic ?? ""));
            if (!subTopic) throw new BadRequestError({ message: "SubTopic cannot be empty" });
            updateData.subTopic = subTopic;
        }

        if (payload.subTopicNumber !== undefined) {
            updateData.subTopicNumber = coerceOrderNumber(payload.subTopicNumber, "Sub topic number");
        }

        if (payload.content !== undefined) {
            const content = sanitizeNoteContent(payload.content);

            if (!content) {
                throw new BadRequestError({ message: "Content cannot be empty" });
            }

            updateData.content = content;
        }

        if (payload.isPremium !== undefined) {
            updateData.isPremium = coerceBooleanField(payload.isPremium);
        }

        if (!Object.keys(updateData).length) {
            throw new BadRequestError({ message: "No update data provided" });
        }

        updateData.updatedBy = userId;

        const note = await notesRepository.updateById(noteId, updateData, options);

        await adminActivityRepository.create({
            actorId: userId,
            targetNoteId: resolveId(note),
            action: ADMIN_ACTIVITY_ACTIONS.UPDATE_NOTE,
            description: "Admin updated a note",
            metadata: updateData,
            ...auditMeta,
        });

        audit_logger.info({
            userId,
            noteId: resolveId(note),
            ...auditMeta,
            message: `Note ${note.subTopic} updated`,
        });

        return {
            note,
            message: "Note successfully updated",
        };
    }

    async deleteNote(noteId, userId, options = {}, auditMeta = {}) {
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

        const shouldRequireOwnership = options.requireOwnership !== false;

        if (shouldRequireOwnership && String(note.createdBy) !== String(userId)) {
            throw new UnauthorizedError({
                message: "Not authorised to delete this note",
            });
        }

        await note.softDelete(userId);

        await adminActivityRepository.create({
            actorId: userId,
            targetNoteId: resolveId(note),
            action: ADMIN_ACTIVITY_ACTIONS.DELETE_NOTE,
            description: "Admin soft deleted a note",
            metadata: {
                deletedAt: note.deletedAt,
            },
            ...auditMeta,
        });

        audit_logger.info({
            userId,
            noteId: resolveId(note),
            ...auditMeta,
            message: "Note has been soft deleted",
        });

        return {
            note,
            message: "Note has been moved to deleted notes",
        };
    }

    async restoreNote(noteId, userId, options = {}, auditMeta = {}) {
        if (!noteId) {
            throw new BadRequestError({ message: "NoteId is required" });
        }

        if (!userId) {
            throw new BadRequestError({ message: "UserId is required" });
        }

        const note = await notesRepository.restoreById(
            noteId,
            {
                updatedBy: userId,
            },
            options
        );

        await adminActivityRepository.create({
            actorId: userId,
            targetNoteId: resolveId(note),
            action: ADMIN_ACTIVITY_ACTIONS.UPDATE_NOTE,
            description: "Admin restored a deleted note",
            metadata: {
                restoredAt: new Date(),
            },
            ...auditMeta,
        });

        audit_logger.info({
            userId,
            noteId: resolveId(note),
            ...auditMeta,
            message: "Note has been restored",
        });

        return {
            note,
            message: "Note successfully restored",
        };
    }

    async hardDeleteNote(noteId, userId, options = {}, auditMeta = {}) {
        if (!noteId) {
            throw new BadRequestError({ message: "NoteId is required" });
        }

        if (!userId) {
            throw new BadRequestError({ message: "UserId is required" });
        }

        const note = await notesRepository.hardDeleteById(noteId, options);

        await adminActivityRepository.create({
            actorId: userId,
            targetNoteId: resolveId(note),
            action: ADMIN_ACTIVITY_ACTIONS.DELETE_NOTE,
            description: "Admin permanently deleted a note",
            metadata: {
                subject: note.subject,
                topic: note.topic,
                topicNumber: note.topicNumber,
                subTopic: note.subTopic,
                subTopicNumber: note.subTopicNumber,
                permanentlyDeletedAt: new Date(),
            },
            ...auditMeta,
        });

        audit_logger.warn({
            userId,
            noteId: resolveId(note),
            subject: note.subject,
            topic: note.topic,
            topicNumber: note.topicNumber,
            subTopic: note.subTopic,
            subTopicNumber: note.subTopicNumber,
            ...auditMeta,
            message: "Note has been permanently deleted",
        });

        return {
            note,
            message: "Note permanently deleted",
        };
    }
}

const notesService = new NotesService();

export { notesService, NotesService };
export default notesService;