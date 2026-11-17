/**
 * The Gatherly mark: a wax-seal disc stamped with an italic serif G, sitting
 * beside the wordmark. Sits inside an element styled `.brand`, so the disc
 * takes its size from `.brand-mark` and its ink from the theme.
 */
export default function BrandMark() {
  return (
    <>
      <span className="brand-mark" aria-hidden="true">
        g
      </span>
      <span className="brand-word">Gatherly</span>
    </>
  );
}
