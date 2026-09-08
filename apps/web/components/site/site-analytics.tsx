import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";

export function SiteAnalytics() {
  return (
    <>
      <Script id="google-analytics" strategy="lazyOnload">
        {`
          (function () {
            if (window.location.hostname !== "fiscal.ge") return;

            window.dataLayer = window.dataLayer || [];
            window.gtag = function () { window.dataLayer.push(arguments); };
            window.gtag("js", new Date());
            window.gtag("config", "G-RRS446MKJW");

            var script = document.createElement("script");
            script.async = true;
            script.src = "https://www.googletagmanager.com/gtag/js?id=G-RRS446MKJW";
            document.head.appendChild(script);
          })();
        `}
      </Script>
      <Script id="microsoft-clarity" strategy="afterInteractive">
        {`
          (function (c, l, a, r, i, t, y) {
            if (l.location.hostname !== "fiscal.ge") return;

            c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
            t = l.createElement(r);
            t.async = true;
            t.src = "https://www.clarity.ms/tag/" + i;
            y = l.getElementsByTagName(r)[0];
            y.parentNode.insertBefore(t, y);
          })(window, document, "clarity", "script", "y9my6v583o");
        `}
      </Script>
      {process.env.VERCEL === "1" && <Analytics />}
    </>
  );
}
