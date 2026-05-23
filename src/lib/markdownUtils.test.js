import { beforeEach, describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { htmlToMarkdown, markdownToHtml } from "./markdownUtils";

beforeEach(() => {
  const window = new Window();
  globalThis.document = window.document;
});

describe("editable line breaks", () => {
  test("keeps consecutive empty editor paragraphs when saving", () => {
    expect(htmlToMarkdown("<p><br></p><p><br></p><p><br></p>")).toBe("\n\n\n");
  });

  test("renders blank markdown lines as editable paragraphs", () => {
    expect(markdownToHtml("\n\n\n")).toBe(
      "<p><br></p>\n<p><br></p>\n<p><br></p>",
    );
  });

  test("round trips trailing blank lines after text", () => {
    const markdown = "hello\n\n\n";

    expect(htmlToMarkdown(markdownToHtml(markdown))).toBe(markdown);
  });
});
