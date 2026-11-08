import React, { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface HelpMarkdownProps {
  content: string;
  searchQuery?: string;
  currentMatchIndex?: number;
}

export const MATCH_CLASS = "bg-brand-soft text-foreground px-0.5 rounded";
export const CURRENT_MATCH_CLASS = "bg-brand text-brand-foreground px-0.5 rounded";

export const escapeRegExp = (string: string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

const getHiddenHeadingRanges = (content: string): Array<[number, number]> => {
  const ranges: Array<[number, number]> = [];
  const lines = content.split("\n");
  let offset = 0;
  let inFence = false;
  for (const line of lines) {
    if (!inFence) {
      const headingMatch = line.match(/^#(?!#)\s/);
      if (headingMatch) {
        ranges.push([offset, offset + line.length]);
      }
    }
    if (/^```/.test(line) || /^~~~/.test(line)) {
      inFence = !inFence;
    }
    offset += line.length + 1;
  }
  return ranges;
};

export const getSearchMatches = (
  content: string,
  searchQuery: string,
): number[] => {
  if (!searchQuery.trim() || !content) {
    return [];
  }
  const escapedQuery = escapeRegExp(searchQuery);
  const regex = new RegExp(escapedQuery, "gi");
  const hiddenRanges = getHiddenHeadingRanges(content);
  const positions: number[] = [];
  for (
    let match = regex.exec(content);
    match !== null;
    match = regex.exec(content)
  ) {
    const isHidden = hiddenRanges.some(
      ([start, end]) => match.index >= start && match.index < end,
    );
    if (!isHidden) {
      positions.push(match.index);
    }
  }
  return positions;
};

const highlightText = (
  text: string,
  searchQuery?: string,
): Array<{ text: string; isMatch: boolean }> => {
  if (!searchQuery || !searchQuery.trim()) {
    return [{ text, isMatch: false }];
  }

  const escapedQuery = escapeRegExp(searchQuery);
  const regex = new RegExp(escapedQuery, "gi");
  const parts: Array<{ text: string; isMatch: boolean }> = [];

  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({
        text: text.substring(lastIndex, match.index),
        isMatch: false,
      });
    }
    parts.push({ text: match[0], isMatch: true });
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push({ text: text.substring(lastIndex), isMatch: false });
  }

  return parts.length > 0 ? parts : [{ text, isMatch: false }];
};

const renderMatch = (part: { text: string; isMatch: boolean }, key: number) => {
  if (part.isMatch) {
    return (
      <mark key={key} className={MATCH_CLASS}>
        {part.text}
      </mark>
    );
  }
  return <span key={key}>{part.text}</span>;
};

const wrapWithHighlight = (children: React.ReactNode, searchQuery?: string) => {
  if (!searchQuery || !searchQuery.trim()) {
    return children;
  }

  const processNode = (node: React.ReactNode): React.ReactNode => {
    if (typeof node === "string") {
      const parts = highlightText(node, searchQuery);
      return parts.map((part, index) => renderMatch(part, index));
    }

    if (typeof node === "number") {
      return String(node);
    }

    if (Array.isArray(node)) {
      return node.map((child, index) => (
        <React.Fragment key={index}>{processNode(child)}</React.Fragment>
      ));
    }

    if (React.isValidElement(node)) {
      return node;
    }

    return node;
  };

  return processNode(children);
};

export const HelpMarkdown: React.FC<HelpMarkdownProps> = ({
  content,
  searchQuery,
  currentMatchIndex,
}) => {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const marks = Array.from(root.querySelectorAll("mark"));
    if (marks.length === 0) return;

    marks.forEach((mark) => {
      mark.removeAttribute("data-active-match");
      mark.className = MATCH_CLASS;
    });

    const index = Math.min(currentMatchIndex ?? 0, marks.length - 1);
    const current = marks[index];
    if (current) {
      current.setAttribute("data-active-match", "true");
      current.className = CURRENT_MATCH_CLASS;
    }
  });

  return (
    <div ref={rootRef} className="help-content">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || "");
            const isInline = !match;
            const codeContent = String(children);
            const parts = highlightText(codeContent, searchQuery);

            if (isInline) {
              return (
                <code
                  className="rounded-[3px] bg-muted/60 px-1.5 py-0.5 font-mono text-[11.5px]"
                  {...props}
                >
                  {searchQuery && searchQuery.trim()
                    ? parts.map((part, index) => renderMatch(part, index))
                    : codeContent}
                </code>
              );
            }

            return (
              <pre className="mb-3 overflow-x-auto rounded-md border border-border/70 bg-muted/40 px-3.5 py-3 font-mono text-[11.5px] leading-relaxed">
                <code className={className} {...props}>
                  {searchQuery && searchQuery.trim()
                    ? parts.map((part, index) => renderMatch(part, index))
                    : codeContent}
                </code>
              </pre>
            );
          },
          table({ children }) {
            return (
              <div className="mb-3 overflow-x-auto">
                <table className="min-w-full border-collapse text-xs">
                  {children}
                </table>
              </div>
            );
          },
          thead({ children }) {
            return <thead>{children}</thead>;
          },
          th({ children }) {
            return (
              <th className="whitespace-nowrap border-b border-border px-2.5 py-1.5 text-left text-[10.5px] font-medium text-muted-foreground">
                {wrapWithHighlight(children, searchQuery)}
              </th>
            );
          },
          td({ children }) {
            return (
              <td className="border-b border-border/50 px-2.5 py-2">
                {wrapWithHighlight(children, searchQuery)}
              </td>
            );
          },
          h1: () => null,
          h2({ children }) {
            return <h2>{wrapWithHighlight(children, searchQuery)}</h2>;
          },
          h3({ children }) {
            return <h3>{wrapWithHighlight(children, searchQuery)}</h3>;
          },
          p({ children }) {
            return <p>{wrapWithHighlight(children, searchQuery)}</p>;
          },
          ul({ children }) {
            return <ul>{children}</ul>;
          },
          ol({ children }) {
            return <ol>{children}</ol>;
          },
          li({ children }) {
            return <li>{wrapWithHighlight(children, searchQuery)}</li>;
          },
          a({ href, children }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                {wrapWithHighlight(children, searchQuery)}
              </a>
            );
          },
          blockquote({ children }) {
            return (
              <blockquote className="border-l-2 border-border pl-4 text-muted-foreground">
                {wrapWithHighlight(children, searchQuery)}
              </blockquote>
            );
          },
          hr() {
            return <hr className="my-4 border-border" />;
          },
          strong({ children }) {
            return <strong>{wrapWithHighlight(children, searchQuery)}</strong>;
          },
          em({ children }) {
            return <em>{wrapWithHighlight(children, searchQuery)}</em>;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};
