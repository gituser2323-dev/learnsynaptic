"use client";

import Image from "next/image";

/**
 * Marketing hero media. The original testimonial MP4 / student poster files
 * are not present under public/; render the existing learn.jpeg still instead
 * of requesting missing /videos/testimonial.mp4 (404).
 */
export default function HeroVideo() {
  return (
    <div className="relative">
      <div className="overflow-hidden rounded-3xl border bg-white shadow-2xl">
        <div className="relative aspect-video">
          <Image
            src="/learn.jpeg"
            alt="LearnSynaptic student success"
            fill
            className="object-cover"
            sizes="(max-width: 1024px) 100vw, 560px"
            priority={false}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
          <div className="absolute bottom-6 left-6 text-white">
            <p className="text-sm opacity-80">Student Success Story</p>
            <h3 className="mt-1 text-2xl font-bold">From Beginner to Software Engineer</h3>
          </div>
        </div>
      </div>

      <div className="absolute -top-6 left-8 rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-center gap-2" aria-hidden="true">
          ⭐⭐⭐⭐⭐
        </div>
        <p className="mt-2 text-sm text-slate-500">4.9 Google Rating</p>
      </div>

      <div className="absolute -bottom-8 right-6 rounded-2xl bg-blue-600 p-6 text-white shadow-2xl">
        <p className="text-sm">Students Placed</p>
        <h2 className="text-3xl font-black">650+</h2>
      </div>
    </div>
  );
}
