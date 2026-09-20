const express = require('express');
const app = express();
const PORT = 3000;

app.get('/status', (req, res) => {
    res.json({
        status: "success",
        message: "The Node.js API is running smoothly. Changes are made now and committed to GitHub",
        active_environment: process.env.NODE_ENV || "standalone",
        timestamp: new Date().toISOString()
    });
});

app.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});