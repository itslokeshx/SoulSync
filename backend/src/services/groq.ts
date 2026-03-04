import Groq from "groq-sdk";

interface KeyState {
  key: string;
  uses: number;
  errors: number;
  lastErrorTime: number;
}

class GroqKeyManager {
  private keys: KeyState[] = [];
  private index = 0;

  constructor() {
    const envKeys = [
      process.env.GROQ_KEY_1,
      process.env.GROQ_KEY_2,
      process.env.GROQ_KEY_3,
      process.env.GROQ_KEY_4,
      process.env.GROQ_KEY_5,
    ].filter(Boolean) as string[];

    this.keys = envKeys.map((key) => ({
      key,
      uses: 0,
      errors: 0,
      lastErrorTime: 0,
    }));

    if (this.keys.length === 0) {
      console.warn("[Groq] No API keys configured");
    }
  }

  getNextKey(): string {
    if (this.keys.length === 0) {
      throw new Error("AI temporarily unavailable — no API keys configured");
    }

    const oneHourAgo = Date.now() - 3600000;
    let attempts = 0;

    while (attempts < this.keys.length) {
      const keyState = this.keys[this.index % this.keys.length];
      this.index++;

      // Reset error count if last error was more than 1 hour ago
      if (keyState.lastErrorTime < oneHourAgo) {
        keyState.errors = 0;
      }

      // Skip keys with 3+ errors in the last hour
      if (keyState.errors >= 3) {
        attempts++;
        continue;
      }

      keyState.uses++;
      return keyState.key;
    }

    throw new Error("AI temporarily unavailable — all keys exhausted");
  }

  reportError(key: string): void {
    const keyState = this.keys.find((k) => k.key === key);
    if (keyState) {
      keyState.errors++;
      keyState.lastErrorTime = Date.now();
    }
  }

  reportSuccess(key: string): void {
    const keyState = this.keys.find((k) => k.key === key);
    if (keyState) {
      keyState.errors = 0;
    }
  }

  async callWithFallback(
    systemPrompt: string,
    userPrompt: string,
    maxTokens = 1000,
  ): Promise<string> {
    let lastError: Error | null = null;

    for (let i = 0; i < Math.min(this.keys.length, 5); i++) {
      const key = this.getNextKey();
      const client = new Groq({ apiKey: key });

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
        this.reportSuccess(key);

        // Strip markdown fences
        const cleaned = content
          .replace(/```json\s*/g, "")
          .replace(/```\s*/g, "")
          .trim();

        return cleaned;
      } catch (err) {
        this.reportError(key);
        lastError = err as Error;
        console.error(
          `[Groq] Key failed, trying next:`,
          (err as Error).message,
        );
      }
    }

    throw lastError || new Error("All Groq keys failed");
  }
}

export const groqManager = new GroqKeyManager();
