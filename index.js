const express = require("express");
require("dotenv").config();
const app = express();
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const Document = require("./models/document");
// const PDFParser = require('pdf2json');
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
        const folderPath = path.join(__dirname, "pdfs");
        const files = await fs.promises.readdir(folderPath);
        const pdfFiles = files.filter(file => path.extname(file).toLowerCase() === ".pdf");
        console.log("PDF files count:", pdfFiles.length);

        const summaries = [];
        for (const pdf of pdfFiles) {
            const pdfPath = path.join(folderPath, pdf);
            console.log("path", pdfPath);
            const summary = await generateDynamicSummary(pdfPath);
            summaries.push({ summary });
        }
        res.json({ summaries });
        // res.send(summary);
    } catch (error) {
        console.error("Error processing results:", error);
        // res.json({ error: error.message });
    }
});

const processPdf = async (filePath) => {
    try {
        const dataBuffer = fs.readFileSync(filePath);
        const { numpages, text } = await pdfParser(dataBuffer);
        return { numpages, text };
    } catch (err) {        
        console.error(err);
    }       
};


const generateDynamicSummary = async (pdfPath) => {
    try {
        const { numpages: pageCount, text } = await processPdf(pdfPath);

        let summarySentenceCount;
        if (pageCount <= 5) {
            summarySentenceCount = 8;
        } else if (pageCount <= 10) {
            summarySentenceCount = 15; // Short summary
        } else if (pageCount <= 30) {
            summarySentenceCount = 70; // Medium summary
        } else if (pageCount <= 100) {
            summarySentenceCount = 200; // Detailed summary
        } else {
            summarySentenceCount = 400; // Very detailed summary
        }

        const Summarizer = new SummarizerManager(text, summarySentenceCount);
        const summary = await Summarizer.getSummaryByFrequency().summary;

        console.log(`Generated summary for ${pdfPath}:`);
        return summary;
    } catch (error) {
        console.error("Error generating summary:", error);
        throw error; // Rethrow to handle it upstream
    }
};

mongoose
    .connect(process.env.DB_CONNECTION_STRING)
    .then(() => app.listen(process.env.PORT, () => {
        console.log('Server is up and listening!!');
    }))
    .catch(err => console.log(err));
