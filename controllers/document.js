const Document = require("../models/document");

const fs = require("fs");
const path = require("path");

const pdfParser = require("pdf-parse");
const { SummarizerManager } = require('node-summarizer');
const rake = require("rake-js");

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
        // console.log(documents, "docss");

        const updatePromises = documents.map(async (doc) => {
            try {
                const { pageCount, summary, keywords } = await generateDynamicSummary(doc.filePath);
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
                if (err.message === "No password given") {
                    return {
                        updateOne: { 
                            filter: { _id: doc._id },
                            update: { error: { hasError: true, message: "Encrypted file..." + err.message } }
                        }
                    }
                }
            }
        });
        const queries = (await Promise.all(updatePromises)).filter(query => query);
        const status = await Document.bulkWrite(queries);
        res.status(200).json({ status });
    }
    catch (error) {
        console.error("Error processing results:", error);
        res.status(500).json({ error: error.message });
    }
};

const processPdf = async (filePath) => {
    try {
        const dataBuffer = await fs.promises.readFile(filePath);
        const { numpages, text } = await pdfParser(dataBuffer);
        return { numpages, text };
    } catch (err) {        
        console.error(err);
        throw err;
    }       
};
console.log(rake.default, "rak");

const cleanText = (text) => {
    return text.replace(/[^a-zA-Z0-9.,\s]/g, '').replace(/\s+/g, ' ').trim();
};

const generateDynamicSummary = async (pdfPath) => {
    try {
        const { numpages: pageCount, text } = await processPdf(pdfPath);

        const cleanedText = cleanText(text);


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

        const Summarizer = new SummarizerManager(cleanedText, summarySentenceCount);
        const summary = await Summarizer.getSummaryByFrequency().summary;

        const keywords = extractKeywords(cleanedText);
        keywords.length = Math.min(keywords.length, 6);

        console.log(`Generated summary for ${pdfPath}:`);
        return { pageCount, summary, keywords };
    }
    catch (err) {
        console.error("Error generating summary:", err);
        throw err;
    }
};

const extractKeywords = (textContent) => rake.default(textContent);