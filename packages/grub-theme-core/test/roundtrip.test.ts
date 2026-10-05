import { describe, it, expect } from "vitest";
import { parseTheme } from "../src/parser.js";
import { serializeTheme } from "../src/serializer.js";

// Gate A: byte-identity incl. CRLF/comments/blanks/quotes/spaces-in-path
const cases: Array<[string, string]> = [
  ["lf-basic", `title-text: "Welcome"\ndesktop-image: "background.png"\n\ndesktop-color: #1a1a1a\n+ boot_menu {\n  left = 20%\n  item_color = "#ffffff" # trailing\n}\n`],
  ["crlf", "title-text: \"A\"\r\ndesktop-color: 26, 26, 26\r\n"],
  ["sep-mix", `font: "JetBrains Mono 16"\nleft = 5%\nfile = "my bg.png"\n`],
];

describe("round-trip gate A", () => {
  for (const [name, src] of cases) {
    it(name, () => {
      const root = parseTheme(src);
      expect(serializeTheme(root, new Set())).toBe(src);
    });
  }
});
