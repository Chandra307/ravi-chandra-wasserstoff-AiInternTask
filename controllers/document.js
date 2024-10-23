const Document = require("../models/document");

const fs = require("fs");
const path = require("path");
const { Worker } = require("worker_threads");

module.exports = async (req, res, next) => {
    try {
        const folderPath = path.join(process.cwd(), "pdfs");
        const files = await fs.promises.readdir(folderPath);
        const pdfFiles = files.filter(file => path.extname(file).toLowerCase() === ".pdf");
        console.log("PDF files count:", pdfFiles.length);
        const docsArray = [];
        const docuPromises = pdfFiles.map(pdf => {
            const pdfPath = path.join(folderPath, pdf);
            return fs.promises.stat(pdfPath)
            .then(({ size }) => docsArray.push({
                        fileName: pdf,
                        filePath: pdfPath,
                        fileSize: size
                    })
            )
            .catch((err) => {
                console.error(err);
                return err;
            });                
        });
        await Promise.all(docuPromises);
        const documents = await Document.insertMany(docsArray);
        console.log("Stored metadata in db");

        const updatePromises = documents.map(async (doc) => {
            try {
                const dataBuffer = await fs.promises.readFile(doc.filePath);
                const { pageCount, summary, keywords } = await createWorker(dataBuffer);
                return {
                    updateOne: {
                        filter: { _id: doc._id },
                        update: {
                            summary: { content: JSON.stringify(summary) },
                            pageCount,
                            keywords: { list: keywords }
                        }
                    }
                };
                
            } catch (err) {
                console.error(err);
                let message = err.message === "No password given" ? "Encrypted file..." + err.message : "Corrupted file!";
                return {
                    updateOne: { 
                        filter: { _id: doc._id },
                        update: { error: { hasError: true, message } }
                    }
                }
            }
        });
        const queries = (await Promise.all(updatePromises)).filter(query => query);
        const status = await Document.bulkWrite(queries);
        res.status(200).json({ status });
    }
    catch (err) {
        console.error("Error processing results:", err);
        res.status(500).json({ error: err.message });
    }
};

function createWorker(dataBuffer) {
    return new Promise((res, rej) => {

            const worker = new Worker(
                path.join(__dirname, "worker_thread.js"),
                { workerData: { dataBuffer } }
            );

            worker.on("message", (info) => {
                if (info.error) rej(info.error);
                res(info);
            });
            worker.on("error", (err) => {
                console.log(err);
                rej(err);
            });
    })
}
