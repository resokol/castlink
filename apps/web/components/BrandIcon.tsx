/** Decorative beside the CastLink wordmark; the SVG is shared with Windows. */
export function BrandIcon({ className }: { className?: string }) {
  return <img src="/icon.svg" width="34" height="34" className={className} alt="" aria-hidden="true" />;
}
