#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// USPS Web Tools API - requires free registration at https://www.usps.com/business/web-tools-apis/
const USER_AGENT = "mcp-usps/1.0.0";
const BASE = "https://secure.shippingapis.com/ShippingAPI.dll";
const RATE_LIMIT_MS = 500;
let lastRequestTime = 0;

function getApiKey(): string {
  const key = process.env.USPS_USER_ID;
  if (!key) throw new Error("USPS_USER_ID required. Register free at https://www.usps.com/business/web-tools-apis/");
  return key;
}

async function rateLimitedFetch(url: string): Promise<string> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < RATE_LIMIT_MS) await new Promise((r) => setTimeout(r, RATE_LIMIT_MS - elapsed));
  lastRequestTime = Date.now();
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`USPS API error: ${res.status}`);
  return res.text();
}

// Simple XML tag extractor
function extractTag(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "i"));
  return m ? m[1].trim() : "";
}

function extractAll(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "gi");
  const results: string[] = [];
  let m;
  while ((m = re.exec(xml)) !== null) results.push(m[1]);
  return results;
}

const server = new McpServer({ name: "mcp-usps", version: "1.0.0" });

server.tool(
  "validate_address",
  "Validate and standardize a US address via USPS.",
  {
    address1: z.string().optional().describe("Apartment/Suite (USPS calls this Address1)"),
    address2: z.string().describe("Street address (USPS calls this Address2)"),
    city: z.string().describe("City"),
    state: z.string().describe("2-letter state code"),
    zip5: z.string().optional().describe("5-digit ZIP"),
  },
  async ({ address1, address2, city, state, zip5 }) => {
    const userId = getApiKey();
    const xml = `<AddressValidateRequest USERID="${userId}"><Address><Address1>${address1 || ""}</Address1><Address2>${address2}</Address2><City>${city}</City><State>${state}</State><Zip5>${zip5 || ""}</Zip5><Zip4></Zip4></Address></AddressValidateRequest>`;
    const result = await rateLimitedFetch(`${BASE}?API=Verify&XML=${encodeURIComponent(xml)}`);
    
    const error = extractTag(result, "Error");
    if (error) {
      return { content: [{ type: "text" as const, text: JSON.stringify({ error: extractTag(error, "Description") }) }] };
    }

    return { content: [{ type: "text" as const, text: JSON.stringify({
      address1: extractTag(result, "Address1"),
      address2: extractTag(result, "Address2"),
      city: extractTag(result, "City"),
      state: extractTag(result, "State"),
      zip5: extractTag(result, "Zip5"),
      zip4: extractTag(result, "Zip4"),
    }, null, 2) }] };
  }
);

server.tool(
  "lookup_zipcode",
  "Look up ZIP code for a city/state.",
  {
    city: z.string(),
    state: z.string().describe("2-letter state code"),
  },
  async ({ city, state }) => {
    const userId = getApiKey();
    const xml = `<CityStateLookupRequest USERID="${userId}"><ZipCode><Zip5></Zip5></ZipCode></CityStateLookupRequest>`;
    // Actually use ZipCodeLookup which takes address
    const xml2 = `<ZipCodeLookupRequest USERID="${userId}"><Address><Address1></Address1><Address2></Address2><City>${city}</City><State>${state}</State></Address></ZipCodeLookupRequest>`;
    const result = await rateLimitedFetch(`${BASE}?API=ZipCodeLookup&XML=${encodeURIComponent(xml2)}`);
    return { content: [{ type: "text" as const, text: JSON.stringify({
      city: extractTag(result, "City"),
      state: extractTag(result, "State"),
      zip5: extractTag(result, "Zip5"),
      zip4: extractTag(result, "Zip4"),
    }, null, 2) }] };
  }
);

server.tool(
  "city_state_lookup",
  "Look up city and state for a ZIP code.",
  {
    zip5: z.string().describe("5-digit ZIP code"),
  },
  async ({ zip5 }) => {
    const userId = getApiKey();
    const xml = `<CityStateLookupRequest USERID="${userId}"><ZipCode><Zip5>${zip5}</Zip5></ZipCode></CityStateLookupRequest>`;
    const result = await rateLimitedFetch(`${BASE}?API=CityStateLookup&XML=${encodeURIComponent(xml)}`);
    return { content: [{ type: "text" as const, text: JSON.stringify({
      zip5: extractTag(result, "Zip5"),
      city: extractTag(result, "City"),
      state: extractTag(result, "State"),
    }, null, 2) }] };
  }
);

server.tool(
  "track_package",
  "Track a USPS package by tracking number.",
  {
    trackingNumber: z.string().describe("USPS tracking number"),
  },
  async ({ trackingNumber }) => {
    const userId = getApiKey();
    const xml = `<TrackFieldRequest USERID="${userId}"><TrackID ID="${trackingNumber}"></TrackID></TrackFieldRequest>`;
    const result = await rateLimitedFetch(`${BASE}?API=TrackV2&XML=${encodeURIComponent(xml)}`);
    
    const summaryRaw = extractTag(result, "TrackSummary");
    const detailsRaw = extractAll(result, "TrackDetail");

    return { content: [{ type: "text" as const, text: JSON.stringify({
      summary: {
        event: extractTag(summaryRaw, "Event"),
        eventDate: extractTag(summaryRaw, "EventDate"),
        eventTime: extractTag(summaryRaw, "EventTime"),
        eventCity: extractTag(summaryRaw, "EventCity"),
        eventState: extractTag(summaryRaw, "EventState"),
        eventZip: extractTag(summaryRaw, "EventZIPCode"),
      },
      details: detailsRaw.map(d => ({
        event: extractTag(d, "Event"),
        eventDate: extractTag(d, "EventDate"),
        eventTime: extractTag(d, "EventTime"),
        eventCity: extractTag(d, "EventCity"),
        eventState: extractTag(d, "EventState"),
      })),
    }, null, 2) }] };
  }
);

server.tool(
  "calculate_rate",
  "Calculate USPS shipping rate for a domestic package.",
  {
    service: z.enum(["PRIORITY", "EXPRESS", "FIRST CLASS", "PARCEL", "LIBRARY", "MEDIA"]).default("PRIORITY"),
    zipFrom: z.string().describe("Origin 5-digit ZIP"),
    zipTo: z.string().describe("Destination 5-digit ZIP"),
    pounds: z.number().min(0).default(0),
    ounces: z.number().min(0).default(0),
    container: z.string().optional().describe("Container type (e.g. 'FLAT RATE BOX', 'FLAT RATE ENVELOPE')"),
  },
  async ({ service, zipFrom, zipTo, pounds, ounces, container }) => {
    const userId = getApiKey();
    const xml = `<RateV4Request USERID="${userId}"><Package ID="1"><Service>${service}</Service><ZipOrigination>${zipFrom}</ZipOrigination><ZipDestination>${zipTo}</ZipDestination><Pounds>${pounds}</Pounds><Ounces>${ounces}</Ounces><Container>${container || ""}</Container><Machinable>true</Machinable></Package></RateV4Request>`;
    const result = await rateLimitedFetch(`${BASE}?API=RateV4&XML=${encodeURIComponent(xml)}`);
    
    return { content: [{ type: "text" as const, text: JSON.stringify({
      service: extractTag(result, "MailService"),
      rate: extractTag(result, "Rate"),
      commitments: extractTag(result, "CommitmentName"),
    }, null, 2) }] };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => { console.error("Fatal:", err); process.exit(1); });
