// The section the reader is on: the last one whose top edge has reached `offset`
// from the top of the screen, or the first one before any has.
export function activeSectionId(
  sections: { id: string; top: number }[],
  offset: number,
): string | undefined {
  let active = sections[0]?.id;
  for (const section of sections) {
    if (section.top <= offset) active = section.id;
  }
  return active;
}
