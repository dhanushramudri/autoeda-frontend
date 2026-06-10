import { NextRequest, NextResponse } from "next/server";

export async function handler(request: NextRequest) {
  try {
    // Get the path that was requested
    const pathname = new URL(request.url).pathname;
    
    // Remove /api prefix to get the actual API path
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

export const POST = handler;
export const GET = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const HEAD = handler;