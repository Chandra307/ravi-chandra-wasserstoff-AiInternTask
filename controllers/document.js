const Document = require("../models/document");

const fs = require("fs");
const path = require("path");
const os = require("os");
const { Worker } = require("worker_threads");
const maxWorkers = 1;
let activeWorkers = 0;
const taskQueue = [];

module.exports = async (req, res, next) => {
    try {        

        const folderPath = path.join(process.cwd(), "pdfs"); // storing the path of the folder containing PDFs
        const files = await fs.promises.readdir(folderPath);
        const pdfFiles = files.filter(file => path.extname(file).toLowerCase() === ".pdf");
        console.log("PDF files count:", pdfFiles.length);
        
        // Reading file stats asynchronously and creating an array of promises that resolve with files' metadata
        const docuPromises = pdfFiles.map(async pdf => {
            try {
                const pdfPath = path.join(folderPath, pdf);
                const { size } = await fs.promises.stat(pdfPath);
                return {
                    fileName: pdf,
                    filePath: pdfPath,
                    fileSize: size
                };
            }
            catch (error) {                
                    console.error(err);   
            }
        });
        const insertQueries = await Promise.all(docuPromises);
        const documents = await Document.insertMany(insertQueries); // creating MongoDB documents in bulk
        console.log("Stored metadata in db");

        const updatePromises = documents.map(async (doc) => {
            try {
                const dataBuffer = await new Promise((res, rej) => {
                    const stream = fs.createReadStream(doc.filePath);
                    const chunks = [];
                    stream.on("data", chunk => chunks.push(chunk)); // appending each chunk read, into chunks array
                    stream.on("error", err => rej(err)); // to update the mongodb document that there is a problem reading the file
                    stream.on("end", () => res(Buffer.concat(chunks))); // clubs all buffer data                
                });

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

        console.time("process promises");
        const updateQueries = await Promise.all(updatePromises);
        console.timeEnd("process promises");
        
        const status = await Document.bulkWrite(updateQueries); // updating mongodb documents in bulk 
        console.log("Updated documents post processing.");
        res.status(200).json({ status });
    }
    catch (err) {
        console.error("Error processing results:", err);
        res.status(500).json({ error: err.message });
    }
};

// creates a new worker to perform tasks in worker_thread.js (pdf-parsing, summarizing, keyword extraction)
function createWorker(dataBuffer) {
    return new Promise((res, rej) => {

        if (activeWorkers < maxWorkers) { // creating workers only when their count is below threshold 

            const worker = new Worker(
                path.join(__dirname, "worker_thread.js"),
                { workerData: { dataBuffer } }
            );

            // data received from worker thread
            worker.on("message", (info) => {
                if (info.error) rej(info.error);
                res(info);
                activeWorkers--; // decreasing the active worker thread count because the worker is no longer active
                processQueue();
            });
            
            // to handle any errors forwarded by the worker thread
            worker.on("error", (err) => {
                console.log(err);
                rej(err);
                activeWorkers--;
                processQueue();
            });
            worker.on("exit", () => {
                activeWorkers--;
                processQueue();
            })
        } else {
            taskQueue.push({ dataBuffer, res, rej });
        }
    })
}

function processQueue() {
    if (taskQueue.length && activeWorkers < maxWorkers) {
        const { dataBuffer, res, rej } = taskQueue.shift();
        createWorker(dataBuffer).then(res).catch(rej);
    }
}
