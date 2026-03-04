import Groq from "groq-sdk";

interface KeyState {
  key: string;
  index: number;
  uses: number;
  errors: number;
  lastErrorTime: number;
  rateLimitedUntil: number;
}

class GroqKeyManager {
  private keys: KeyState[] = [];
  private roundRobinIndex = 0;

  constructor() {
    const envKeys = [
      process.env.GROQ_KEY_1,
      process.env.GROQ_KEY_2,
      process.env.GROQ_KEY_3,
      process.env.GROQ_KEY_4,
      process.env.GROQ_KEY_5,
    ].filter(Boolean) as string[];

    this.keys = envKeys.map((key, i) => ({
      key,
      index: i,
      uses: 0,
      errors: 0,
      lastErrorTime: 0,
      rateLimitedUntil: 0,
    }));

    console.log(`[Groq] Initialized with ${this.keys.length} API key(s)`);
    if (this.keys.length === 0) {
      console.warn("[Groq] No API keys configured");
    }
  }

  /** Pick the best available key using round-robin with health checks */
  private pickKey(): KeyState | null {
    if (this.keys.length === 0) return null;

    const now = Date.now();
    const cooldownMs = 10 * 60 * 1000; // 10 min cooldown for errored keys

    // Try round-robin through all keys
    for (let attempt = 0; attempt < this.keys.length; attempt++) {
      const idx = this.roundRobinIndex % this.keys.length;
      this.roundRobinIndex++;
      const ks = this.keys[idx];

      // Skip rate-limited keys
      if (ks.rateLimitedUntil > now) continue;

      // Reset errors after cooldown period
      if (ks.errors > 0 && now - ks.lastErrorTime > cooldownMs) {
        ks.errors = 0;
      }

      // Skip keys with too many consecutive errors
      if (ks.errors >= 3) continue;

      return ks;
    }

    // All keys are errored — pick the one with the oldest error (most likely recovered)
    const sorted = [...this.keys].sort(
      (a, b) => a.lastErrorTime - b.lastErrorTime,
    );
    // Reset its error count to give it another chance
    sorted[0].errors = 0;
    return sorted[0];
  }

  reportError(key: string, isRateLimit = false): void {
    const ks = this.keys.find((k) => k.key === key);
    if (ks) {
      ks.errors++;
      ks.lastErrorTime = Date.now();
      if (isRateLimit) {
        // Back off this key for 60s on rate limit
        ks.rateLimitedUntil = Date.now() + 60_000;
      }
    }
  }

  reportSuccess(key: string): void {
    const ks = this.keys.find((k) => k.key === key);
    if (ks) {
      ks.errors = 0;
      ks.rateLimitedUntil = 0;
    }
  }

  async callWithFallback(
    systemPrompt: string,
    userPrompt: string,
    maxTokens = 1000,
  ): Promise<string> {
    let lastError: Error | null = null;
    const triedKeys = new Set<string>();

    for (let i = 0; i < this.keys.length; i++) {
      const ks = this.pickKey();
      if (!ks) break;

      // Avoid retrying same key in one call
      if (triedKeys.has(ks.key)) continue;
      triedKeys.add(ks.key);

      const client = new Groq({ apiKey: ks.key });

      try {
        const completion = await client.chat.completions.create({
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          max_tokens: maxTokens,
          temperature: 0.3,
        });

        const content = completion.choices[0]?.message?.content || "";
        this.reportSuccess(ks.key);
        ks.uses++;

        console.log(
          `[Groq] Success on key #${ks.index + 1} (total uses: ${ks.uses})`,
        );

        // Strip markdown fences
        const cleaned = content
          .replace(/```json\s*/g, "")
          .replace(/```\s*/g, "")
          .trim();

        return cleaned;
      } catch (err) {
        const errMsg = (err as Error).message || "";
        const isRateLimit =
          errMsg.includes("rate_limit") ||
          errMsg.includes("429") ||
          errMsg.includes("quota");
        this.reportError(ks.key, isRateLimit);
        lastError = err as Error;
        console.error(
          `[Groq] Key #${ks.index + 1} failed${isRateLimit ? " (rate limited)" : ""}, trying next: ${errMsg}`,
        );
      }
    }

    throw lastError || new Error("All Groq keys failed");
  }
}

export const groqManager = new GroqKeyManager();
