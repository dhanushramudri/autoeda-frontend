import { NextRequest, NextResponse } from "next/server";

async function proxyHandler(request: NextRequest) {
  try {
    const url = new URL(request.url);
    let pathname = url.pathname;
    const searchParams = url.search;

    pathname = pathname.replace(/^\/api/, "");
    pathname = pathname.replace(/^\/api\/v1/, "");

    const apiPath = pathname;

    const backendHost = process.env.EC2_API_URL || "http://localhost:8000";
    const ec2Url = backendHost.endsWith("/api/v1") ? backendHost : `${backendHost}/api/v1`;
    let fullUrl = `${ec2Url}${apiPath}${searchParams}`;

    console.log(`[Proxy] ${request.method} ${pathname}${searchParams} -> ${fullUrl}`);

    const headers = new Headers();

    if (request.headers.get("authorization")) {
      headers.set("authorization", request.headers.get("authorization")!);
    }

    const contentType = request.headers.get("content-type");
    if (contentType) {
      headers.set("Content-Type", contentType);
    }

    let body: BodyInit | undefined;
    if (request.method !== "GET" && request.method !== "HEAD") {
      body = await request.arrayBuffer();
    }

    // FastAPI 307-redirects when the trailing slash doesn't match its route
    // (e.g. collection routes like "/workspaces/"). Node's fetch auto-follows
    // redirects but fails to resend an ArrayBuffer body ("detached
    // ArrayBuffer"), so we follow redirects manually and resend it ourselves.
    let response = await fetch(fullUrl, {
      method: request.method,
      headers: Object.fromEntries(headers),
      body: body ? body : undefined,
      redirect: "manual",
    });

    let redirects = 0;
    while ([301, 302, 303, 307, 308].includes(response.status) && redirects < 5) {
      const location = response.headers.get("location");
      if (!location) break;
      fullUrl = new URL(location, fullUrl).toString();
      response = await fetch(fullUrl, {
        method: request.method,
        headers: Object.fromEntries(headers),
        body: body ? body : undefined,
        redirect: "manual",
      });
      redirects++;
    }

    // Stream the body straight through instead of buffering it with
    // .text() — buffering means SSE endpoints (e.g. Scout's chat stream)
    // would only reach the browser as one blob after the whole response
    // finishes, defeating the point of streaming.
    const responseHeaders = new Headers();
    const respContentType = response.headers.get("content-type");
    if (respContentType) responseHeaders.set("content-type", respContentType);

    return new NextResponse(response.body, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("[Proxy Error]", error);
    return NextResponse.json(
      { error: "Proxy error", details: String(error) },
      { status: 500 }
    );
  }
}

export const GET = proxyHandler;
export const POST = proxyHandler;
export const PUT = proxyHandler;
export const PATCH = proxyHandler;
export const DELETE = proxyHandler;
export const HEAD = proxyHandler;
