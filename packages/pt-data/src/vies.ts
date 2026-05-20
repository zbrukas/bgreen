// EU VIES (VAT Information Exchange System) client.
//
// VIES has a stable SOAP endpoint that the rest of the EU tooling has
// targeted for two decades. Their REST surface comes and goes, so we
// hand-roll a small SOAP request + regex-based response extractor. The
// payload is well-formed and predictable; an XML library would be overkill.
//
// All failure modes — non-200, timeout, parse error, network drop —
// collapse to `null`. Callers should not distinguish "VIES is down" from
// "this VAT number doesn't exist"; both fall back to manual entry.

const VIES_ENDPOINT = "https://ec.europa.eu/taxation_customs/vies/services/checkVatService";

export interface ViesResult {
  countryCode: string;
  vatNumber: string;
  valid: boolean;
  name: string | null;
  address: string | null;
  requestDate: string;
}

export interface ViesClient {
  lookup(countryCode: string, vatNumber: string): Promise<ViesResult | null>;
}

export interface HttpViesClientOptions {
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
}

export class HttpViesClient implements ViesClient {
  private readonly fetchFn: typeof globalThis.fetch;
  private readonly timeoutMs: number;

  constructor(options: HttpViesClientOptions = {}) {
    this.fetchFn = options.fetch ?? globalThis.fetch;
    this.timeoutMs = options.timeoutMs ?? 4000;
  }

  async lookup(countryCode: string, vatNumber: string): Promise<ViesResult | null> {
    if (!/^[A-Z]{2}$/.test(countryCode)) return null;
    if (!/^\d{1,12}$/.test(vatNumber)) return null;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await this.fetchFn(VIES_ENDPOINT, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "text/xml; charset=utf-8",
          SOAPAction: "",
        },
        body: buildSoapRequest(countryCode, vatNumber),
      });
      if (!res.ok) return null;
      const xml = await res.text();
      return parseSoapResponse(xml, countryCode, vatNumber);
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}

function buildSoapRequest(countryCode: string, vatNumber: string): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">',
    "  <soap:Body>",
    '    <checkVat xmlns="urn:ec.europa.eu:taxud:vies:services:checkVat:types">',
    `      <countryCode>${countryCode}</countryCode>`,
    `      <vatNumber>${vatNumber}</vatNumber>`,
    "    </checkVat>",
    "  </soap:Body>",
    "</soap:Envelope>",
  ].join("\n");
}

function extractTag(xml: string, tag: string): string | null {
  // Handles unprefixed and prefixed tags (e.g., <ns2:name>) plus extra whitespace.
  const re = new RegExp(`<(?:[\\w-]+:)?${tag}>([\\s\\S]*?)</(?:[\\w-]+:)?${tag}>`);
  const match = xml.match(re);
  if (!match) return null;
  const raw = match[1] ?? "";
  return decodeXmlEntities(raw.trim());
}

function decodeXmlEntities(input: string): string {
  return input
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function parseSoapResponse(
  xml: string,
  fallbackCountry: string,
  fallbackVat: string,
): ViesResult | null {
  // Any SOAP fault → treat as "no result"; callers can't act on the difference.
  if (/<(?:[\w-]+:)?Fault>/.test(xml)) return null;

  const validRaw = extractTag(xml, "valid");
  if (validRaw === null) return null;
  const valid = validRaw === "true";

  const name = extractTag(xml, "name");
  const address = extractTag(xml, "address");
  const requestDate = extractTag(xml, "requestDate") ?? new Date().toISOString();
  const countryCode = extractTag(xml, "countryCode") ?? fallbackCountry;
  const vatNumber = extractTag(xml, "vatNumber") ?? fallbackVat;

  return {
    countryCode,
    vatNumber,
    valid,
    name: name && name !== "---" && name !== "" ? name : null,
    address: address && address !== "---" && address !== "" ? address : null,
    requestDate,
  };
}
