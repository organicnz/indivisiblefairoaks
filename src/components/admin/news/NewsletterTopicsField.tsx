import { Plus, Tag } from 'lucide-react';
import { NEWSLETTER_LIMITS } from '@/lib/newsletters';

type NewsletterTopicsFieldProps = {
  topics: string[];
  topicInput: string;
  previewTopicCount: number;
  onTopicInputChange: (value: string) => void;
  onAddTopic: () => void;
  onRemoveTopic: (topic: string) => void;
};

export function NewsletterTopicsField({
  topics,
  topicInput,
  previewTopicCount,
  onTopicInputChange,
  onAddTopic,
  onRemoveTopic,
}: NewsletterTopicsFieldProps) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3">
        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
          Key topics &amp; campaign tags
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">
          {previewTopicCount}/{NEWSLETTER_LIMITS.topics}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <input
          id="civic-news-topic-input"
          type="text"
          aria-label="Add a topic"
          value={topicInput}
          onChange={(event) => onTopicInputChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ',') {
              event.preventDefault();
              onAddTopic();
            }
          }}
          onBlur={() => {
            if (topicInput.trim()) onAddTopic();
          }}
          maxLength={NEWSLETTER_LIMITS.topic}
          placeholder="e.g. Election Defense, Choir Actions, Food Drive"
          className="min-h-10 flex-1 rounded-sm border border-border bg-background px-3 py-2 text-xs font-medium transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <button
          type="button"
          onClick={onAddTopic}
          disabled={!topicInput.trim() || previewTopicCount >= NEWSLETTER_LIMITS.topics}
          className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-sm border border-border bg-secondary px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-secondary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
        >
          <Plus size={14} aria-hidden="true" />
          Add tag
        </button>
      </div>

      {topics.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {topics.map((topic) => (
            <span
              key={topic}
              className="inline-flex items-center gap-1 rounded-sm border border-accent-gold/40 bg-accent-gold/15 px-2.5 py-1 text-xs font-bold text-ink-strong dark:text-accent-gold"
            >
              <Tag size={11} aria-hidden="true" />
              <span>{topic}</span>
              <button
                type="button"
                onClick={() => onRemoveTopic(topic)}
                className="rounded-sm p-0.5 transition-colors hover:bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:hover:bg-white/20"
                aria-label={`Remove topic ${topic}`}
              >
                <span aria-hidden="true" className="block text-sm leading-none">
                  ×
                </span>
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-1 text-[10px] text-muted-foreground">
          Press Enter or comma after each topic.
        </p>
      )}
    </div>
  );
}
