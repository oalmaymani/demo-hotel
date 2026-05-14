"use client";

import { useMemo, useState } from "react";

type UnitGalleryProps = {
  images: string[];
  alt: string;
};

export function UnitGallery({ images, alt }: UnitGalleryProps) {
  const safeImages = useMemo(() => images.filter(Boolean), [images]);
  const [activeIndex, setActiveIndex] = useState(0);

  const current = safeImages[activeIndex];

  if (safeImages.length === 0) {
    return (
      <div className="h-60 bg-bg flex items-center justify-center text-primary/60">
        <span>Images</span>
      </div>
    );
  }

  function prev() {
    setActiveIndex((i) => (i - 1 + safeImages.length) % safeImages.length);
  }

  function next() {
    setActiveIndex((i) => (i + 1) % safeImages.length);
  }

  return (
    <div className="border-b">
      <div className="relative h-60 bg-bg overflow-hidden">
        <img src={current} alt={alt} className="h-full w-full object-cover" />
        {safeImages.length > 1 ? (
          <>
            <button
              type="button"
              onClick={prev}
              className="absolute left-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-white/90 border shadow-sm text-sm"
              aria-label="Previous image"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={next}
              className="absolute right-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-white/90 border shadow-sm text-sm"
              aria-label="Next image"
            >
              ›
            </button>
          </>
        ) : null}
      </div>

      {safeImages.length > 1 ? (
        <div className="p-4">
          <div className="flex flex-wrap gap-2">
            {safeImages.map((url, idx) => (
              <button
                key={`${url}-${idx}`}
                type="button"
                onClick={() => setActiveIndex(idx)}
                className={`h-14 w-14 rounded-xl overflow-hidden border ${idx === activeIndex ? "border-primary" : "border-transparent"}`}
                aria-label={`Image ${idx + 1}`}
              >
                <img src={url} alt={alt} className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
