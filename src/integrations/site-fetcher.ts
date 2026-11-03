import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import http from "node:http";
import https from "node:https";
import type { LookupFunction } from "node:net";
import { isBlockedAddress } from "@/domain/url/ip";
import { validateUrl } from "@/domain/url/validate";

const TIMEOUT_MS = 8_000;
const MAX_BYTES = 512 * 1024;
const MAX_REDIRECTS = 3;

export interface FetchedPage {
  finalUrl: string;
  headers: Record<string, string>;
  html: string;
}

type Resolver = (
  hostname: string,
  callback: (error: Error | null, addresses: LookupAddress[]) => void,
) => void;

const systemResolver: Resolver = (hostname, callback) =>
  dnsLookup(hostname, { all: true }, (error, addresses) => callback(error, addresses ?? []));

/**
 * A DNS lookup that refuses private addresses. It runs at connect time, so a
 * hostname can't pass a check and then resolve somewhere else (DNS rebinding).
 */
export function createSafeLookup(resolve: Resolver = systemResolver): LookupFunction {
  return (hostname, options, callback) => {
    resolve(hostname, (error, addresses) => {
      if (error) return callback(error, "", 0);
      if (addresses.length === 0 || addresses.some((entry) => isBlockedAddress(entry.address))) {
        return callback(new Error("Blocked address"), "", 0);
      }
      if (options.all) return (callback as unknown as (e: null, a: LookupAddress[]) => void)(null, addresses);
      callback(null, addresses[0].address, addresses[0].family);
    });
  };
}

function requestOnce(url: URL, lookup: LookupFunction): Promise<http.IncomingMessage> {
  const client = url.protocol === "https:" ? https : http;
  return new Promise((resolve, reject) => {
    const request = client.get(
      url,
      {
        lookup,
        timeout: TIMEOUT_MS,
        headers: {
          "user-agent": "VitalWatch/1.0 (+stack detection)",
          accept: "text/html",
          // No compression, so the size cap counts what's actually read.
          "accept-encoding": "identity",
        },
      },
      resolve,
    );
    request.on("timeout", () => request.destroy(new Error("Timed out")));
    request.on("error", reject);
  });
}

function readCapped(response: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    response.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BYTES) {
        chunks.push(chunk.subarray(0, chunk.length - (size - MAX_BYTES)));
        response.destroy();
        resolve(Buffer.concat(chunks).toString("utf8"));
        return;
      }
      chunks.push(chunk);
    });
    response.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    response.on("error", reject);
  });
}

/**
 * Fetches a public page's headers and the start of its HTML for stack
 * detection. Every redirect is validated again, and private addresses are
 * refused at connect time. Never throws; returns null when the page can't be read.
 */
export async function fetchPublicPage(
  input: string,
  lookup: LookupFunction = createSafeLookup(),
): Promise<FetchedPage | null> {
  let current = input;
  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const validation = validateUrl(current);
      if (!validation.ok) return null;
      const url = new URL(validation.url);

      const response = await requestOnce(url, lookup);
      const status = response.statusCode ?? 0;

      if (status >= 300 && status < 400 && response.headers.location) {
        response.resume();
        current = new URL(response.headers.location, url).toString();
        continue;
      }

      const headers: Record<string, string> = {};
      for (const [name, value] of Object.entries(response.headers)) {
        if (value !== undefined) headers[name] = Array.isArray(value) ? value.join(", ") : value;
      }
      const isHtml = (headers["content-type"] ?? "").includes("text/html");
      const html = isHtml ? await readCapped(response) : (response.resume(), "");
      return { finalUrl: url.toString(), headers, html };
    }
    return null;
  } catch {
    return null;
  }
}
