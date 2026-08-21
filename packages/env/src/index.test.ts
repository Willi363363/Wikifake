import { describe, expect, it } from "vitest";
import { EnvError, loadEnv } from "./index.js";

const VALID = {
  DATABASE_URL: "postgres://user:pass@localhost:5432/wikifake",
  REDIS_URL: "redis://localhost:6379",
  GOOGLE_GENERATIVE_AI_API_KEY: "clé-de-test",
};

describe("loadEnv", () => {
  it("applique les valeurs par défaut", () => {
    const env = loadEnv(VALID);
    expect(env.NODE_ENV).toBe("development");
    expect(env.LOG_LEVEL).toBe("info");
    expect(env.MODEL_NAME).toBe("gemini-3.1-flash-lite");
  });

  it("nomme la variable manquante", () => {
    const { DATABASE_URL: _omise, ...sansBase } = VALID;
    expect(() => loadEnv(sansBase)).toThrow(EnvError);
    expect(() => loadEnv(sansBase)).toThrow(/DATABASE_URL/);
  });

  it("refuse une URL de base de données malformée", () => {
    expect(() => loadEnv({ ...VALID, DATABASE_URL: "pas-une-url" })).toThrow(
      /DATABASE_URL/,
    );
  });

  it("ne divulgue jamais la valeur fautive", () => {
    const secret = "sk-ne-doit-pas-fuiter-dans-le-message";
    try {
      loadEnv({ ...VALID, DATABASE_URL: secret });
      expect.unreachable("loadEnv aurait dû échouer");
    } catch (error) {
      expect((error as Error).message).not.toContain(secret);
    }
  });

  it("rejette un niveau de journalisation inconnu", () => {
    expect(() => loadEnv({ ...VALID, LOG_LEVEL: "verbeux" })).toThrow(
      /LOG_LEVEL/,
    );
  });
});
