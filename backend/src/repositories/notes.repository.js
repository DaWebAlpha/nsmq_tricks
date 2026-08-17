import { BaseRepository } from "./base.repository.js";
import { Note } from "../models/notes.js";
import { NotFoundError } from "../errors/notfound.error.js";

class NotesRepository extends BaseRepository {
    constructor() {
        super(Note);
    }

    async restoreById(id, data = {}, options = {}) {
        const { session, populate, select, lean = false } = options;

        const query = this.model.findOneAndUpdate(
            {
                _id: id,
                isDeleted: true,
            },
            {
                $set: {
                    isDeleted: false,
                    deletedAt: null,
                    deletedBy: null,
                    ...data,
                },
            },
            {
                new: true,
                runValidators: true,
                session,
            }
        );

        if (populate) query.populate(populate);
        if (select) query.select(select);
        if (lean === true) query.lean();

        const doc = await query;

        if (!doc) {
            throw new NotFoundError({
                message: `${this.modelName} with id ${id} not found in deleted notes`,
            });
        }

        return lean === true
            ? this._transformLean(doc)
            : this._normalizeDoc(doc);
    }

    async hardDeleteById(id, options = {}) {
        const { session } = options;

        const doc = await this.model.findOneAndDelete(
            {
                _id: id,
                isDeleted: true,
            },
            {
                session,
            }
        );

        if (!doc) {
            throw new NotFoundError({
                message: `${this.modelName} with id ${id} not found in deleted notes`,
            });
        }

        return this._normalizeDoc(doc);
    }
}

const notesRepository = new NotesRepository();

export { notesRepository, NotesRepository };
export default notesRepository;