import { describe, expect, it } from "vitest";
import { EnvError, loadEnv } from "./index.js";

const VALID = {
  DATABASE_URL: "postgres://user:pass@localhost:5432/wikifake",
  REDIS_URL: "redis://localhost:6379",
  GOOGLE_GENERATIVE_AI_API_KEY: "test-key",
};

describe("loadEnv", () => {
  it("applies default values", () => {
    const env = loadEnv(VALID);
    expect(env.NODE_ENV).toBe("development");
    expect(env.LOG_LEVEL).toBe("info");
    expect(env.MODEL_NAME).toBe("gemini-3.1-flash-lite");
  });

  it("names the missing variable", () => {
    const { DATABASE_URL: _omitted, ...withoutDatabase } = VALID;
    expect(() => loadEnv(withoutDatabase)).toThrow(EnvError);
    expect(() => loadEnv(withoutDatabase)).toThrow(/DATABASE_URL/);
  });

  it("rejects a malformed database URL", () => {
    expect(() => loadEnv({ ...VALID, DATABASE_URL: "not-a-url" })).toThrow(
      /DATABASE_URL/,
    );
  });

  it("never discloses the offending value", () => {
    const secret = "sk-must-not-leak-into-the-message";
    try {
      loadEnv({ ...VALID, DATABASE_URL: secret });
      expect.unreachable("loadEnv should have failed");
    } catch (error) {
      expect((error as Error).message).not.toContain(secret);
    }
  });

  it("rejects an unknown log level", () => {
    expect(() => loadEnv({ ...VALID, LOG_LEVEL: "verbose" })).toThrow(
      /LOG_LEVEL/,
    );
  });
});
