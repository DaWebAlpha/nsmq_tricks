import mongoose from "mongoose";
import { createBaseModel } from "./mongoose.model.base.js";
import { SUBJECTS } from "../utils/subjects.js";

const notesSchemaDefinition = {
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },

    subject: {
        type: String,
        enum: SUBJECTS,
        trim: true,
        lowercase: true,
        required: true,
    },

    topic: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        minlength: [2, "Topic is too short"],
        maxlength: [120, "Topic is too long"],
        validate: {
            validator: (val) => val.trim().length >= 2,
            message: "Topic cannot be whitespace only",
        },
    },

    topicNumber: {
        type: Number,
        default: 0,
        required: [true, "Topic number is required"],
        min: [0, "Topic number cannot be negative"],
    },

    subTopic: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        minlength: [2, "Sub topic is too short"],
        maxlength: [120, "Sub topic is too long"],
        validate: {
            validator: (val) => val.trim().length >= 2,
            message: "Sub topic cannot be whitespace only",
        },
    },

    subTopicNumber: {
        type: Number,
        default: 0,
        required: [true, "Sub topic number is required"],
        min: [0, "Sub topic number cannot be negative"],
    },

    content: {
        type: String,
        required: true,
        trim: true,
        minlength: [30, "Content is too short"],
        maxlength: [100000, "Content is too long"],
        validate: {
            validator: (val) => val.trim().length >= 30,
            message: "Content cannot be whitespace only",
        },
    },

    isPremium: {
        type: Boolean,
        default: true,
    },
};

const Note = createBaseModel("Note", notesSchemaDefinition, (schema) => {
    schema.index({ createdBy: 1, subject: 1 });

    schema.index({
        subject: 1,
        topicNumber: 1,
        topic: 1,
        subTopicNumber: 1,
        subTopic: 1,
    });

    schema.index({
        subject: 1,
        topic: 1,
        subTopic: 1,
    });

    schema.index({
        subTopic: 1,
        isPremium: 1,
    });

    schema.index(
        {
            topic: "text",
            subTopic: "text",
            content: "text",
        },
        {
            weights: {
                topic: 5,
                subTopic: 3,
                content: 1,
            },
        }
    );
});

export { Note };
export default Note;