const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

/**
 * Truncates text safely to a UTF-8 byte budget without splitting multi-byte chars.
 * Even Hub enforces 63-byte list items and 999/1999-byte text container limits.
 */
export function truncateUtf8Bytes(input: string, maxBytes: number): string {
  const clean = input.replace(/\r\n/g, '\n').trim();
  const encoded = textEncoder.encode(clean);
  if (encoded.length <= maxBytes) {
    return clean;
  }

  const ellipsis = '...';
  const budget = Math.max(0, maxBytes - ellipsis.length);
  let slice = encoded.slice(0, budget);
  // Step back over UTF-8 continuation bytes (10xxxxxx) if cut mid-codepoint.
  while (slice.length > 0 && (slice[slice.length - 1] & 0b11000000) === 0b10000000) {
    slice = slice.slice(0, slice.length - 1);
  }
  const decoded = textDecoder.decode(slice).replace(/\uFFFD/g, '').trimEnd();
  return `${decoded}${ellipsis}`;
}

/**
 * Wraps prose into at most `maxLines` short lines tailored for the 576x288 G2 display.
 */
export function formatGlanceLines(
  input: string,
  maxLines = 3,
  maxCharsPerLine = 38,
): string[] {
  const normalized = input.replace(/\s+/g, ' ').trim();
  if (!normalized) return [''];

  const words = normalized.split(' ');
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxCharsPerLine) {
      current = candidate;
      continue;
    }

    if (current) {
      lines.push(current);
      if (lines.length >= maxLines) {
        break;
      }
      current = word.slice(0, maxCharsPerLine);
    } else {
      lines.push(word.slice(0, maxCharsPerLine));
      if (lines.length >= maxLines) {
        break;
      }
      current = '';
    }
  }

  if (lines.length < maxLines && current) {
    lines.push(current);
  }

  if (lines.length === maxLines) {
    const reconstructed = lines.join(' ');
    if (reconstructed.length < normalized.length) {
      const last = lines[maxLines - 1];
      lines[maxLines - 1] =
        last.length > maxCharsPerLine - 3
          ? `${last.slice(0, maxCharsPerLine - 3)}...`
          : `${last}...`;
    }
  }

  return lines;
}

/**
 * Formats a compact single-line item for ListContainerProperty (max 63 UTF-8 bytes).
 */
export function formatListItemLabel(label: string): string {
  return truncateUtf8Bytes(label.replace(/\s+/g, ' '), 60);
}
