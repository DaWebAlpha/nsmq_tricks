import { BaseRepository } from "./base.repository.js";
import { Note } from "../models/notes.js"
class NotesRepository extends BaseRepository{
    constructor(){
        super(Note);
    }
}

const notesRepository = new NotesRepository();
export { notesRepository, NotesRepository };
export default notesRepository;