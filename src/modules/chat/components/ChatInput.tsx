// ============================================================================
// CHAT INPUT - Input flotante con soporte para adjuntos
// ============================================================================

import React, { useState, useRef, useCallback } from 'react';
import { useChat } from '../providers/ChatProvider';
import { Send, Paperclip, X } from 'lucide-react';

export function ChatInput() {
  const { sendMessage, setTyping } = useChat();
  const [content, setContent] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isSending, setIsSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-resize textarea
  const handleInput = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 150) + 'px';
    }
  };

  // Handle typing indicator
  const handleTyping = useCallback(() => {
    // Notify parent that user is typing
    // The actual typing status is handled by the hook
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Stop typing indicator after 2 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      // Stop typing indicator
    }, 2000);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    handleTyping();
  };

  const handleSubmit = async () => {
    if (!content.trim() && attachments.length === 0) return;

    setIsSending(true);
    try {
      // TODO: Upload attachments and get URLs
      await sendMessage({
        content: content.trim(),
        attachments: [],
      });
      setContent('');
      setAttachments([]);
      
      // Reset textarea height
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

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Attachments Preview */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {attachments.map((file, index) => (
            <div
              key={index}
              className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-full text-sm"
            >
              <span className="truncate max-w-[150px]">{file.name}</span>
              <button
                onClick={() => removeAttachment(index)}
                className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input Area */}
      <div className="flex items-end gap-2">
        {/* Attachment Button */}
        <button
          onClick={() => {
            // TODO: Implement file picker
            console.log('File picker not implemented');
          }}
          className="p-2.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <Paperclip className="w-5 h-5" />
        </button>

        {/* Text Input */}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleChange}
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Escribe un mensaje..."
            className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-800 rounded-2xl resize-none outline-none focus:ring-2 focus:ring-blue-500 dark:text-white max-h-[150px] min-h-[48px]"
            rows={1}
            disabled={isSending}
          />
        </div>

        {/* Send Button */}
        <button
          onClick={handleSubmit}
          disabled={(!content.trim() && attachments.length === 0) || isSending}
          className="p-2.5 bg-blue-500 text-white rounded-full hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSending ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Send className="w-5 h-5" />
          )}
        </button>
      </div>
    </div>
  );
}
