const CRITERIA = {
  side_quest: "The user describes a new opportunity, a distraction, curiosity, an unexpected activity or something worth exploring.",
  main_character: "The user describes an achievement, ambition, confidence, a personal milestone or a moment of taking initiative.",
  plot_twist: "The user describes an unexpected development, a surprising change, a reversal or an unforeseen complication.",
  character_development: "The user describes learning from an experience, overcoming a difficulty, changing a habit or working through a personal challenge.",
  intermission: "The input is unrelated, too vague, or does not clearly fit the other categories.",
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed. Use POST /api/decide." });
  }

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch {
      return res.status(400).json({ error: "Request body must be valid JSON." });
    }
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return res.status(400).json({ error: "Request body must be JSON with a 'text' field." });
  }
  const text = typeof body.text === "string" ? body.text : "";
  if (!text.trim()) return res.status(400).json({ error: "Please describe your situation first." });
  if (text.length > 500) return res.status(400).json({ error: "Input must be 500 characters or fewer." });

  const apiKey = process.env.AI_GATEWAY_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "The server is not configured yet. Please try again later.", code: "SETUP_MISSING_KEY" });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  let upstream;
  try {
    upstream = await fetch("https://ai-gateway.vercel.sh/v1/evaluate", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "typesafe-ai/jev",
        state: text,
        questions: {
          kind: {
            type: "choice",
            instructions: "Which predefined narrative outcome best fits the situation described by the user? Select the closest match based on the situation's emotional tone and context. If the input is unrelated, too vague or does not fit any category, choose intermission.",
            criteria: CRITERIA,
          },
        },
      }),
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timeout);
    return res.status(502).json({ error: error?.name === "AbortError" ? "The decision took too long. Please try again." : "Could not reach the decision service. Please try again.", code: "UPSTREAM_UNREACHABLE" });
  }
  clearTimeout(timeout);

  let data;
  try { data = await upstream.json(); } catch {
    return res.status(502).json({ error: "The decision service returned an unreadable response.", code: "UPSTREAM_BAD_JSON" });
  }
  if (!upstream.ok) return res.status(502).json({ error: "The decision service could not complete the request. Please try again.", code: "UPSTREAM_ERROR" });

  const answer = data?.answers?.kind;
  const choice = answer?.choice;
  const probabilities = answer?.probabilities;
  if (answer?.type !== "choice" || !Object.hasOwn(CRITERIA, choice) || !probabilities || typeof probabilities !== "object") {
    return res.status(502).json({ error: "The decision service returned malformed data. Please try again.", code: "UPSTREAM_MALFORMED" });
  }
  for (const key of Object.keys(CRITERIA)) {
    if (typeof probabilities[key] !== "number" || !Number.isFinite(probabilities[key]) || probabilities[key] < 0 || probabilities[key] > 1) {
      return res.status(502).json({ error: "The decision service returned malformed data. Please try again.", code: "UPSTREAM_MALFORMED" });
    }
  }
  return res.status(200).json({ choice, probabilities, confidence: probabilities[choice] });
}
