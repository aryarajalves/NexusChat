import { useState, useMemo } from 'react';

export function useChatMentions({ members = [], inputText, setInputText, textInputRef }) {
  const [isMentionOpen, setIsMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);

  const mentionOptions = useMemo(() => {
    const list = [
      { id: 'everyone', name: 'everyone', description: 'Notifica todas as pessoas neste canal', isSpecial: true },
      { id: 'here', name: 'here', description: 'Notifica todos os membros online neste canal', isSpecial: true },
    ];
    const memberItems = (members || []).map((m) => {
      const displayName = m.nickname || m.name || 'Usuário';
      return { id: m.user_id || m.id, name: displayName, rawName: m.name, role: m.role, isSpecial: false };
    });
    const all = [...list, ...memberItems];
    if (!mentionQuery) return all;
    const q = mentionQuery.toLowerCase();
    return all.filter((item) => item.name.toLowerCase().includes(q) || (item.rawName && item.rawName.toLowerCase().includes(q)));
  }, [members, mentionQuery]);

  const checkMentionTrigger = (val, cursorPos) => {
    const textBeforeCursor = val.slice(0, cursorPos);
    const lastAtPos = textBeforeCursor.lastIndexOf('@');
    if (lastAtPos !== -1) {
      const charBeforeAt = lastAtPos > 0 ? textBeforeCursor[lastAtPos - 1] : ' ';
      if (charBeforeAt === ' ' || charBeforeAt === '\n' || lastAtPos === 0) {
        const query = textBeforeCursor.slice(lastAtPos + 1);
        if (!query.includes(' ') && !query.includes('\n')) {
          setMentionStartIndex(lastAtPos);
          setMentionQuery(query);
          setIsMentionOpen(true);
          setSelectedMentionIndex(0);
          return;
        }
      }
    }
    setIsMentionOpen(false);
  };

  const handleSelectMention = (item) => {
    const cursorPos = textInputRef.current?.selectionStart ?? inputText.length;
    const beforeMention = inputText.slice(0, mentionStartIndex);
    const afterCursor = inputText.slice(cursorPos);
    const mentionText = `@${item.name} `;
    const newText = `${beforeMention}${mentionText}${afterCursor}`;
    setInputText(newText);
    setIsMentionOpen(false);

    setTimeout(() => {
      if (textInputRef.current) {
        const newCursorPos = beforeMention.length + mentionText.length;
        textInputRef.current.focus();
        textInputRef.current.setSelectionRange?.(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  const handleMentionKeyDown = (e) => {
    if (!isMentionOpen || mentionOptions.length === 0) return false;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedMentionIndex((prev) => (prev + 1) % mentionOptions.length);
      return true;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedMentionIndex((prev) => (prev - 1 + mentionOptions.length) % mentionOptions.length);
      return true;
    }
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      const safeIdx = Math.min(selectedMentionIndex, mentionOptions.length - 1);
      if (mentionOptions[safeIdx]) {
        handleSelectMention(mentionOptions[safeIdx]);
      }
      return true;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      setIsMentionOpen(false);
      return true;
    }
    return false;
  };

  return {
    isMentionOpen,
    setIsMentionOpen,
    mentionQuery,
    mentionOptions,
    selectedMentionIndex,
    checkMentionTrigger,
    handleSelectMention,
    handleMentionKeyDown,
  };
}
