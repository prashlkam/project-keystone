import express from "express";
import bodyParser from "body-parser";
import dotenv from "dotenv";
dotenv.config();

import { handleAWS } from "./providers/aws.js";
import { handleGCP } from "./providers/gcp.js";
import { handleAzure } from "./providers/azure.js";

const app = express();
app.use(bodyParser.json({ limit: "20kb" }));

app.get("/", (req, res) => res.json({ ok: true }));

app.post("/translate-tts", async (req, res) => {
  try {
    const { message, targetLanguage, provider } = req.body;
    if (!message || !targetLanguage) return res.status(400).json({ error: "message and targetLanguage required" });
    const p = (provider || "aws").toLowerCase();
    let result = null;
    if (p === "aws") result = await handleAWS(message, targetLanguage);
    else if (p === "gcp") result = await handleGCP(message, targetLanguage);
    else if (p === "azure") result = await handleAzure(message, targetLanguage);
    else return res.status(400).json({ error: "unknown provider" });
    return res.json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "server error", details: err.message });
  }
});

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`Translate-TTS service listening on ${port}`));
