import "dotenv/config";
import express from "express";
import cors from "cors";
import { z } from "zod";
import { extractEventHF } from "./ai/extractEventHF.js";

const app = express();
app.use(express.json({ limit: "1mb" }));

app.use(
  cors({
    origin: ["https://localhost:3000", "http://localhost:3000"],
    methods: ["POST", "GET", "OPTIONS"],
  })
);

// ---- Schemas (contract) ----
const ExtractRequestSchema = z.object({
  subject: z.string().default(""),
  body: z.string().default(""),
  receivedAt: z.string().optional(),
  timezone: z.string().default("UTC"),
});

const EventProposalSchema = z.object({
  title: z.string(),
  start: z.string(),
  end: z.string(),
  timezone: z.string(),
  location: z.string().nullable().optional(),
  attendees: z.array(z.string()).optional(),
  confidence: z.number().min(0).max(1),
  alternatives: z
    .array(
      z.object({
        start: z.string(),
        end: z.string(),
        confidence: z.number().min(0).max(1),
        reason: z.string().optional(),
      })
    )
    .optional(),
  explanation: z.string().optional(),
});

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.post("/api/extract-event", async (req, res) => {
  const parsed = ExtractRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid request",
      details: parsed.error.flatten(),
    });
  }

  try {
    const aiResult = await extractEventHF(parsed.data);

    const validated = EventProposalSchema.safeParse({
      ...aiResult,
      timezone: aiResult.timezone || parsed.data.timezone,
    });

    if (!validated.success) {
      console.error("Invalid AI output:", validated.error.flatten());
      return res.status(500).json({
        error: "AI returned invalid event structure",
      });
    }

    res.json(validated.data);
  } catch (err) {
    console.error("AI extraction failed:", err);
    res.status(500).json({
      error: "AI extraction failed",
    });
  }
});

const PORT = process.env.PORT || 8787;
app.listen(PORT, () => {
  console.log(`Smart Calendar backend running on http://localhost:${PORT}`);
});
