import { afterAll, beforeAll, describe, expect, it } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { safeFetch } from "@/server/research/fetch";

let server: http.Server;
let port = 0;
const UA = "Locentio-test";
const deadline = () => Date.now() + 5000;

beforeAll(async () => {
  server = http.createServer((req, res) => {
    if (req.url === "/redirect") {
      res.writeHead(302, { location: `http://127.0.0.1:${port}/secret` });
      return res.end();
    }
    res.writeHead(200, { "content-type": "text/html" });
    res.end("<p>internal secret</p>");
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  port = (server.address() as AddressInfo).port;
});
afterAll(() => server.close());

describe("safeFetch refuses non-public targets", () => {
  it.each([
    () => `http://127.0.0.1:${port}/`,
    () => "http://localhost/",
    () => "http://169.254.169.254/latest/meta-data/",
    () => "http://[::1]/",
    () => "http://10.0.0.5/",
    () => "file:///etc/passwd",
  ])("blocks %#", async (u) => {
    const r = await safeFetch(u(), { userAgent: UA, deadline: deadline() });
    expect(r.ok).toBe(false);
  });

  it("blocks public-looking names that resolve to private addresses (checked at connect time)", async () => {
    // localtest.me resolves to 127.0.0.1 in public DNS. If DNS is unavailable here the fetch also fails closed.
    const r = await safeFetch("http://localtest.me/", { userAgent: UA, deadline: deadline() });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).not.toMatch(/^HTTP/);
  });
});

import dns from "node:dns";
import { vi } from "vitest";

describe("connect-time address check", () => {
  it("refuses when DNS answers with a private address (rebinding-style)", async () => {
    const spy = vi.spyOn(dns, "lookup").mockImplementation(((host: string, _o: unknown, cb: (e: null, a: { address: string; family: number }[]) => void) => {
      cb(null, [{ address: "127.0.0.1", family: 4 }]);
    }) as unknown as typeof dns.lookup);
    const r = await safeFetch("http://innocent-looking.example/", { userAgent: UA, deadline: deadline() });
    spy.mockRestore();
    expect(r).toMatchObject({ ok: false, reason: "blocked: non-public address" });
  });

  it("refuses when any one of several answers is private", async () => {
    const spy = vi.spyOn(dns, "lookup").mockImplementation(((host: string, _o: unknown, cb: (e: null, a: { address: string; family: number }[]) => void) => {
      cb(null, [{ address: "93.184.216.34", family: 4 }, { address: "10.0.0.1", family: 4 }]);
    }) as unknown as typeof dns.lookup);
    const r = await safeFetch("https://mixed.example/", { userAgent: UA, deadline: deadline() });
    spy.mockRestore();
    expect(r).toMatchObject({ ok: false, reason: "blocked: non-public address" });
  });
});

import { dnsEmailCheck } from "@/server/research/email-check";

describe("free email check in a broken-DNS environment", () => {
  it("reports an error instead of marking a real-looking address invalid", async () => {
    const spy = vi.spyOn(dns.promises, "resolveMx").mockRejectedValue(Object.assign(new Error("not found"), { code: "ENOTFOUND" }));
    const s4 = vi.spyOn(dns.promises, "resolve4").mockRejectedValue(Object.assign(new Error("not found"), { code: "ENOTFOUND" }));
    const s6 = vi.spyOn(dns.promises, "resolve6").mockRejectedValue(Object.assign(new Error("not found"), { code: "ENOTFOUND" }));
    const r = await dnsEmailCheck("owner@realbusiness.com");
    spy.mockRestore();
    s4.mockRestore();
    s6.mockRestore();
    expect(r.status).toBe("error");
  });
});
