"use client";

import Script from "next/script";
import {
  GA4_MEASUREMENT_ID,
  IS_GA4_ENABLED,
  IS_META_PIXEL_ENABLED,
  META_PIXEL_ID,
} from "@/config/analytics";

/**
 * Bootstraps GA4 (window.gtag) and Meta Pixel (window.fbq). Renders no
 * visible UI — script tags only. Each provider's script is omitted
 * entirely when its ID isn't configured in config/analytics.ts.
 *
 * GA4 is initialized with send_page_view: false because PageViewTracker
 * fires page_view explicitly on every route change (including client-side
 * navigations gtag.js's own auto-pageview logic won't observe under the
 * App Router) — this avoids double-counting the first load.
 */
export function AnalyticsScripts() {
  return (
    <>
      {IS_GA4_ENABLED && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA4_MEASUREMENT_ID}`}
            strategy="afterInteractive"
          />
          <Script id="ga4-init" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){window.dataLayer.push(arguments);}
              window.gtag = gtag;
              gtag('js', new Date());
              gtag('config', '${GA4_MEASUREMENT_ID}', { send_page_view: false });
            `}
          </Script>
        </>
      )}

      {IS_META_PIXEL_ENABLED && (
        <Script id="meta-pixel-init" strategy="afterInteractive">
          {`
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${META_PIXEL_ID}');
            fbq('track', 'PageView');
          `}
        </Script>
      )}
    </>
  );
}
