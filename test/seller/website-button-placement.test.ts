import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const wizard = readFileSync("src/components/startups/seller-wizard.tsx", "utf8");
const websiteCss = readFileSync("src/styles/seller-website-setup.css", "utf8");
const actionCss = readFileSync("src/styles.css", "utf8");

describe("seller Website-step button placement", () => {
  it("keeps only the website field and Check website in the input row", () => {
    const fieldRow = wizard.match(/<div className=\{`seller-web-field[\s\S]*?<\/div>/)?.[0];
    expect(fieldRow).toBeDefined();
    expect(fieldRow).toContain("WebsiteCheckLink");
    expect(fieldRow).not.toContain("No company website");
    expect(websiteCss).toContain(".seller-web-field {display:grid;grid-template-columns:minmax(0,1fr) auto;");
    expect(websiteCss).not.toContain(".seller-web-field.is-initial");
  });

  it("puts No company website immediately before Continue with its existing action", () => {
    const noWebsite = wizard.indexOf('className="seller-action seller-action-no-website"');
    const continueButton = wizard.indexOf('className={cur.id === "web" ? "seller-action seller-action-primary"');
    expect(noWebsite).toBeGreaterThan(-1);
    expect(continueButton).toBeGreaterThan(noWebsite);
    expect(wizard.slice(noWebsite, continueButton)).toContain('set({web:""}); setWebExpanded(true);');
    expect(wizard.slice(noWebsite, continueButton)).not.toContain("seller-action-primary");
  });

  it("uses the shared 12px wrapping action row and equal-height bordered buttons", () => {
    expect(actionCss).toContain(".seller-website-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 12px;");
    expect(actionCss).toContain(".seller-website-actions .seller-action { height: 50px;");
    expect(actionCss).toContain(".seller-website-actions .seller-action-no-website { padding: 0 16px; font-size: 14px; }");
  });
});
