import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { normalizeConversationMarkdown } from "../lib/normalizeConversationMarkdown";

type Props = {
  content: string;
};

const ALLOWED_PROTOCOLS = /^https?:$/i;

function safeHref(href: string | undefined): string | undefined {
  if (!href) return undefined;
  try {
    const url = new URL(href, "https://localhost");
    if (!ALLOWED_PROTOCOLS.test(url.protocol)) return undefined;
    return url.href;
  } catch {
    return undefined;
  }
}

export default function ConversationMarkdown({ content }: Props) {
  const normalized = normalizeConversationMarkdown(content);
  return (
    <div className="asc-conversation-md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        urlTransform={safeHref}
        components={{
          a: ({ href, children, ...props }) => {
            const safe = safeHref(href);
            if (!safe) return <span>{children}</span>;
            return (
              <a href={safe} target="_blank" rel="noopener noreferrer" {...props}>
                {children}
              </a>
            );
          },
        }}
      >
        {normalized}
      </ReactMarkdown>
    </div>
  );
}