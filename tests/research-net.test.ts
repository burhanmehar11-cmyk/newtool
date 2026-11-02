import { describe, expect, it } from "vitest";
import { checkFetchUrl, isPublicAddress } from "@/lib/research/net-policy";
import { parseRobots, robotsAllows } from "@/lib/research/robots";

describe("SSRF address policy", () => {
  it.each([
    "127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "224.0.0.1", "255.255.255.255",
    "::1", "::", "fe80::1", "fd00::1", "fc00::abcd", "::ffff:127.0.0.1", "::ffff:10.0.0.1", "::ffff:7f00:1", "64:ff9b::a9fe:a9fe", "2001:db8::1", "ff02::1",
  ])("blocks %s", (ip) => expect(isPublicAddress(ip)).toBe(false));

  it.each(["8.8.8.8", "93.184.216.34", "172.32.0.1", "2606:4700:4700::1111", "::ffff:8.8.8.8"])("allows %s", (ip) => expect(isPublicAddress(ip)).toBe(true));

  it("rejects non-http schemes, credentials, odd ports and local names", () => {
    for (const u of ["file:///etc/passwd", "ftp://x.example/", "http://user:pw@x.example/", "http://x.example:8080/", "http://localhost/", "http://foo.internal/", "http://127.0.0.1/", "http://[::1]/", "http://intranet/", "javascript:alert(1)"]) {
      expect(checkFetchUrl(u).ok, u).toBe(false);
    }
    expect(checkFetchUrl("https://www.example.com/contact#x")).toMatchObject({ ok: true });
  });
});

describe("robots.txt", () => {
  const txt = `
User-agent: *
Disallow: /private
Allow: /private/ok
Disallow: /*.pdf$

User-agent: Locentio
Disallow: /no-locentio
`;
  it("uses our own group when present", () => {
    const r = parseRobots(txt, "Locentio/0.1");
    expect(robotsAllows(r, "/no-locentio/page")).toBe(false);
    expect(robotsAllows(r, "/private")).toBe(true); // our group doesn't block it
  });
  it("falls back to * with longest-match precedence and wildcards", () => {
    const r = parseRobots(txt, "OtherBot");
    expect(robotsAllows(r, "/private/x")).toBe(false);
    expect(robotsAllows(r, "/private/ok/x")).toBe(true);
    expect(robotsAllows(r, "/forms/intake.pdf")).toBe(false);
    expect(robotsAllows(r, "/forms/intake.pdf?v=1")).toBe(true);
    expect(robotsAllows(r, "/")).toBe(true);
  });
  it("treats an empty Disallow as allow-all", () => {
    expect(robotsAllows(parseRobots("User-agent: *\nDisallow:", "x"), "/anything")).toBe(true);
  });
});
