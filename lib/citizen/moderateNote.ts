import { GoogleGenAI } from "@google/genai";

export type ModerationResult =
  | { ok: true }
  | { ok: false; reason: "profanity" | "irrelevant" };

/** Deterministic offline hard-block: unambiguous profanity/abuse across English plus common
 *  romanized Hindi/Kannada. Word-boundary matched, case-insensitive. This is the floor that
 *  holds even when Gemini is unreachable. Kept conservative — only clearly-abusive tokens — so
 *  a legitimate report is never rejected by the wordlist alone; the AI pass handles nuance. */
const BLOCKLIST = [
  // English
  "fuck", "fucking", "motherfucker", "shit", "bitch", "bastard", "asshole",
  "cunt", "dickhead", "slut", "whore", "nigger", "faggot",
  // Romanized Hindi / Kannada
  "chutiya", "chutiye", "madarchod", "madarchood", "behenchod", "bhenchod",
  "bsdk", "gaandu", "gandu", "randi", "bhosdi", "bhosdike", "lund", "lavda",
  "harami", "haramzada", "chinaal",
];

const BLOCK_RE = new RegExp(`\\b(${BLOCKLIST.join("|")})\\b`, "i");

const AI_TIMEOUT_MS = 6000;

/** Moderates the citizen's optional note. An empty note is always allowed (the field is
 *  optional). Obvious profanity is blocked offline; otherwise Gemini judges profanity and
 *  topical relevance across en/hi/kn. Any AI error or timeout fails OPEN (allows) so a
 *  moderation outage can never dead-end an otherwise-valid violation report. */
export async function moderateNote(note: string | null): Promise<ModerationResult> {
  const text = (note ?? "").trim();
  if (!text) return { ok: true };

  // 1. Offline guard — always runs, no network dependency.
  if (BLOCK_RE.test(text)) return { ok: false, reason: "profanity" };

  // 2. AI nuance + relevance pass. Missing key or any failure → fail-open.
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { ok: true };

  try {
    const ai = new GoogleGenAI({ apiKey });

    const prompt = `You are a content filter for a Bengaluru traffic-police app where citizens report illegal parking. A citizen attached this optional free-text note to a parking-violation report. The note may be in English, Hindi, or Kannada, in any script or romanized.

Classify the note as exactly one of:
- "profanity": contains profanity, slurs, sexual content, hate speech, threats, or personal abuse in ANY language.
- "irrelevant": readable but unrelated to a parking/traffic/vehicle violation (random text, spam, gibberish, advertising, personal messages).
- "ok": a clean note plausibly describing or commenting on a parking/traffic violation.

Respond with ONLY this JSON and nothing else: {"verdict":"ok"|"profanity"|"irrelevant"}

Note: """${text}"""`;

    const result = await Promise.race([
      ai.models.generateContent({
        model: process.env.GEMINI_MODEL ?? "gemini-3.1-flash-lite",
        contents: prompt,
        config: { temperature: 0, responseMimeType: "application/json" },
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("moderation timeout")), AI_TIMEOUT_MS),
      ),
    ]);

    const raw = result.text ?? '';
    const match = raw.match(/"verdict"\s*:\s*"(ok|profanity|irrelevant)"/i);
    const verdict = match?.[1]?.toLowerCase();
    if (verdict === "profanity") return { ok: false, reason: "profanity" };
    if (verdict === "irrelevant") return { ok: false, reason: "irrelevant" };
    return { ok: true };
  } catch {
    return { ok: true }; // fail-open
  }
}
