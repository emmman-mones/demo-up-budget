const express = require("express");
const fs = require("fs");
const app = express();
const PORT = 3000;
const path = require("path");

app.use(express.json()); // Parse JSON bodies

// Serve static files from the "public" folder
app.use(express.static("public"));

// Serve the resources folder
app.use("/resources", express.static(path.join(__dirname, "resources")));

// API endpoint to save query and response
app.post("/save-query", (req, res) => {
  const { query, response } = req.body;
  const filePath = "./public/queries.json";

  if (!query || !response) {
    return res.status(400).send({ error: "Query and response are required." });
  }

  // Read and update the JSON file
  fs.readFile(filePath, "utf8", (err, data) => {
    if (err) {
      console.error("Error reading file:", err);
      return res.status(500).send({ error: "Failed to read file." });
    }

    const queries = JSON.parse(data || "[]");
    queries.push({ query, response, timestamp: new Date().toISOString() });

    fs.writeFile(filePath, JSON.stringify(queries, null, 2), (err) => {
      if (err) {
        console.error("Error writing file:", err);
        return res.status(500).send({ error: "Failed to write file." });
      }

      res.send({ success: true, message: "Query and response saved successfully!" });
    });
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
