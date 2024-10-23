const { mongoose, Schema } = require("mongoose");

const documentSchema = new Schema(
    {
        fileName: { type: String, required: true },
        filePath: { type: String, required: true },
        fileSize: { type: String, required: true },
        pageCount: { type: Number },
        error: {
            hasError: { type: Boolean, default: false },
            message: { type: String }
        },
        summary: { content: { type: String } },
        keywords: { list: [{ type: String }] }
    }
);

module.exports = mongoose.model("Document", documentSchema);