import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface HelpMarkdownProps {
  content: string;
  searchQuery?: string;
}

// 转义正则表达式特殊字符
const escapeRegExp = (string: string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

// 高亮文本中的匹配项
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
    // 添加匹配前的文本
    if (match.index > lastIndex) {
      parts.push({ text: text.substring(lastIndex, match.index), isMatch: false });
    }
    // 添加匹配的文本
    parts.push({ text: match[0], isMatch: true });
    lastIndex = regex.lastIndex;
  }

  // 添加剩余的文本
  if (lastIndex < text.length) {
    parts.push({ text: text.substring(lastIndex), isMatch: false });
  }

  return parts.length > 0 ? parts : [{ text, isMatch: false }];
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
        // 自定义文本渲染，支持搜索高亮
        text({ children }) {
          if (!children) return null;
          const textContent = String(children);
          
          if (!searchQuery || !searchQuery.trim()) {
            return <>{textContent}</>;
          }

          const parts = highlightText(textContent, searchQuery);
          
          return (
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
                  <span key={index}>{part.text}</span>
                )
              )}
            </>
          );
        },
        // 自定义代码块渲染
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
        // 自定义表格渲染
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
              {children}
            </th>
          );
        },
        td({ children }) {
          return <td className="border border-border px-3 py-2">{children}</td>;
        },
        // 自定义标题渲染
        h1: () => null, // 不渲染h1,因为我们已经在标题栏显示
        h2({ children }) {
          return (
            <h2 className="text-lg font-semibold mt-4 mb-2 text-foreground">
              {children}
            </h2>
          );
        },
        h3({ children }) {
          return (
            <h3 className="text-base font-semibold mt-3 mb-1.5 text-foreground">
              {children}
            </h3>
          );
        },
        // 自定义段落渲染
        p({ children }) {
          return <p className="mb-2 leading-relaxed">{children}</p>;
        },
        // 自定义列表渲染
        ul({ children }) {
          return <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>;
        },
        ol({ children }) {
          return <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>;
        },
        // 自定义链接渲染
        a({ href, children }) {
          return (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              {children}
            </a>
          );
        },
        // 自定义引用渲染
        blockquote({ children }) {
          return (
            <blockquote className="border-l-4 border-muted-foreground pl-4 italic text-muted-foreground">
              {children}
            </blockquote>
          );
        },
        // 自定义水平线渲染
        hr() {
          return <hr className="my-4 border-border" />;
        },
      }}
    >
      {content}
    </ReactMarkdown>
    </div>
  );
};