import { describe, expect, it, vi } from "vitest";
import { HttpViesClient } from "./vies";

function jsonOk(body: string): Response {
  return new Response(body, { status: 200, headers: { "Content-Type": "text/xml" } });
}

const validSoap = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <checkVatResponse xmlns="urn:ec.europa.eu:taxud:vies:services:checkVat:types">
      <countryCode>PT</countryCode>
      <vatNumber>509442013</vatNumber>
      <requestDate>2026-05-19+02:00</requestDate>
      <valid>true</valid>
      <name>NOMAD CONSULTING LDA</name>
      <address>RUA DAS FLORES 12, 1000-100 LISBOA</address>
    </checkVatResponse>
  </soap:Body>
</soap:Envelope>`;

const invalidSoap = validSoap
  .replace("<valid>true</valid>", "<valid>false</valid>")
  .replace("<name>NOMAD CONSULTING LDA</name>", "<name>---</name>")
  .replace("<address>RUA DAS FLORES 12, 1000-100 LISBOA</address>", "<address>---</address>");

const faultSoap = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <soap:Fault>
      <faultcode>soap:Server</faultcode>
      <faultstring>MS_UNAVAILABLE</faultstring>
    </soap:Fault>
  </soap:Body>
</soap:Envelope>`;

describe("HttpViesClient.lookup", () => {
  it("parses a valid SOAP response", async () => {
    const fetchFn = vi.fn(async () => jsonOk(validSoap));
    const client = new HttpViesClient({ fetch: fetchFn });
    const result = await client.lookup("PT", "509442013");
    expect(result).toEqual({
      countryCode: "PT",
      vatNumber: "509442013",
      valid: true,
      name: "NOMAD CONSULTING LDA",
      address: "RUA DAS FLORES 12, 1000-100 LISBOA",
      requestDate: "2026-05-19+02:00",
    });
  });

  it("returns a valid:false result with null name/address when VIES says ---", async () => {
    const fetchFn = vi.fn(async () => jsonOk(invalidSoap));
    const client = new HttpViesClient({ fetch: fetchFn });
    const result = await client.lookup("PT", "509442013");
    expect(result).not.toBeNull();
    expect(result?.valid).toBe(false);
    expect(result?.name).toBeNull();
    expect(result?.address).toBeNull();
  });

  it("returns null on a SOAP fault", async () => {
    const fetchFn = vi.fn(async () => jsonOk(faultSoap));
    const client = new HttpViesClient({ fetch: fetchFn });
    const result = await client.lookup("PT", "509442013");
    expect(result).toBeNull();
  });

  it("returns null on non-200 response", async () => {
    const fetchFn = vi.fn(async () => new Response("oops", { status: 500 }));
    const client = new HttpViesClient({ fetch: fetchFn });
    const result = await client.lookup("PT", "509442013");
    expect(result).toBeNull();
  });

  it("returns null on a fetch rejection (network drop)", async () => {
    const fetchFn = vi.fn(async () => {
      throw new Error("network unreachable");
    });
    const client = new HttpViesClient({ fetch: fetchFn });
    const result = await client.lookup("PT", "509442013");
    expect(result).toBeNull();
  });

  it("rejects malformed country code without hitting the network", async () => {
    const fetchFn = vi.fn();
    const client = new HttpViesClient({ fetch: fetchFn as unknown as typeof fetch });
    const result = await client.lookup("Portugal", "509442013");
    expect(result).toBeNull();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("rejects malformed VAT number without hitting the network", async () => {
    const fetchFn = vi.fn();
    const client = new HttpViesClient({ fetch: fetchFn as unknown as typeof fetch });
    const result = await client.lookup("PT", "abc123");
    expect(result).toBeNull();
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
