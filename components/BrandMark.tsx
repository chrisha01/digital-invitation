/**
 * The Gatherly mark: a wax-seal ring broken for the G's opening, with the
 * crossbar drawn toward the centre. Sits inside an element styled `.brand`,
 * so it inherits that element's type size and colour.
 */
export default function BrandMark() {
  return (
    <>
      <svg
        className="brand-mark"
        viewBox="0 0 24 24"
        aria-hidden="true"
        focusable="false"
      >
        <circle
          cx="12"
          cy="12"
          r="7.6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeDasharray="43.77 3.98"
        />
        <path d="M15.4 12h4.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
      <span className="brand-word">Gatherly</span>
    </>
  );
}
