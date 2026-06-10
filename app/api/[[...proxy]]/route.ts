import { NextRequest, NextResponse } from "next/server";

async function proxyHandler(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const searchParams = url.search;
    
    const apiPath = pathname.replace(/^\/api/, "");
    const ec2Url = process.env.EC2_API_URL || "http://localhost:8000/api/v1";
    const fullUrl = `${ec2Url}${apiPath}${searchParams}`;

    console.log(`[Proxy] ${request.method} ${apiPath}${searchParams} -> ${fullUrl}`);

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

    const response = await fetch(fullUrl, {
      method: request.method,
      headers: Object.fromEntries(headers),
      body: body ? body : undefined,
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
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