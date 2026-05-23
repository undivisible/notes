import { expect, test } from "@playwright/test";

async function reset(page) {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
}

async function activeStorage(page) {
  return page.evaluate(() => {
    const tabs = JSON.parse(localStorage.getItem("notes-tabs") || "[]");
    const active = localStorage.getItem("notes-active-tab");
    return {
      active,
      tabs,
      content: localStorage.getItem(`notes-content-${active}`),
    };
  });
}

test("rich text input, repeated enter, and reload persistence work", async ({
  page,
}) => {
  await reset(page);
  const editor = page.locator("#noteEditor");

  await editor.click();
  await page.keyboard.type("hello");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await page.keyboard.type("world");
  await page.waitForTimeout(650);

  await expect
    .poll(async () => (await activeStorage(page)).content)
    .toBe("hello\n\n\nworld");

  await page.reload();
  await expect(editor.locator("p")).toHaveCount(4);
  await expect(editor).toContainText("hello");
  await expect(editor).toContainText("world");
});

test("markdown shortcuts and slash commands create editable blocks", async ({
  page,
}) => {
  await reset(page);
  const editor = page.locator("#noteEditor");

  await editor.click();
  await page.keyboard.type("#");
  await page.keyboard.press("Space");
  await page.keyboard.type("Heading");
  await expect(editor.locator("h1")).toHaveText("Heading");

  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await page.keyboard.type("/quote");
  await expect(page.locator(".slash-menu")).toBeVisible();
  await expect(page.locator(".slash-menu")).toContainText("Quote");
  await page.locator(".slash-item", { hasText: "Quote" }).click();
  await expect(editor.locator("blockquote")).toHaveCount(1);
});

test("tabs, search, and code document mode stay in sync", async ({ page }) => {
  await reset(page);
  const editor = page.locator("#noteEditor");

  await editor.click();
  await page.keyboard.type("first note");
  await page.waitForTimeout(650);

  await page.getByTitle("New note (⌘T)").click();
  await page.locator(".tab.active .tab-btn").dblclick();
  await page.locator(".tab-rename-input").fill("script.js");
  await page.keyboard.press("Enter");

  await expect(editor.locator(".cm-editor")).toBeVisible();
  await editor.locator(".cm-content").click();
  await page.keyboard.type("const value = 1;");
  await page.waitForTimeout(650);

  await expect
    .poll(async () => (await activeStorage(page)).content)
    .toBe("const value = 1;");

  await page.keyboard.press("ControlOrMeta+K");
  await page.locator(".doc-search").fill("first");
  await expect(page.locator(".search-result")).toContainText("first note");
  await page.keyboard.press("Enter");
  await expect(editor.locator(".cm-editor")).toHaveCount(0);
  await expect(editor).toContainText("first note");
});

test("image embeds and shared links preserve markdown serialization", async ({
  page,
}) => {
  await reset(page);
  const editor = page.locator("#noteEditor");

  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await editor.click();
  await page.evaluate(() =>
    navigator.clipboard.writeText("![alt](https://example.com/image.png)"),
  );
  await page.keyboard.press("ControlOrMeta+V");
  await page.waitForTimeout(650);

  await expect(editor.locator(".image-embed img")).toHaveAttribute(
    "src",
    "https://example.com/image.png",
  );
  await expect
    .poll(async () => (await activeStorage(page)).content)
    .toContain("![alt](https://example.com/image.png)");

  await page.getByTitle("Copy share link").click();
  const sharedUrl = await page.evaluate(() => navigator.clipboard.readText());
  await page.goto(sharedUrl);
  await expect(editor.locator(".image-embed img")).toHaveAttribute(
    "src",
    "https://example.com/image.png",
  );
});
