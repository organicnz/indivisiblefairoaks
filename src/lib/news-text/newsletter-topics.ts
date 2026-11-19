import { normalizeNewsletterTopics } from '@/lib/newsletters';

const TOPIC_LIST_MARKER = /^(?:[-*•]+|\d+[.)])\s*/;
const TOPIC_SEPARATOR = /[,;|\t\r\n]+|\s*[•·]\s*/;

/** Remove the decoration people leave on a pasted tag list, not the words. */
function cleanPastedTopic(value: string): string {
  return value.replace(TOPIC_LIST_MARKER, '').replace(/^#+\s*/, '').trim();
}

/**
 * Parse a topic input that may contain a pasted comma, semicolon, pipe, tab or
 * newline separated list. Bullets, numbered-list markers and leading hashtags
 * are treated as paste decoration rather than part of the topic label.
 *
 * Normalization belongs here as well as at the write boundary: the editor's
 * live preview and the submit path should not disagree about whether
 * "Election  Defense" and "election defense" are the same chip.
 */
export function parseNewsletterTopicInput(value: string): string[] {
  return normalizeNewsletterTopics(
    value.split(TOPIC_SEPARATOR).map(cleanPastedTopic)
  );
}
