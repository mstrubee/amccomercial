import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState, type KeyboardEvent, type ChangeEvent } from "react";
import { createPortal } from "react-dom";
import { useMentionableUsers, type MentionableUser } from "@/hooks/useMentionableUsers";
import { cn } from "@/lib/utils";

interface Props extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange"> {
  value: string;
  onChange: (value: string, selectionStart?: number | null) => void;
  wrapperClassName?: string;
}

/**
 * Textarea with @mention autocomplete.
 * Trigger: typing "@" after a non-word boundary opens a dropdown of users.
 * Filter: characters typed after "@" filter the list by handle prefix.
 * Confirm: Enter or Space selects the highlighted user; Esc closes the menu.
 */
const MentionTextarea = forwardRef<HTMLTextAreaElement, Props>(function MentionTextarea(
  { value, onChange, onKeyDown, className, wrapperClassName, ...rest },
  ref,
) {
  const innerRef = useRef<HTMLTextAreaElement | null>(null);
  useImperativeHandle(ref, () => innerRef.current as HTMLTextAreaElement);

  const { data: users = [] } = useMentionableUsers();

  const [menu, setMenu] = useState<{ start: number; query: string } | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);

  const matches = useMemo<MentionableUser[]>(() => {
    if (!menu) return [];
    const q = menu.query.toLowerCase();
    const list = users.filter((u) => !q || u.handle.startsWith(q) || u.display_name.toLowerCase().includes(q));
    return list.slice(0, 8);
  }, [menu, users]);

  useEffect(() => { setActiveIdx(0); }, [menu?.query, matches.length]);

  // Position the portal menu just below the textarea, and reposition on scroll/resize.
  useEffect(() => {
    if (!menu) { setMenuPos(null); return; }
    const update = () => {
      const el = innerRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setMenuPos({ top: r.bottom + 4, left: r.left });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [menu]);

  const detectMention = (text: string, caret: number) => {
    // Walk back from caret to find a recent "@" not separated by whitespace.
    let i = caret - 1;
    while (i >= 0) {
      const ch = text[i];
      if (ch === "@") {
        // Must be at start or preceded by whitespace/punctuation.
        const prev = i > 0 ? text[i - 1] : " ";
        if (/[\s(\[{,;:!?'"]/.test(prev) || i === 0) {
          const query = text.slice(i + 1, caret);
          if (/^[A-Za-zÀ-ÿ0-9_]*$/.test(query)) {
            setMenu({ start: i, query });
            return;
          }
        }
        break;
      }
      if (/\s/.test(ch)) break;
      i--;
    }
    setMenu(null);
  };

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.target.value;
    const caret = e.target.selectionStart ?? next.length;
    onChange(next, caret);
    detectMention(next, caret);
  };

  const insertMention = (user: MentionableUser, appendSpace: boolean) => {
    if (!menu) return;
    const el = innerRef.current;
    if (!el) return;
    const caret = el.selectionStart ?? value.length;
    const before = value.slice(0, menu.start);
    const after = value.slice(caret);
    const insert = `@${user.handle}${appendSpace ? " " : ""}`;
    const next = before + insert + after;
    const nextCaret = before.length + insert.length;
    onChange(next, nextCaret);
    setMenu(null);
    requestAnimationFrame(() => {
      const e2 = innerRef.current;
      if (e2) {
        e2.selectionStart = nextCaret;
        e2.selectionEnd = nextCaret;
        e2.focus();
      }
    });
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (menu && matches.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx((i) => (i + 1) % matches.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((i) => (i - 1 + matches.length) % matches.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(matches[activeIdx], true);
        return;
      }
      if (e.key === " ") {
        // Only confirm with Space when the query is a unique/exact prefix match
        const exact = matches.find((m) => m.handle === menu.query.toLowerCase());
        if (exact || matches.length === 1) {
          e.preventDefault();
          insertMention(exact || matches[0], true);
          return;
        }
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setMenu(null);
        return;
      }
    }
    onKeyDown?.(e);
  };

  const handleSelectOrClick = () => {
    const el = innerRef.current;
    if (!el) return;
    detectMention(el.value, el.selectionStart ?? 0);
  };

  return (
    <div className={cn("relative", wrapperClassName)}>
      <textarea
        ref={innerRef}
        {...rest}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onClick={(e) => { rest.onClick?.(e); handleSelectOrClick(); }}
        onKeyUp={handleSelectOrClick}
        onBlur={(e) => { rest.onBlur?.(e); setTimeout(() => setMenu(null), 120); }}
        className={cn(
          "w-full rounded-md border border-border bg-card/50 px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          className,
        )}
      />
      {menu && matches.length > 0 && menuPos && createPortal(
        <div
          style={{ position: "fixed", top: menuPos.top, left: menuPos.left, zIndex: 1000 }}
          className="w-64 max-h-56 overflow-y-auto rounded-md border border-border bg-popover shadow-md text-popover-foreground"
        >
          {matches.map((u, i) => (
            <button
              key={u.user_id}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); insertMention(u, true); }}
              className={cn(
                "w-full text-left px-3 py-1.5 text-xs flex items-center justify-between gap-2",
                i === activeIdx ? "bg-accent text-accent-foreground" : "hover:bg-accent/50",
              )}
            >
              <span className="truncate">{u.display_name}</span>
              <span className="text-[10px] text-muted-foreground">@{u.handle}</span>
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
});

export default MentionTextarea;