'use client';

import { useEffect, useState } from 'react';
import { activeSectionId } from '../utils/activeSection';

const OFFSET = 120;

// Follows the reader through the sections. The screen scrolls inside its own
// container, and scroll events do not bubble, so they are caught on the way down.
export function useActiveSection(ids: readonly string[]) {
  const [active, setActive] = useState<string | undefined>(ids[0]);

  useEffect(() => {
    function update() {
      const tops = ids.flatMap((id) => {
        const el = document.getElementById(id);
        return el ? [{ id, top: el.getBoundingClientRect().top }] : [];
      });
      setActive(activeSectionId(tops, OFFSET));
    }
    update();
    document.addEventListener('scroll', update, { capture: true, passive: true });
    return () => document.removeEventListener('scroll', update, { capture: true });
  }, [ids]);

  return active;
}
