const express = require("express");
require("dotenv").config();
const app = express();
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const Document = require("./models/document");
const pdfParser = require("pdf-parse");
const { SummarizerManager } = require('node-summarizer');

app.use(express.json());

app.get("/", async (req, res) => {
    try {
        res.sendFile(path.join(__dirname, 'index.html'));
    } catch (error) {
        res.json({ error: error.message });
    }
});


app.get("/results", async (req, res) => {
    try {
        // const folderPath = "E:\\IDs";
        const folderPath = path.join(__dirname, "pdfs");
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
            .catch(err => err);                
        });
        await Promise.all(docuPromises);
        const documents = await Document.insertMany(docsArray);
        // console.log(documents, "docss");

        const updatePromises = documents.map(async (doc) => {
            try {
                const { pageCount, summary } = await generateDynamicSummary(doc.filePath);
                return {
                    updateOne: {
                        filter: { _id: doc._id },
                        update: {
                            summary: { content: JSON.stringify(summary) },
                            pageCount
                        }
                    }
                };
                
            } catch (err) {
                console.error(err, "aadhaar pwd");
                return {
                    updateOne: { 
                        filter: { _id: doc._id },
                        update: { error: { hasError: true, message: "Encryptd file..." + err.message } }
                    }
                }
            }
        });
        const queries = (await Promise.all(updatePromises)).filter(query => query);
        console.log(queries, 'qqq');
        const status = await Document.bulkWrite(queries);
        res.json({ status });
    }
    catch (error) {
        console.error("Error processing results:", error);
        // res.json({ error: error.message });
    }
});

const processPdf = async (filePath) => {
    try {
        const dataBuffer = await fs.promises.readFile(filePath);
        const { numpages, text } = await pdfParser(dataBuffer);
        return { numpages, text };
    } catch (err) {        
        // console.error(err, 'no passwd given');
        throw err;
    }       
};


const generateDynamicSummary = async (pdfPath) => {
    try {
        const { numpages: pageCount, text } = await processPdf(pdfPath);

        let summarySentenceCount;
        if (pageCount <= 5) {
            summarySentenceCount = 8;
        } else if (pageCount <= 10) {
            summarySentenceCount = 15; 
        } else if (pageCount <= 30) {
            summarySentenceCount = 70; 
        } else if (pageCount <= 100) {
            summarySentenceCount = 200; 
        } else {
            summarySentenceCount = 400; 
        }

        const Summarizer = new SummarizerManager(text, summarySentenceCount);
        const summary = await Summarizer.getSummaryByFrequency().summary;

        console.log(`Generated summary for ${pdfPath}:`);
        return { pageCount, summary };
    }
    catch (err) {
        // console.error("Error generating summary:", err);
        throw err;
    }
};

mongoose
    .connect(process.env.DB_CONNECTION_STRING)
    .then(() => app.listen(process.env.PORT, () => {
        console.log('Server is up and listening!!');
    }))
    .catch(err => console.log(err));
