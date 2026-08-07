import { describe, it, expect } from "vitest";
import { toCsv } from "./csv";

/**
 * RC-9 — regression coverage for the real CSV/formula-injection fix
 * (csv.ts's own doc comment has the full live-pentest finding). Every
 * CSV export in this codebase goes through `toCsv`, so this one test
 * file protects all of them.
 */
describe("toCsv — formula-injection neutralization", () => {
  it("prefixes a leading '=' with a single quote", () => {
    const csv = toCsv([{ name: "=1+1+cmd|' /C calc'!A0" }], [{ header: "Name", value: (r) => r.name }]);
    expect(csv).toContain("'=1+1+cmd|' /C calc'!A0");
    expect(csv).not.toMatch(/\r\n=1\+1/); // never the raw, un-neutralized formula on its own line
  });

  it("prefixes a leading '+', '-', and '@' the same way", () => {
    for (const trigger of ["+1+1", "-1+1", "@SUM(1,1)"]) {
      const csv = toCsv([{ v: trigger }], [{ header: "V", value: (r) => r.v }]);
      expect(csv).toContain(`'${trigger}`);
    }
  });

  it("leaves ordinary values (no leading formula-trigger character) completely untouched", () => {
    const csv = toCsv([{ name: "Priya Sharma" }], [{ header: "Name", value: (r) => r.name }]);
    expect(csv).toContain("\r\nPriya Sharma");
    expect(csv).not.toContain("'Priya Sharma");
  });

  it("still applies standard CSV quoting/escaping after formula-neutralization", () => {
    const csv = toCsv([{ name: '=1,"2"' }], [{ header: "Name", value: (r) => r.name }]);
    // Neutralized first ('=1,"2" -> quote becomes doubled, whole field wrapped in quotes)
    expect(csv).toContain(`"'=1,""2"""`);
  });

  it("never breaks a null/undefined value", () => {
    const csv = toCsv([{ name: null }], [{ header: "Name", value: () => null }]);
    expect(csv.split("\r\n")[1]).toBe("");
  });
});
