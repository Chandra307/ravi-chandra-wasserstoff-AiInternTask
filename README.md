# Setup instructions:

- Prerequisites: *Node.js*, and *Git* have to be installed.
- To start with, clone the GitHub repo and run `npm i` command in the terminal to install all the required dependencies.
- `process.env.DB_CONNECTION_STRING` in index.js file has to be replaced with *your mongodb url*.
- Now run `npm start` command in the terminal to start the server.
- Open a web browser and go to *localhost:3000* to load the UI and click the "Summarize" button to start processing. 

# Approach:

- Downloaded the PDF files from this dataset link [Test data](https://github.com/Devian158/AI-Internship-Task.git) to a folder, named *pdfs* in the project's root directory.
- Iterated through all the files in the folder, stored metadata of each PDF file as a document, in a MongoDB collection *documents*.
- Read files in chunks asynchronously, and passed on the file data to a PDF parser.
- Offloaded the parsing task to worker threads to make optimal use of resources.
- Used *node-summarizer* and *rake-js* for summarization of PDF files, and keyword extraction.
- Post summarization and keyword extraction, updated the documents in database with number of pages, summary and keywords.
- Handled errors, from file read operation till processing, and updated MongoDB documents accordingly.
- Created a basic UI with a *Summarize* button which when clicked, triggers the processing of files.
- Added json and csv files of MongoDB collection exports to the repository.
