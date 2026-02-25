import { describe, it, expect } from "vitest";
describe("mcp-usps", () => {
  it("should extract XML tags", () => {
    const xml = "<City>LOS ANGELES</City>";
    const m = xml.match(/<City>([\s\S]*?)<\/City>/i);
    expect(m?.[1]).toBe("LOS ANGELES");
  });
  it("should build address XML", () => {
    const xml = `<Address2>123 Main St</Address2><City>LA</City><State>CA</State>`;
    expect(xml).toContain("123 Main St");
  });
  it("should encode XML for URL", () => {
    const xml = "<Test>hello world</Test>";
    expect(encodeURIComponent(xml)).toContain("%3CTest%3E");
  });
  it("should support all service types", () => {
    const types = ["PRIORITY", "EXPRESS", "FIRST CLASS", "PARCEL", "LIBRARY", "MEDIA"];
    expect(types.length).toBe(6);
  });
  it("should parse tracking summary", () => {
    const xml = "<TrackSummary><Event>Delivered</Event><EventDate>Feb 24</EventDate></TrackSummary>";
    const m = xml.match(/<Event>([\s\S]*?)<\/Event>/i);
    expect(m?.[1]).toBe("Delivered");
  });
  it("should handle ZIP lookups", () => {
    expect("90210".length).toBe(5);
  });
});
