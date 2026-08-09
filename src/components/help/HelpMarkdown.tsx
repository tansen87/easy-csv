import React, { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface HelpMarkdownProps {
  content: string;
  searchQuery?: string;
  currentMatchIndex?: number;
}

export const MATCH_CLASS = "bg-orange-200 text-black px-0.5 rounded";
export const CURRENT_MATCH_CLASS = "bg-orange-500 text-white px-0.5 rounded";

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

const getTextContent = (children: React.ReactNode): string => {
  if (typeof children === "string") {
    return children;
  }
  if (typeof children === "number") {
    return String(children);
  }
  if (Array.isArray(children)) {
    return children.map(getTextContent).join("");
  }
  if (React.isValidElement(children)) {
    const element = children as React.ReactElement<{
      children?: React.ReactNode;
    }>;
    return getTextContent(element.props.children);
  }
  return "";
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
                  className="bg-muted/50 px-1.5 py-0.5 rounded text-sm font-mono"
                  {...props}
                >
                  {searchQuery && searchQuery.trim()
                    ? parts.map((part, index) => renderMatch(part, index))
                    : codeContent}
                </code>
              );
            }

            return (
              <pre className="bg-muted/50 p-3 rounded-lg overflow-x-auto">
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
              <div className="overflow-x-auto">
                <table className="min-w-full border border-border text-sm">
                  {children}
                </table>
              </div>
            );
          },
          thead({ children }) {
            return <thead className="bg-muted/50">{children}</thead>;
          },
          th({ children }) {
            return (
              <th className="border border-border px-3 py-2 text-left font-semibold">
                {wrapWithHighlight(children, searchQuery)}
              </th>
            );
          },
          td({ children }) {
            return (
              <td className="border border-border px-3 py-2">
                {wrapWithHighlight(children, searchQuery)}
              </td>
            );
          },
          h1: () => null,
          h2({ children }) {
            return (
              <h2 className="text-lg font-semibold mt-4 mb-2 text-foreground">
                {wrapWithHighlight(children, searchQuery)}
              </h2>
            );
          },
          h3({ children }) {
            return (
              <h3 className="text-base font-semibold mt-3 mb-1.5 text-foreground">
                {wrapWithHighlight(children, searchQuery)}
              </h3>
            );
          },
          p({ children }) {
            return (
              <p className="mb-2 leading-relaxed">
                {wrapWithHighlight(children, searchQuery)}
              </p>
            );
          },
          ul({ children }) {
            return (
              <ul className="list-disc list-inside mb-2 space-y-1">
                {children}
              </ul>
            );
          },
          ol({ children }) {
            return (
              <ol className="list-decimal list-inside mb-2 space-y-1">
                {children}
              </ol>
            );
          },
          li({ children }) {
            return (
              <li className="mb-1">
                {wrapWithHighlight(children, searchQuery)}
              </li>
            );
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
              <blockquote className="border-l-4 border-muted-foreground pl-4 italic text-muted-foreground">
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
