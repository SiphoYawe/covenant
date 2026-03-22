/**
 * Strip markdown formatting from text, keeping line breaks.
 */
export function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')   // **bold** -> bold
    .replace(/\*([^*]+)\*/g, '$1')        // *italic* -> italic
    .replace(/__([^_]+)__/g, '$1')        // __bold__ -> bold
    .replace(/_([^_]+)_/g, '$1')          // _italic_ -> italic
    .replace(/^#{1,6}\s+/gm, '')          // # headers -> plain
    .replace(/^[-*+]\s+/gm, '')           // - bullet -> plain
    .replace(/^\d+\.\s+/gm, '')           // 1. numbered -> plain
    .replace(/`([^`]+)`/g, '$1')          // `code` -> code
    .replace(/^>\s+/gm, '')              // > blockquote -> plain
    .trim();
}
