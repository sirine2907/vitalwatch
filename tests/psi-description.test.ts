import { describe, expect, it } from "vitest";
import { parseDescription } from "@/domain/psi/description";

describe("parseDescription", () => {
  it("keeps plain text", () => {
    expect(parseDescription("Just text.")).toEqual([{ type: "text", text: "Just text." }]);
  });

  it("splits text around a link", () => {
    expect(parseDescription("Read [the docs](https://web.dev/a) now.")).toEqual([
      { type: "text", text: "Read " },
      { type: "link", text: "the docs", href: "https://web.dev/a" },
      { type: "text", text: " now." },
    ]);
  });

  it("turns unsafe links into plain text", () => {
    expect(parseDescription("[click](javascript:alert(1))")[0]).toMatchObject({
      type: "text",
      text: "click",
    });
    expect(parseDescription("[old](http://example.com)")).toEqual([{ type: "text", text: "old" }]);
  });

  it("handles empty input", () => {
    expect(parseDescription("")).toEqual([]);
  });
});
