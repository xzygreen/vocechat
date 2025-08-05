import { serve } from "https://deno.land/std/http/server.ts";

// 从环境变量中获取你的Vocechat Space URL
const UPSTREAM_URL = Deno.env.get("UPSTREAM_URL");

if (!UPSTREAM_URL) {
  console.error("错误：环境变量 UPSTREAM_URL 未设置！");
  Deno.exit(1);
}

serve(async (req: Request) => {
  const url = new URL(req.url);
  const upstreamUrl = new URL(UPSTREAM_URL);

  // 构造目标URL
  upstreamUrl.pathname = url.pathname;
  upstreamUrl.search = url.search;

  // 检查是否为WebSocket升级请求
  if (req.headers.get("Upgrade")?.toLowerCase() === "websocket") {
    console.log(`[WebSocket] 正在代理到: ${upstreamUrl}`);

    // Deno标准库的WebSocket升级功能
    const { socket: clientSocket, response } = Deno.upgradeWebSocket(req);

    // 建立到上游服务器的WebSocket连接
    // 注意：需要将 https:// 替换为 wss://
    upstreamUrl.protocol = "wss";
    const upstreamSocket = new WebSocket(upstreamUrl.toString(), [
      "Sec-WebSocket-Protocol",
    ]);

    // 在两个WebSocket连接之间双向传递消息
    clientSocket.onopen = () => console.log("[WebSocket] 客户端已连接");
    clientSocket.onmessage = (e) => upstreamSocket.send(e.data);
    clientSocket.onerror = (e) => console.error("[WebSocket] 客户端错误:", e);
    clientSocket.onclose = () => {
      console.log("[WebSocket] 客户端已断开");
      if (upstreamSocket.readyState === WebSocket.OPEN) upstreamSocket.close();
    };

    upstreamSocket.onopen = () => console.log("[WebSocket] 上游已连接");
    upstreamSocket.onmessage = (e) => clientSocket.send(e.data);
    upstreamSocket.onerror = (e) => console.error("[WebSocket] 上游错误:", e);
    upstreamSocket.onclose = () => {
      console.log("[WebSocket] 上游已断开");
      if (clientSocket.readyState === WebSocket.OPEN) clientSocket.close();
    };

    return response;
  }

  // 处理所有常规HTTP请求
  console.log(`[HTTP] 正在代理到: ${upstreamUrl}`);
  return fetch(new Request(upstreamUrl.toString(), req));
});
