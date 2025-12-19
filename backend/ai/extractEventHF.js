const HF_BASE_URL = "https://router.huggingface.co/v1";
const MODEL = "HuggingFaceTB/SmolLM3-3B:hf-inference";

export async function extractEventHF({ subject, body, receivedAt, timezone }) {
  const cleanBody = (body || "").slice(0, 6000);

  const prompt = [
    "Extract calendar event details from the email below.",
    "",
    "Rules (follow exactly):",
    `- Timezone to use if not specified: ${timezone}`,
    `- Anchor for relative dates: receivedAt=${receivedAt}`,
    '- If the email contains an explicit date/time (example: "12/21/2025 at 6PM"), you MUST set "start".',
    '- Output "start" and "end" as LOCAL ISO strings WITHOUT "Z" or offsets (example: 2025-12-21T18:00:00).',
    '- If end time is not stated, set end = start + 30 minutes.',
    '- If no date/time exists at all, set start="" and end="" and confidence=0.0.',
    '- confidence should be higher for explicit dates/times (e.g., 0.85+).',
    "",
    `Email subject: ${subject || ""}`,
    "Email body:",
    cleanBody,
  ].join("\n");

  const resp = await fetch(`${HF_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.HUGGINGFACE_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        {
          role: "system",
          content:
            "You are a strict JSON generator. Output only JSON matching the provided schema. No reasoning, no extra text.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.1,
      max_tokens: 250,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "event_proposal",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: [
              "title",
              "start",
              "end",
              "timezone",
              "location",
              "confidence",
              "explanation",
            ],
            properties: {
              title: { type: "string" },
              start: { type: "string" }, // local ISO or ""
              end: { type: "string" },   // local ISO or ""
              timezone: { type: "string" },
              location: { anyOf: [{ type: "string" }, { type: "null" }] },
              confidence: { type: "number", minimum: 0, maximum: 1 },
              explanation: { type: "string" },
            },
          },
        },
      },
    }),
  });

  const rawText = await resp.text();

  if (!resp.ok) {
    console.error("HF router error:", resp.status, rawText);
    throw new Error(`HF router error ${resp.status}`);
  }

  let data;
  try {
    data = JSON.parse(rawText);
  } catch {
    console.error("HF response not JSON:", rawText.slice(0, 2000));
    throw new Error("HF router returned non-JSON response");
  }

  const content = data?.choices?.[0]?.message?.content || "";
  // With response_format=json_schema, content should already be JSON.
  let obj;
  try {
    obj = JSON.parse(content);
  } catch {
    console.error("Model content not JSON:", content.slice(0, 2000));
    throw new Error("Model did not return JSON content");
  }

  // Small safety: ensure timezone is filled (model sometimes leaves it blank)
  if (!obj.timezone) obj.timezone = timezone;

  console.log("Extracted event proposal:", obj);

  return obj;
}
