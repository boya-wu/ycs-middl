# Cursor × 本機 Supabase MCP 連線除錯筆記

本文件記錄一次實際除錯過程，避免下次把 MCP 指到錯誤端點。適用：**本機 `supabase start` + Cursor 透過 HTTP 連 MCP**。

## 症狀（Cursor MCP 日誌）

連線失敗時，日誌常見類似訊息：

1. `Error connecting to streamableHttp server, falling back to SSE: Streamable HTTP error: Error POSTing to endpoint:`
2. `Error connecting to SSE server after fallback: SSE error: Non-200 status code (405)`
3. `CreateClient completed, connected: false, statusType: error`

伺服器名稱可能是 `user-supabase`（Supabase Cursor 外掛註冊的 MCP）或你在 `mcp.json` 自訂的名稱。

## 根因（已用 curl 驗證）

本機有**兩個**容易混淆的位址：

| URL | 實際行為（重點） |
|-----|------------------|
| `http://127.0.0.1:54321/mcp` | 經由 **Kong**；對標準 MCP JSON-RPC `initialize` 常回 **400**；若客戶端改走 SSE 並對此路徑發 **GET**，則回 **405**。與上述日誌一致。 |
| `http://127.0.0.1:54323/api/mcp` | **Studio** 後端的 MCP API；同樣的 `initialize` 回 **200**，可正常 `tools/list`。 |

因此：**Cursor 的 MCP 設定必須指向 Studio 的 `/api/mcp`（埠 54323），不要只用 `npx supabase status` 印在「Development Tools」裡的 `54321/mcp`。**

`54321` 仍是 REST／Auth 等 API 閘道；`54323` 是本機 Studio。官方自架 MCP 說明亦以 Studio 路徑 `/api/mcp` 為準，見 [Enabling MCP Server Access（Supabase Docs）](https://supabase.com/docs/guides/self-hosting/enable-mcp)。

## 正確設定方式

### 1. 專案內（建議，已納入本 repo）

檔案：[`.cursor/mcp.json`](../.cursor/mcp.json)

```json
{
  "mcpServers": {
    "supabase": {
      "type": "http",
      "url": "http://127.0.0.1:54323/api/mcp"
    }
  }
}
```

### 2. 全機使用者設定（可選）

路徑（Windows）：`%USERPROFILE%\.cursor\mcp.json`  
內容與上相同即可；若與專案並存，以 Cursor 實際合併結果為準，但 **URL 必須是 `54323/api/mcp`**。

### 3. 鍵名提醒

Cursor 辨識的是 **`type`**（例如 `"http"`），不要用誤寫的 `transport`，否則客戶端可能無法正確選擇傳輸方式。

## 變更後請做

1. 確認本機 stack 已起：`npx supabase status`（需看到 Studio、且本機 MCP 實際可用端點為 **54323** 上的 `/api/mcp`）。
2. Cursor：**Settings → Cursor Settings → Tools & MCP** 重新整理或停用再啟用該 MCP；必要時重開 Cursor。
3. 若同時存在 **`user-supabase`（外掛）** 與 **`supabase`（mcp.json）** 兩筆，其中一筆仍指向舊 URL 時可能繼續報錯；可只保留連到 `http://127.0.0.1:54323/api/mcp` 的那一筆。

## 快速自檢（終端機）

本機需已 `supabase start`。下列應回 **HTTP 200** 且 body 含 `protocolVersion`：

```bash
curl -s -X POST "http://127.0.0.1:54323/api/mcp" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "MCP-Protocol-Version: 2025-06-18" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2025-06-18",
      "capabilities": { "elicitation": {} },
      "clientInfo": { "name": "curl-check", "title": "curl", "version": "1.0.0" }
    }
  }'
```

若改打 `http://127.0.0.1:54321/mcp`，則易得到 **400**／後續 SSE **405**，代表客戶端設錯位址。

## 連雲端 Supabase MCP（補充）

若改連託管服務，官方入口為 `https://mcp.supabase.com/mcp`，需完成 OAuth／權限流程；未授權時常見 **401**，與本機 **405** 情境不同。說明見 [Model context protocol (MCP) | Supabase Docs](https://supabase.com/docs/guides/getting-started/mcp)。

---

**摘要（一行）**：本機 Cursor MCP 請設 **`http://127.0.0.1:54323/api/mcp`**，不要用 **`http://127.0.0.1:54321/mcp`**。
