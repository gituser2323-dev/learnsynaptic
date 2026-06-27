"use client";

import { Play, Pause } from "lucide-react";
import { useRef, useState } from "react";
import Image from "next/image";

export default function HeroVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);

  const [playing, setPlaying] = useState(false);

  const toggleVideo = () => {
    if (!videoRef.current) return;

    if (videoRef.current.paused) {
      videoRef.current.play();
      setPlaying(true);
    } else {
      videoRef.current.pause();
      setPlaying(false);
    }
  };

  return (
    <div className="relative">

      {/* Main Card */}

      <div className="overflow-hidden rounded-3xl border bg-white shadow-2xl">

        <div className="relative aspect-video">

          <video
            ref={videoRef}
            className="h-full w-full object-cover"
            poster="/images/student-poster.jpg"
          >
            <source src="/videos/testimonial.mp4" type="video/mp4" />
          </video>

          {/* Overlay */}

          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

          {/* Play */}

          <button
            onClick={toggleVideo}
            className="absolute left-1/2 top-1/2 flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-xl transition hover:scale-105"
          >
            {playing ? (
              <Pause className="text-blue-600" size={34} />
            ) : (
              <Play
                className="ml-1 text-blue-600"
                size={34}
              />
            )}
          </button>

          {/* Bottom */}

          <div className="absolute bottom-6 left-6 text-white">

            <p className="text-sm opacity-80">

              Student Success Story

            </p>

            <h3 className="mt-1 text-2xl font-bold">

              From Beginner to Software Engineer 🚀

            </h3>

          </div>

        </div>

      </div>

      {/* Floating Rating */}

      <div className="absolute -top-6 left-8 rounded-2xl bg-white p-5 shadow-xl">

        <div className="flex items-center gap-2">

          ⭐⭐⭐⭐⭐

        </div>

        <p className="mt-2 text-sm text-slate-500">

          4.9 Google Rating

        </p>

      </div>

      {/* Placement */}

      <div className="absolute -bottom-8 right-6 rounded-2xl bg-blue-600 p-6 text-white shadow-2xl">

        <p className="text-sm">

          Students Placed

        </p>

        <h2 className="text-3xl font-black">

          650+

        </h2>

      </div>

    </div>
  );
}