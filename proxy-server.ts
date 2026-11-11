const express = require("express");
const cors = require("cors");

type ZentridProxyHeaders = {
  accept?: string;
  authorization?: string;
  ['content-type']?: string;
  ['content-length']?: string;
  ['x-client-request-id']?: string;
};

type ZentridProxyRequest = {
  originalUrl: string;
  method: string;
  headers: ZentridProxyHeaders;
  body?: unknown;
};

type ZentridProxyNext = () => void;

type ZentridProxyResponse = {
  json(payload: unknown): void;
  status(code: number): ZentridProxyResponse;
  setHeader(name: string, value: string): void;
  send(payload: string): void;
};

const app = express();
const PORT = process.env.PORT || 5050;
const AUTH_TARGET = process.env.ZENTRID_AUTH_TARGET || "https://fleetosauth.unisys.am";
const DATA_TARGET = process.env.ZENTRID_DATA_TARGET || "https://fleetosapi.unisys.am";
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src-elem 'self'",
  "script-src-attr 'unsafe-inline'",
  "style-src-elem 'self'",
  "style-src-attr 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "connect-src 'self' http://localhost:5050 https://fleetosauth.unisys.am https://fleetosapi.unisys.am",
  "font-src 'self' data:",
  "worker-src 'self' blob:",
  "manifest-src 'self'"
].join("; ");
const CONTENT_SECURITY_POLICY_REPORT_ONLY = CONTENT_SECURITY_POLICY
  .replace("script-src-attr 'unsafe-inline'", "script-src-attr 'none'")
  .replace("style-src-attr 'unsafe-inline'", "style-src-attr 'none'");

app.use((_req: ZentridProxyRequest, res: ZentridProxyResponse, next: ZentridProxyNext) => {
  res.setHeader("Content-Security-Policy", CONTENT_SECURITY_POLICY);
  res.setHeader("Content-Security-Policy-Report-Only", CONTENT_SECURITY_POLICY_REPORT_ONLY);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  next();
});

app.use(cors());

// Preserve multipart uploads byte-for-byte before any structured body parser runs.
// The backend requires the actual file part, so forwarding the Express request
// stream after middleware has consumed it can result in an empty multipart body.
app.use(express.raw({
  type: (req: ZentridProxyRequest) => /^multipart\/form-data(?:;|$)/i.test(String(req.headers['content-type'] || '')),
  limit: '50mb'
}));
app.use(express.json({ limit: "10mb" }));

app.get("/health", (_req: ZentridProxyRequest, res: ZentridProxyResponse) => {
  res.json({ status: "ok", service: "Zentrid local proxy", port: PORT });
});

async function proxyRequest(targetBaseUrl: string, req: ZentridProxyRequest, res: ZentridProxyResponse): Promise<void> {
  try {
    const method = String(req.method || 'GET').toUpperCase();
    const contentType = String(req.headers['content-type'] || '');
    const isMultipart = /^multipart\/form-data(?:;|$)/i.test(contentType);
    const hasBody = !["GET", "HEAD"].includes(method);

    // JSON requests are parsed by express.json(), so re-serialize the parsed body.
    // Multipart requests are captured by express.raw() above and forwarded as the
    // exact Buffer received from the browser. This preserves boundaries and file bytes.
    const multipartBuffer = isMultipart && Buffer.isBuffer(req.body) ? req.body : undefined;
    const requestBody: unknown = !hasBody
      ? undefined
      : isMultipart
        ? multipartBuffer
        : JSON.stringify(req.body || {});

    if (isMultipart && !multipartBuffer) {
      res.status(400).json({
        message: 'Proxy multipart body missing',
        error: 'The local proxy did not receive a raw multipart payload.'
      });
      return;
    }

    const headers: Record<string, string> = {
      "Accept": req.headers.accept || "application/json",
      ...(req.headers.authorization ? { Authorization: req.headers.authorization } : {}),
      ...(req.headers['x-client-request-id'] ? { 'X-Client-Request-Id': req.headers['x-client-request-id'] } : {})
    };

    if (isMultipart) {
      // Preserve the complete incoming value, including boundary=... .
      headers['Content-Type'] = contentType;
      // Use the captured byte length rather than trusting a possibly stale inbound header.
      headers['Content-Length'] = String(multipartBuffer!.length);
    } else if (hasBody) {
      headers['Content-Type'] = contentType || 'application/json';
    }

    const init: RequestInit & { duplex?: 'half' } = {
      method,
      headers,
      ...(requestBody !== undefined ? { body: requestBody as BodyInit } : {})
    };

    const response = await fetch(`${targetBaseUrl}${req.originalUrl}`, init);

    const text = await response.text();
    res.status(response.status);
    res.setHeader("Content-Type", response.headers.get("content-type") || "application/json");
    res.send(text);
  } catch (error) {
    res.status(500).json({
      message: "Proxy error",
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

app.use("/api/Auth", (req: ZentridProxyRequest, res: ZentridProxyResponse) => proxyRequest(AUTH_TARGET, req, res));
app.use("/.well-known", (req: ZentridProxyRequest, res: ZentridProxyResponse) => proxyRequest(AUTH_TARGET, req, res));
app.use("/api", (req: ZentridProxyRequest, res: ZentridProxyResponse) => proxyRequest(DATA_TARGET, req, res));

// The compiled proxy lives inside dist, so __dirname is the generated application root.
app.use(express.static(__dirname));

app.listen(PORT, () => {
  console.log(`Zentrid proxy running on http://localhost:${PORT}`);
  console.log(`Auth API -> ${AUTH_TARGET}`);
  console.log(`Data API -> ${DATA_TARGET}`);
});
