const { parentPort, workerData } = require("worker_threads");
const pdfParser = require("pdf-parse");
const { SummarizerManager } = require('node-summarizer');
const rake = require("rake-js");

const cleanText = (text) => {
    return text.replace(/[^a-zA-Z0-9.,\s]/g, '').replace(/\s+/g, ' ').trim();
};

const generateDynamicSummary = async (dataBuffer) => {
    try {
        const { numpages: pageCount, text } = await pdfParser(dataBuffer);

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

        const keywords = rake.default(cleanedText);
        keywords.length = Math.min(keywords.length, 6);
        return { pageCount, summary, keywords };
    }
    catch (err) {
        console.error("Error generating summary:", err);
        throw err;
    }
};

(async () => {
    try {
        const { dataBuffer } = workerData;
        const { pageCount, summary, keywords } = await generateDynamicSummary(dataBuffer);
        parentPort.postMessage({ pageCount, summary, keywords });
    }
    catch (err) {
        console.error(err);
        parentPort.postMessage({ error: err });
    }
})();
