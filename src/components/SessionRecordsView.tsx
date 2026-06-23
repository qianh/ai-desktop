import { useMemo, useState, type CSSProperties } from "react";
import { REPORTED_INTERCEPTS_LIMIT, type ConversationTruncationReason } from "../api";
import { formatTimestamp } from "../lib/format";
import { conversationPreview } from "../lib/conversationFilter";
import {
  draftToFilter,
  validateTimeRange,
  type ConversationRecordsFilter,
} from "../lib/conversationRecordsQuery";
import { pageListIdentityKey } from "../lib/pagePanelState";
import { loadSupabaseConfig } from "../lib/supabase";
import { useConversationRecords } from "../hooks/useConversationRecords";
import type { InterceptedFetch, Page } from "../types";
import { ACCENT, FONT, primaryBtn, secondaryBtn } from "../lib/ui";
import SessionRecordModal from "./modals/SessionRecordModal";

type Props = {
  pages: Page[];
};

const fieldLabel: CSSProperties = {
  fontSize: 10.5,
  fontWeight: 600,
  color: "#9a9aa0",
  letterSpacing: ".04em",
  textTransform: "uppercase",
  marginBottom: 6,
  display: "block",
};

const fieldInput: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  height: 32,
  border: "1px solid #d8d8dc",
  borderRadius: 8,
  padding: "0 10px",
  font: `12.5px ${FONT}`,
  color: "#1d1d1f",
  background: "#fff",
  outline: "none",
};

const timeRangeShell: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  height: 32,
  border: "1px solid #d8d8dc",
  borderRadius: 8,
  background: "#fff",
  overflow: "hidden",
};

const timeRangeInput: CSSProperties = {
  width: 158,
  height: "100%",
  border: "none",
  padding: "0 8px",
  font: `12px ${FONT}`,
  color: "#1d1d1f",
  background: "transparent",
  outline: "none",
};

const ghostBtn: CSSProperties = {
  ...secondaryBtn,
  fontSize: 12,
  padding: "6px 12px",
  borderRadius: 7,
  color: "#5a5a5e",
  height: 32,
};

function truncationHint(reason: ConversationTruncationReason | null): string {
  switch (reason) {
    case "scan_limit":
      return "已扫描大量记录，可能还有更多未显示";
    case "candidate_cap":
      return "匹配记录过多，部分未加载";
    case "display_cap":
      return `仅显示最近 ${REPORTED_INTERCEPTS_LIMIT} 条`;
    default:
      return `仅显示最近 ${REPORTED_INTERCEPTS_LIMIT} 条`;
  }
}

const queryBtn = (loading: boolean): CSSProperties => ({
  ...primaryBtn,
  fontSize: 12.5,
  padding: "0 20px",
  height: 32,
  borderRadius: 8,
  cursor: loading ? "default" : "pointer",
  opacity: loading ? 0.7 : 1,
});

function SessionRecordsList({
  pages,
  appliedFilter,
  queryToken,
  draftPageId,
  draftTimeFrom,
  draftTimeTo,
  onDraftPageId,
  onDraftTimeFrom,
  onDraftTimeTo,
  onClearTimeRange,
  onQuery,
  filterError,
  supabaseConfig,
}: {
  pages: Page[];
  appliedFilter: ConversationRecordsFilter;
  queryToken: number;
  draftPageId: string | null;
  draftTimeFrom: string;
  draftTimeTo: string;
  onDraftPageId: (pageId: string | null) => void;
  onDraftTimeFrom: (v: string) => void;
  onDraftTimeTo: (v: string) => void;
  onClearTimeRange: () => void;
  onQuery: () => void;
  filterError: string | null;
  supabaseConfig: ReturnType<typeof loadSupabaseConfig>;
}) {
  const [selectedRecord, setSelectedRecord] = useState<InterceptedFetch | null>(null);
  const pagesKey = pageListIdentityKey(pages);
  const pageIds = useMemo(() => pages.map((p) => p.id), [pagesKey]);
  const pageById = useMemo(() => Object.fromEntries(pages.map((p) => [p.id, p])), [pages]);
  const { items, loading, error, truncated, truncationReason } = useConversationRecords(
    appliedFilter,
    pageIds,
    pagesKey,
    queryToken,
  );

  const hasDraftTime = draftTimeFrom.trim() !== "" || draftTimeTo.trim() !== "";

  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
      <div
        style={{
          padding: "14px 18px 16px",
          borderBottom: "1px solid #e8e8ec",
          background: "linear-gradient(180deg, #fbfbfc 0%, #f6f6f8 100%)",
          flex: "none",
        }}
      >
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#1d1d1f", letterSpacing: "-.01em" }}>
            会话记录
          </div>
          <div style={{ fontSize: 12, color: "#9a9aa0", marginTop: 4, display: "flex", alignItems: "center", gap: 8 }}>
            {loading && (
              <span
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  border: "2px solid #d4d4da",
                  borderTopColor: ACCENT,
                  animation: "ascSpin .8s linear infinite",
                  flex: "none",
                }}
              />
            )}
            <span>
              {queryToken < 1 ? "请设置条件后查询" : loading ? "查询中…" : `${items.length} 条对话记录`}
            </span>
            {!loading && queryToken >= 1 && truncated && (
              <span style={{ color: "#c97b20" }}>{truncationHint(truncationReason)}</span>
            )}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "flex-end",
            gap: 12,
            padding: "12px 14px",
            borderRadius: 10,
            border: "1px solid #e4e4e8",
            background: "#ffffff",
            boxShadow: "0 1px 2px rgba(0,0,0,.04)",
          }}
        >
          <label style={{ width: 168, flex: "none" }}>
            <span style={fieldLabel}>Page</span>
            <select
              value={draftPageId ?? ""}
              onChange={(e) => onDraftPageId(e.target.value || null)}
              style={{
                ...fieldInput,
                cursor: "pointer",
                paddingRight: 28,
                appearance: "none",
                backgroundImage:
                  "linear-gradient(45deg, transparent 50%, #9a9aa0 50%), linear-gradient(135deg, #9a9aa0 50%, transparent 50%)",
                backgroundPosition: "calc(100% - 16px) 14px, calc(100% - 11px) 14px",
                backgroundSize: "5px 5px, 5px 5px",
                backgroundRepeat: "no-repeat",
              }}
            >
              <option value="">全部 Page</option>
              {pages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>

          <div style={{ flex: "none" }}>
            <span style={fieldLabel}>发生时间</span>
            <div style={timeRangeShell}>
              <input
                type="datetime-local"
                value={draftTimeFrom}
                onChange={(e) => onDraftTimeFrom(e.target.value)}
                style={timeRangeInput}
                title="起始时间"
              />
              <span style={{ flex: "none", width: 1, alignSelf: "stretch", background: "#e8e8ec" }} />
              <span style={{ flex: "none", padding: "0 6px", fontSize: 11, color: "#b0b0b6", userSelect: "none" }}>
                至
              </span>
              <span style={{ flex: "none", width: 1, alignSelf: "stretch", background: "#e8e8ec" }} />
              <input
                type="datetime-local"
                value={draftTimeTo}
                onChange={(e) => onDraftTimeTo(e.target.value)}
                style={timeRangeInput}
                title="结束时间"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={onClearTimeRange}
            disabled={!hasDraftTime}
            style={{
              ...ghostBtn,
              opacity: hasDraftTime ? 1 : 0.45,
              cursor: hasDraftTime ? "pointer" : "default",
            }}
          >
            清除时间
          </button>

          <div style={{ flex: "1 1 12px", minWidth: 8 }} />

          <button type="button" onClick={onQuery} disabled={loading} style={queryBtn(loading)}>
            查询
          </button>
        </div>
      </div>

      {filterError && (
        <div style={{ padding: "10px 16px", background: "#fff8f0", color: "#c97b20", fontSize: 12 }}>
          {filterError}
        </div>
      )}

      {error && (
        <div
          style={{
            padding: "10px 16px",
            background: "#fff5f5",
            color: "#d23b30",
            fontSize: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <span>{error}</span>
          <button type="button" onClick={onQuery} disabled={loading} style={ghostBtn}>
            重试
          </button>
        </div>
      )}

      <div style={{ flex: 1, overflow: "auto", minHeight: 0, background: "#fff" }}>
        {loading && items.length === 0 && (
          <div style={{ padding: "32px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  height: 68,
                  borderRadius: 8,
                  background: "linear-gradient(90deg, #f3f3f5 0%, #ececef 50%, #f3f3f5 100%)",
                  backgroundSize: "200% 100%",
                  animation: "ascShimmer 1.2s ease-in-out infinite",
                  animationDelay: `${i * 0.15}s`,
                }}
              />
            ))}
          </div>
        )}
        {!loading && queryToken >= 1 && items.length === 0 && !error && (
          <div style={{ padding: 56, textAlign: "center", color: "#9a9aa0", fontSize: 13 }}>
            <div
              style={{
                width: 44,
                height: 44,
                margin: "0 auto 14px",
                borderRadius: 12,
                background: "#f3f3f5",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 20,
              }}
            >
              💬
            </div>
            <div style={{ fontWeight: 500, color: "#5a5a5e" }}>暂无符合条件的对话记录</div>
            <div style={{ fontSize: 12, marginTop: 6, lineHeight: 1.5 }}>
              会话记录显示对话类请求（ChatGPT /backend-api/conversation、内置 Chat /api/chat 等），不含统计、配置类请求。
              <br />
              可尝试：选「全部 Page」、点「清除时间」后重新查询。
            </div>
          </div>
        )}
        {!loading &&
          items.map((item) => {
          const preview = conversationPreview(item);
          const urlShort = item.url.length > 72 ? item.url.slice(0, 72) + "…" : item.url;
          const page = item.page_id ? pageById[item.page_id] : undefined;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelectedRecord(item)}
              style={{
                display: "block",
                width: "100%",
                border: "none",
                borderBottom: "1px solid #f0f0f2",
                background: "transparent",
                cursor: "pointer",
                padding: "14px 20px",
                textAlign: "left",
                transition: "background .12s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#f7f8fa";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
            >
              <div
                style={{
                  fontSize: 13.5,
                  color: "#1d1d1f",
                  lineHeight: 1.5,
                  overflow: "hidden",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                }}
              >
                {preview}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "#9a9aa0",
                  marginTop: 7,
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: "4px 0",
                }}
              >
                <span style={{ fontFamily: "ui-monospace,Menlo,monospace", color: "#7a7a80" }}>
                  {formatTimestamp(item.timestamp)}
                </span>
                {page && (
                  <>
                    <span style={{ margin: "0 6px", color: "#d4d4da" }}>·</span>
                    <span
                      style={{
                        fontSize: 10.5,
                        fontWeight: 600,
                        color: page.color,
                        background: page.color + "14",
                        borderRadius: 4,
                        padding: "1px 6px",
                      }}
                    >
                      {page.name}
                    </span>
                  </>
                )}
                <span style={{ margin: "0 6px", color: "#d4d4da" }}>·</span>
                <span style={{ fontWeight: 600, color: "#5a5a5e" }}>{item.method}</span>
                <span style={{ margin: "0 6px", color: "#d4d4da" }}>·</span>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>
                  {urlShort}
                </span>
              </div>
            </button>
          );
          })}
      </div>

      {selectedRecord && (
        <div
          onClick={() => setSelectedRecord(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(20,20,24,.34)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            backdropFilter: "blur(1.5px)",
          }}
        >
          <SessionRecordModal
            record={selectedRecord}
            config={supabaseConfig}
            onClose={() => setSelectedRecord(null)}
          />
        </div>
      )}
    </div>
  );
}

export default function SessionRecordsView({ pages }: Props) {
  const config = useMemo(() => loadSupabaseConfig(), []);
  const unconfigured = !config.url || !config.key;

  const [draftPageId, setDraftPageId] = useState<string | null>(null);
  const [draftTimeFrom, setDraftTimeFrom] = useState("");
  const [draftTimeTo, setDraftTimeTo] = useState("");

  const [appliedFilter, setAppliedFilter] = useState<ConversationRecordsFilter>(() =>
    draftToFilter(null, "", ""),
  );
  const [queryToken, setQueryToken] = useState(1);
  const [filterError, setFilterError] = useState<string | null>(null);

  const runQuery = () => {
    const rangeError = validateTimeRange(draftTimeFrom, draftTimeTo);
    if (rangeError) {
      setFilterError(rangeError);
      return;
    }
    setFilterError(null);
    setAppliedFilter(draftToFilter(draftPageId, draftTimeFrom, draftTimeTo));
    setQueryToken((t) => t + 1);
  };

  if (unconfigured) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 8,
          color: "#9a9aa0",
          fontSize: 13,
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 600, color: "#1d1d1f" }}>未配置 Supabase</div>
        <div>请在 Settings → Cloud Sync 中填写 URL 和 API Key</div>
      </div>
    );
  }

  if (pages.length === 0) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#9a9aa0",
          fontSize: 13,
        }}
      >
        还没有 Page，请先添加页面后再查看会话记录
      </div>
    );
  }

  return (
    <SessionRecordsList
      pages={pages}
      appliedFilter={appliedFilter}
      queryToken={queryToken}
      draftPageId={draftPageId}
      draftTimeFrom={draftTimeFrom}
      draftTimeTo={draftTimeTo}
      onDraftPageId={setDraftPageId}
      onDraftTimeFrom={setDraftTimeFrom}
      onDraftTimeTo={setDraftTimeTo}
      onClearTimeRange={() => {
        setDraftTimeFrom("");
        setDraftTimeTo("");
      }}
      onQuery={runQuery}
      filterError={filterError}
      supabaseConfig={config}
    />
  );
}