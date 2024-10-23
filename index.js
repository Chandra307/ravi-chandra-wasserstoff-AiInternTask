const express = require("express");
require("dotenv").config();
const app = express();
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const Document = require("./models/document");
const docuController = require("./controllers/document");


app.use(express.json());

app.get("/", async (req, res) => {
    try {
        res.sendFile(path.join(__dirname, 'index.html'));
    } catch (error) {
        res.json({ error: error.message });
    }
});


app.get("/results", docuController);

mongoose
    .connect(process.env.DB_CONNECTION_STRING)
    .then(() => app.listen(process.env.PORT, () => {
        console.log('Server is up and listening!!');
    }))
    .catch(err => console.log(err));
