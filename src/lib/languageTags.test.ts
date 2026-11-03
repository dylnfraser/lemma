import { describe, expect, it } from "vitest";
import { languageTag } from "./languageTags";

describe("languageTag", () => {
  it("maps Wikipedia's own codes to standard language tags", () => {
    expect(languageTag("simple")).toBe("en");
    expect(languageTag("zh-yue")).toBe("yue");
    expect(languageTag("eml")).toBe("egl");
  });

  it("leaves standard codes as they are", () => {
    expect(languageTag("fr")).toBe("fr");
    expect(languageTag("zh")).toBe("zh");
    expect(languageTag("be-tarask")).toBe("be-tarask");
  });
});
