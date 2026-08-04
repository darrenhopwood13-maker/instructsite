import { useEffect, useState } from "react";

/**
 * Floating action buttons sit on top of real content. On narrow screens that
 * means they can cover the text someone is actively reading. Hide them while
 * the user scrolls down the page; bring them back when they scroll up, reach
 * the top, or stop scrolling for a moment.
 */
export function useFabVisibility(): boolean {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    let last = window.scrollY;
    let idle: ReturnType<typeof setTimeout> | undefined;

    const onScroll = () => {
      const y = window.scrollY;
      const delta = y - last;
      if (y < 24) setVisible(true);
      else if (delta > 6) setVisible(false);
      else if (delta < -6) setVisible(true);
      last = y;
      if (idle) clearTimeout(idle);
      idle = setTimeout(() => setVisible(true), 900);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (idle) clearTimeout(idle);
    };
  }, []);

  return visible;
}
