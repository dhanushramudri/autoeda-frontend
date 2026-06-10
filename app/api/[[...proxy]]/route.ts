import { NextRequest, NextResponse } from "next/server";

async function proxyHandler(request: NextRequest) {
  try {
    const pathname = new URL(request.url).pathname;
    
    const apiPath = pathname.replace(/^\/api/, "");
    
    const ec2Url = process.env.EC2_API_URL || "http://localhost:8000/api/v1";
    const fullUrl = `${ec2Url}${apiPath}`;

    console.log(`[Proxy] ${request.method} ${apiPath} -> ${fullUrl}`);

    const response = await fetch(fullUrl, {
      method: request.method,
      headers: {
        "Content-Type": "application/json",
        ...(request.headers.get("authorization") && {
          authorization: request.headers.get("authorization")!,
        }),
      },
      body: request.method !== "GET" && request.method !== "HEAD" 
        ? await request.text() 
        : undefined,
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