import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'
import { FAQ, RULES, SITE, STEPS_HOW, WHAT_IS } from './src/content/about.ts'

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/**
 * Crawlers that do not run JavaScript (most AI search bots) see an empty #root in a SPA.
 * This writes the landing copy into #root as plain HTML (React replaces it on mount) and adds
 * FAQPage JSON-LD that matches the FAQ shown on the landing page.
 */
function staticLanding(): Plugin {
  const html = `<main class="seo-static">
<h1>EIA Lens: Environmental Impact Assessment (EIA) review tool</h1>
<p>${esc(WHAT_IS)}</p>
<h2>How it works</h2>
<ul>${STEPS_HOW.map((s) => `<li><strong>${esc(s.title)}.</strong> ${esc(s.text)}</li>`).join('')}</ul>
<h2>The ten audit rules</h2>
<ol>${RULES.map(([id, t]) => `<li>${id}: ${esc(t)}</li>`).join('')}</ol>
<h2>Frequently asked questions</h2>
${FAQ.map((f) => `<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`).join('\n')}
<p>Developed by <a href="https://github.com/Anusara14">Anusara14</a>. Source code on <a href="https://github.com/Anusara14/EIA-Lens">GitHub</a>. Last updated ${SITE.updated}.</p>
</main>`
  const faqLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  })
  return {
    name: 'static-landing',
    transformIndexHtml: {
      order: 'pre',
      handler: (src) =>
        src
          .replaceAll('%SITE_TITLE%', esc(SITE.title))
          .replaceAll('%SITE_DESCRIPTION%', esc(SITE.description))
          .replaceAll('%SITE_URL%', SITE.url)
          .replaceAll('%SITE_UPDATED%', SITE.updated)
          .replace('<!--static-->', html)
          .replace('</head>', `<script type="application/ld+json">${faqLd}</script>\n</head>`),
    },
  }
}

export default defineConfig({
  plugins: [staticLanding(), react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
})
