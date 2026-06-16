let initialised = false;

// Only alphanumeric + hyphens — matches valid GA4 (G-XXXXX) and GTM (GTM-XXXXX) IDs.
const SAFE_TAG_ID = /^[A-Z0-9][A-Z0-9-]{1,30}$/i;

function safeTagId(id: string): string | null {
  return SAFE_TAG_ID.test(id) ? id : null;
}

export function initAnalytics(tagId: string): void {
  if (!tagId || initialised) return;

  const safe = safeTagId(tagId);
  if (!safe) {
    console.warn("analytics: GOOGLE_TAG_ID contains invalid characters, skipping init");
    return;
  }

  initialised = true;

  if (safe.startsWith("GTM-")) {
    // Google Tag Manager — snippets use textContent, not innerHTML
    const script = document.createElement("script");
    script.textContent = `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${safe}');`;
    document.head.appendChild(script);

    const noscript = document.createElement("noscript");
    const iframe = document.createElement("iframe");
    iframe.src = `https://www.googletagmanager.com/ns.html?id=${safe}`;
    iframe.height = "0";
    iframe.width = "0";
    iframe.style.cssText = "display:none;visibility:hidden";
    noscript.appendChild(iframe);
    document.body.prepend(noscript);
  } else {
    // Google Analytics 4 (G-XXXXXXXX)
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${safe}`;
    document.head.appendChild(script);

    const inline = document.createElement("script");
    inline.textContent = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${safe}');`;
    document.head.appendChild(inline);
  }
}
