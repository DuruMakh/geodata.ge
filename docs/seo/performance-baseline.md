# Fiscal.ge SEO Performance Baseline

Audit date: 2026-08-21  
Production origin: `https://fiscal.ge`  
Purpose: pre-SEO payload baseline; field Core Web Vitals require Search Console data.

| Route | Decompressed HTML characters | Brotli response bytes |
| --- | ---: | ---: |
| `/` | 44,956 | approximately 9 KB |
| `/explorer/expenditure` | 529,917 | approximately 43 KB |
| `/explorer/revenue` | 212,232 | approximately 22 KB |
| `/explorer/analysis` | 544,567 | approximately 42 KB |
| `/explorer/municipalities` | 624,801 | approximately 107 KB |
| `/explorer/municipalities/04` | 140,194 | approximately 18 KB |

The municipality index is the first payload-investigation candidate. The SEO release must not increase representative decompressed HTML or transferred JavaScript by more than 10% without an explicit content justification.

Field targets at the 75th percentile:

- LCP at most 2.5 seconds;
- INP at most 200 milliseconds;
- CLS at most 0.1.

Post-release results must distinguish Lighthouse/PageSpeed lab measurements from Search Console field measurements. A larger explorer client/server restructuring requires a separate performance specification rather than an incidental SEO refactor.
