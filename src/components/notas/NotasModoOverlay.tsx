import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useNotasModo, ElementoCapturado } from "@/contexts/NotasModoContext";

function getCssSelector(el: Element): string {
  if (el.id) return `#${el.id}`;
  const parts: string[] = [];
  let current: Element | null = el;
  while (current && current !== document.body) {
    let selector = current.tagName.toLowerCase();
    if (current.id) {
      selector = `#${current.id}`;
      parts.unshift(selector);
      break;
    }
    const siblings = current.parentElement ? Array.from(current.parentElement.children) : [];
    const sameTag = siblings.filter((s) => s.tagName === current!.tagName);
    if (sameTag.length > 1) {
      const idx = sameTag.indexOf(current) + 1;
      selector += `:nth-of-type(${idx})`;
    }
    parts.unshift(selector);
    current = current.parentElement;
    if (parts.length >= 4) break;
  }
  return parts.join(" > ");
}

function getTextoPreview(el: Element): string {
  const text = el.textContent?.trim().slice(0, 80) ?? "";
  return text.replace(/\s+/g, " ");
}

export default function NotasModoOverlay() {
  const { modoActivo, setElementoCapturado, panelAbierto } = useNotasModo();
  const location = useLocation();
  const highlightRef = useRef<HTMLDivElement>(null);
  const hoveredRef = useRef<Element | null>(null);
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    if (!modoActivo) {
      if (highlightRef.current) highlightRef.current.style.display = "none";
      return;
    }

    document.body.style.cursor = "crosshair";

    const isPanel = (el: Element) => el.closest("[data-notas-panel]") !== null;

    const onMouseOver = (e: MouseEvent) => {
      const target = e.target as Element;
      if (!target || isPanel(target)) {
        if (highlightRef.current) highlightRef.current.style.display = "none";
        hoveredRef.current = null;
        return;
      }
      hoveredRef.current = target;
      const rect = target.getBoundingClientRect();
      const h = highlightRef.current;
      if (h) {
        h.style.display = "block";
        h.style.top = `${rect.top + window.scrollY}px`;
        h.style.left = `${rect.left + window.scrollX}px`;
        h.style.width = `${rect.width}px`;
        h.style.height = `${rect.height}px`;
      }
    };

    const onMouseOut = (e: MouseEvent) => {
      const related = e.relatedTarget as Element | null;
      if (!related || isPanel(related)) {
        if (highlightRef.current) highlightRef.current.style.display = "none";
        hoveredRef.current = null;
      }
    };

    const onClick = (e: MouseEvent) => {
      const target = e.target as Element;
      if (!target || isPanel(target)) return;
      e.preventDefault();
      e.stopPropagation();

      const capturado: ElementoCapturado = {
        ruta: location.pathname,
        selector: getCssSelector(target),
        tagName: target.tagName.toLowerCase(),
        texto: getTextoPreview(target),
        clases: Array.from(target.classList).slice(0, 6).join(" "),
      };
      setElementoCapturado(capturado);
      forceUpdate((n) => n + 1);

      if (highlightRef.current) highlightRef.current.style.display = "none";
    };

    document.addEventListener("mouseover", onMouseOver, true);
    document.addEventListener("mouseout", onMouseOut, true);
    document.addEventListener("click", onClick, true);

    return () => {
      document.body.style.cursor = "";
      document.removeEventListener("mouseover", onMouseOver, true);
      document.removeEventListener("mouseout", onMouseOut, true);
      document.removeEventListener("click", onClick, true);
      if (highlightRef.current) highlightRef.current.style.display = "none";
    };
  }, [modoActivo, location.pathname, setElementoCapturado, panelAbierto]);

  return (
    <div
      ref={highlightRef}
      style={{
        position: "absolute",
        display: "none",
        pointerEvents: "none",
        zIndex: 9998,
        outline: "2px solid #f97316",
        outlineOffset: "2px",
        backgroundColor: "rgba(249,115,22,0.08)",
        borderRadius: "4px",
        transition: "top 0.05s, left 0.05s, width 0.05s, height 0.05s",
      }}
    />
  );
}
