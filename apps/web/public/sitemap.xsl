<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:sitemap="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:xhtml="http://www.w3.org/1999/xhtml"
  exclude-result-prefixes="sitemap xhtml">
  <xsl:output method="html" encoding="UTF-8" omit-xml-declaration="yes" />
  <xsl:strip-space elements="*" />

  <xsl:template match="/">
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Fiscal.ge / XML sitemap</title>
        <style>
          :root {
            color-scheme: light;
            font-family: Georgia, "Times New Roman", serif;
            background: #f5f0e7;
            color: #24211d;
          }

          * { box-sizing: border-box; }

          body {
            margin: 0;
            background: #f5f0e7;
          }

          main {
            width: min(1180px, calc(100% - 40px));
            margin: 0 auto;
            padding: 56px 0 72px;
          }

          header {
            border-top: 4px solid #24211d;
            border-bottom: 1px solid #bdb4a6;
            padding: 18px 0 22px;
          }

          .eyebrow,
          .meta,
          .column-label,
          .last-modified,
          .language-list {
            font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
          }

          .eyebrow {
            margin: 0 0 12px;
            color: #b3402a;
            font-size: 0.75rem;
            letter-spacing: 0.11em;
            text-transform: uppercase;
          }

          h1 {
            margin: 0;
            font-size: clamp(2rem, 5vw, 3.5rem);
            font-weight: 400;
            letter-spacing: -0.04em;
          }

          .meta {
            margin: 14px 0 0;
            color: #655f56;
            font-size: 0.8rem;
          }

          .sitemap {
            margin-top: 28px;
            border-top: 1px solid #bdb4a6;
          }

          .column-label,
          .sitemap-row {
            display: grid;
            grid-template-columns: minmax(0, 1fr) 10rem 8rem;
            gap: 20px;
            align-items: start;
          }

          .column-label {
            padding: 12px 0;
            color: #655f56;
            font-size: 0.7rem;
            letter-spacing: 0.08em;
            text-transform: uppercase;
          }

          .sitemap-row {
            padding: 16px 0;
            border-top: 1px solid #d8d0c5;
          }

          .url {
            display: block;
            min-width: 0;
            overflow-wrap: anywhere;
            color: #24211d;
            font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
            font-size: 0.84rem;
            line-height: 1.55;
            text-decoration: none;
          }

          .url:hover,
          .url:focus-visible {
            color: #b3402a;
            text-decoration: underline;
            text-underline-offset: 3px;
          }

          .last-modified {
            display: block;
            color: #655f56;
            font-size: 0.78rem;
            line-height: 1.55;
          }

          .language-list {
            display: flex;
            flex-wrap: wrap;
            gap: 5px;
          }

          .language {
            display: inline-block;
            padding: 3px 6px;
            border: 1px solid #bdb4a6;
            color: #655f56;
            font-size: 0.68rem;
            text-decoration: none;
          }

          .language:hover,
          .language:focus-visible {
            border-color: #b3402a;
            color: #b3402a;
          }

          @media (max-width: 720px) {
            main {
              width: min(100% - 28px, 560px);
              padding: 30px 0 48px;
            }

            .column-label { display: none; }

            .sitemap-row {
              display: block;
              padding: 16px 0 18px;
            }

            .last-modified,
            .language-list {
              margin-top: 9px;
            }

            .last-modified::before {
              content: "Last modified: ";
              color: #8c8377;
            }
          }
        </style>
      </head>
      <body>
        <main>
          <header>
            <p class="eyebrow">Fiscal.ge / XML sitemap</p>
            <h1>Public pages</h1>
            <p class="meta">
              <xsl:value-of select="count(/sitemap:urlset/sitemap:url)" /> pages · machine-readable XML with a human-readable view
            </p>
          </header>

          <section class="sitemap" aria-label="Sitemap URLs">
            <div class="column-label" aria-hidden="true">
              <span>Page URL</span>
              <span>Last modified</span>
              <span>Languages</span>
            </div>

            <xsl:for-each select="/sitemap:urlset/sitemap:url">
              <div class="sitemap-row">
                <a class="url" href="{sitemap:loc}"><xsl:value-of select="sitemap:loc" /></a>
                <span class="last-modified"><xsl:value-of select="substring(sitemap:lastmod, 1, 10)" /></span>
                <span class="language-list">
                  <xsl:for-each select="xhtml:link">
                    <a class="language" href="{@href}"><xsl:value-of select="@hreflang" /></a>
                  </xsl:for-each>
                </span>
              </div>
            </xsl:for-each>
          </section>
        </main>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
