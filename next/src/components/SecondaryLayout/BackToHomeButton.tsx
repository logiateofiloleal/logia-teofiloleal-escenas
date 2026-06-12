'use client';

interface Props {
  className?: string;
  lnClassName?: string;
}

export default function BackToHomeButton({ className, lnClassName }: Props) {
  function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    if (typeof history !== 'undefined') {
      history.scrollRestoration = 'manual';
    }
    window.scrollTo(0, 0);
    window.location.href = '/';
  }

  return (
    <a href="/" className={className} onClick={handleClick}>
      {lnClassName && <span className={lnClassName} />}
      Volver al inicio
    </a>
  );
}
