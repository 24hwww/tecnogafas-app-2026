// ============================================================================
// CHAT INPUT - Input moderno integrado con M3
// ============================================================================

import { Send } from 'lucide-react';
import type React from 'react';
import { useRef, useState } from 'react';
import { cn } from '../../../lib/utils';
import { useChat } from '../providers/ChatProvider';

const MAX_LENGTH = 140;

function sanitizeContent(input: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
    '`': '&#x60;',
  };
  return input.replace(/[&<>"'/]/g, (c) => map[c] || c);
}

export function ChatInput() {
  const { sendMessage, activeConversation, currentUser } = useChat();
  const [content, setContent] = useState('');
  const [isSending, setIsSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const canSend = activeConversation?.id && currentUser?.id && content.trim();

  const handleInput = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    if (val.length <= MAX_LENGTH) {
      setContent(val);
    }
  };

  const handleSubmit = async () => {
    const trimmed = content.trim();
    if (!trimmed || trimmed.length > MAX_LENGTH || !activeConversation?.id || !currentUser?.id)
      return;

    setIsSending(true);
    try {
      await sendMessage({
        content: sanitizeContent(trimmed),
        attachments: [],
      });
      setContent('');

      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex items-end gap-2 bg-base-100 p-2 rounded-[28px] border border-[var(--color-border)]/10 shadow-lg shadow-black/5 animate-in slide-in-from-bottom-2 duration-300">
      {/* Text Input */}
      <textarea
        ref={textareaRef}
        value={content}
        onChange={handleChange}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        placeholder="Escribe un mensaje..."
        maxLength={MAX_LENGTH}
        className="flex-1 px-2 py-3 bg-transparent resize-none outline-none text-sm text-base-content placeholder:text-[var(--color-text-muted)]/50 max-h-[120px] min-h-[44px]"
        rows={1}
        disabled={isSending || !activeConversation?.id || !currentUser?.id}
      />

      {/* Send Button */}
      <button
        onClick={handleSubmit}
        disabled={!canSend || isSending}
        className={cn(
          'p-3 rounded-full transition-all duration-300 shrink-0',
          canSend
            ? 'bg-primary text-primary-content shadow-md shadow-primary/20 scale-100'
            : 'bg-[var(--color-surface-800)] text-[var(--color-text-muted)]/30 scale-95',
        )}
      >
        {isSending ? (
          <div className="w-5 h-5 border-2 border-on-primary/30 border-t-on-primary rounded-full animate-spin" />
        ) : (
          <Send
            className={cn(
              'w-5 h-5 transition-transform',
              content.trim() && 'translate-x-0.5 -translate-y-0.5',
            )}
          />
        )}
      </button>
    </div>
  );
}
