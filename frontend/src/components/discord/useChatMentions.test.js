import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useChatMentions } from './useChatMentions';

describe('useChatMentions Hook', () => {
  const members = [
    { user_id: 1, name: 'Alice', nickname: 'Ali' },
    { user_id: 2, name: 'Bob', nickname: 'Bobby' },
  ];

  it('triggers mention popover when @ is typed after space or at beginning', () => {
    let text = '@';
    const setText = vi.fn((val) => { text = val; });
    const textInputRef = { current: { selectionStart: 1, focus: vi.fn(), setSelectionRange: vi.fn() } };

    const { result } = renderHook(() =>
      useChatMentions({ members, inputText: text, setInputText: setText, textInputRef })
    );

    act(() => {
      result.current.checkMentionTrigger('@', 1);
    });

    expect(result.current.isMentionOpen).toBe(true);
    expect(result.current.mentionQuery).toBe('');
    expect(result.current.mentionOptions.length).toBeGreaterThan(2); // everyone, here, Alice, Bob
  });

  it('filters mention options based on query and selects option on Enter', () => {
    let text = '@Ali';
    const setText = vi.fn((val) => { text = val; });
    const textInputRef = { current: { selectionStart: 4, focus: vi.fn(), setSelectionRange: vi.fn() } };

    const { result } = renderHook(() =>
      useChatMentions({ members, inputText: text, setInputText: setText, textInputRef })
    );

    act(() => {
      result.current.checkMentionTrigger('@Ali', 4);
    });

    expect(result.current.isMentionOpen).toBe(true);
    expect(result.current.mentionOptions.some(m => m.name === 'Ali')).toBe(true);

    const handled = result.current.handleMentionKeyDown({ key: 'Enter', preventDefault: vi.fn() });
    expect(handled).toBe(true);
    expect(setText).toHaveBeenCalledWith(expect.stringContaining('@Ali'));
  });
});
