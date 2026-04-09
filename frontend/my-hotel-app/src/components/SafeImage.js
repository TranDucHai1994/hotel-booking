import { useEffect, useMemo, useState } from 'react';
import { MdHotel } from 'react-icons/md';

export default function SafeImage({
  src,
  sources = [],
  alt = '',
  className = '',
  wrapperClassName = '',
  fallbackClassName = '',
  title = '',
  subtitle = '',
}) {
  const normalizedSources = useMemo(() => {
    const unique = [];
    const pool = [src, ...sources].filter(Boolean);
    pool.forEach((item) => {
      if (!unique.includes(item)) unique.push(item);
    });
    return unique;
  }, [src, sources]);

  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [normalizedSources]);

  const currentSource = normalizedSources[index] || '';
  const hasImage = Boolean(currentSource);

  const handleError = () => {
    setIndex((current) => current + 1);
  };

  return (
    <div className={wrapperClassName}>
      {hasImage ? (
        <img src={currentSource} alt={alt} className={className} onError={handleError} />
      ) : (
        <div
          className={`relative overflow-hidden bg-gradient-to-br from-slate-900 via-blue-700 to-cyan-500 ${fallbackClassName}`}
        >
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_top_right,_white,_transparent_45%)]" />
          <div className="absolute inset-0 opacity-10 bg-[linear-gradient(135deg,transparent_0%,white_100%)]" />
          <div className="relative h-full w-full flex flex-col items-start justify-end p-4 text-white">
            <div className="bg-white/15 backdrop-blur-sm rounded-2xl p-3 mb-3">
              <MdHotel className="text-3xl" />
            </div>
            {title ? <div className="font-semibold text-lg leading-tight">{title}</div> : null}
            {subtitle ? <div className="text-sm text-blue-100 mt-1">{subtitle}</div> : null}
          </div>
        </div>
      )}
    </div>
  );
}
