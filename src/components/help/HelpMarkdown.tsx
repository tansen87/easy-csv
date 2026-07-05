import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface HelpMarkdownProps {
  content: string;
  searchQuery?: string;
}

const escapeRegExp = (string: string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const getTextContent = (children: React.ReactNode): string => {
  if (typeof children === 'string') {
    return children;
  }
  if (typeof children === 'number') {
    return String(children);
  }
  if (Array.isArray(children)) {
    return children.map(getTextContent).join('');
  }
  if (React.isValidElement(children)) {
    const element = children as React.ReactElement<{ children?: React.ReactNode }>;
    return getTextContent(element.props.children);
  }
  return '';
};

const highlightText = (text: string, searchQuery?: string): Array<{ text: string; isMatch: boolean }> => {
  if (!searchQuery || !searchQuery.trim()) {
    return [{ text, isMatch: false }];
  }

  const escapedQuery = escapeRegExp(searchQuery);
  const regex = new RegExp(escapedQuery, 'gi');
  const parts: Array<{ text: string; isMatch: boolean }> = [];
  
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ text: text.substring(lastIndex, match.index), isMatch: false });
    }
    parts.push({ text: match[0], isMatch: true });
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push({ text: text.substring(lastIndex), isMatch: false });
  }

  return parts.length > 0 ? parts : [{ text, isMatch: false }];
};

const wrapWithHighlight = (children: React.ReactNode, searchQuery?: string) => {
  if (!searchQuery || !searchQuery.trim()) {
    return children;
  }

  const processNode = (node: React.ReactNode): React.ReactNode => {
    if (typeof node === 'string') {
      const parts = highlightText(node, searchQuery);
      return parts.map((part, index) =>
        part.isMatch ? (
          <mark key={index} className="bg-yellow-300 text-black px-0.5 rounded">
            {part.text}
          </mark>
        ) : (
          <span key={index}>{part.text}</span>
        )
      );
    }

    if (typeof node === 'number') {
      return String(node);
    }

    if (Array.isArray(node)) {
      return node.map((child, index) => (
        <React.Fragment key={index}>{processNode(child)}</React.Fragment>
      ));
    }

    if (React.isValidElement(node)) {
      const element = node as React.ReactElement<{ children?: React.ReactNode }>;
      const processedChildren = processNode(element.props.children);
      return React.cloneElement(element, element.props, processedChildren);
    }

    return node;
  };

  return processNode(children);
};

export const HelpMarkdown: React.FC<HelpMarkdownProps> = ({ 
  content, 
  searchQuery
}) => {
  return (
    <div className="help-content">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            const isInline = !match;
            
            if (isInline) {
              const codeContent = String(children);
              const parts = highlightText(codeContent, searchQuery);
              
              return (
                <code 
                  className="bg-muted/50 px-1.5 py-0.5 rounded text-sm font-mono"
                  {...props}
                >
                  {searchQuery && searchQuery.trim() ? (
                    <>
                      {parts.map((part: { text: string; isMatch: boolean }, index: number) => 
                        part.isMatch ? (
                          <mark 
                            key={index} 
                            className="bg-yellow-300 text-black px-0.5 rounded"
                          >
                            {part.text}
                          </mark>
                        ) : (
                          part.text
                        )
                      )}
                    </>
                  ) : (
                    codeContent
                  )}
                </code>
              );
            }
            
            const codeContent = String(children);
            const parts = highlightText(codeContent, searchQuery);
            
            return (
              <pre className="bg-muted/50 p-3 rounded-lg overflow-x-auto">
                <code className={className} {...props}>
                  {searchQuery && searchQuery.trim() ? (
                    <>
                      {parts.map((part: { text: string; isMatch: boolean }, index: number) => 
                        part.isMatch ? (
                          <mark 
                            key={index} 
                            className="bg-yellow-300 text-black px-0.5 rounded"
                          >
                            {part.text}
                          </mark>
                        ) : (
                          part.text
                        )
                      )}
                    </>
                  ) : (
                    codeContent
                  )}
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
            return <td className="border border-border px-3 py-2">{wrapWithHighlight(children, searchQuery)}</td>;
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
            return <p className="mb-2 leading-relaxed">{wrapWithHighlight(children, searchQuery)}</p>;
          },
          ul({ children }) {
            return <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>;
          },
          ol({ children }) {
            return <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>;
          },
          li({ children }) {
            return <li className="mb-1">{wrapWithHighlight(children, searchQuery)}</li>;
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