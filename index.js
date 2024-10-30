const express = require("express");
require("dotenv").config();
const app = express();
const path = require("path");
const mongoose = require("mongoose");
const docuController = require("./controllers/document");
const cluster = require("cluster");
const spawnLimit = 2;


function spawnWorkerProcess(respawnCount = 0) {
    const worker = cluster.fork();
    worker.respawnCount = respawnCount;
    worker.on("exit", code => {
        console.log(`worker ${worker.process.pid} exited with code ${code}`);
        if (code && worker.respawnCount < spawnLimit) spawnWorkerProcess(worker.respawnCount + 1);
    });
}

if (cluster.isPrimary) {
    for (let i = 0; i < 4; i++) {
        spawnWorkerProcess();
    }
} else {

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
}


