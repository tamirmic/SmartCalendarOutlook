import express from "express";
import cors from "cors";
import { z } from "zod";

const app = express();
app.use(express.json({ limit: "1mb" }));

// Dev CORS: allow Outlook add-in pages served from localhost:3000
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
  receivedAt: z.string().optional(), // ISO string
  timezone: z.string().default("UTC"), // IANA tz string ideally
});

const EventProposalSchema = z.object({
  title: z.string(),
  start: z.string(), // ISO
  end: z.string(), // ISO
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

// ---- Routes ----
app.get("/health", (req, res) => {
  res.json({ ok: true });
});

// Mock extractor (Step 1): returns placeholder “tomorrow 10:00–10:30”
app.post("/api/extract-event", (req, res) => {
  const parsed = ExtractRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid request",
      details: parsed.error.flatten(),
    });
  }

  const { subject, timezone } = parsed.data;

  // Tomorrow 10:00–10:30 (local server time for now)
  const start = new Date(Date.now() + 24 * 60 * 60 * 1000);
  start.setHours(10, 0, 0, 0);
  const end = new Date(start.getTime() + 30 * 60 * 1000);

  const proposal = {
    title: subject?.trim() ? subject.trim() : "Event",
    start: start.toISOString(),
    end: end.toISOString(),
    timezone,
    location: "TBD",
    confidence: 0.2,
    explanation: "Mock response (AI not enabled yet).",
  };

  const validated = EventProposalSchema.safeParse(proposal);
  if (!validated.success) {
    return res.status(500).json({
      error: "Server produced invalid proposal",
      details: validated.error.flatten(),
    });
  }

  res.json(validated.data);
});

const PORT = process.env.PORT || 8787;
app.listen(PORT, () => {
  console.log(`Smart Calendar backend running on http://localhost:${PORT}`);
});
