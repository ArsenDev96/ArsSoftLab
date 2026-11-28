| Source | Network | Visit | n | FCP | Scene visible | Scene fully visible | Scene ready | Scene requests | Wire 200 / 304 | Disk hits | Memory hits | Network bytes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| M1.4R.2 baseline | 50 Mbps / 20 ms | initial | 7 | 196 [168–408] IQR 16 | 1431 [1291–1606] IQR 155 | 1632 [1491–1806] IQR 156 | 1632 [1491–1806] IQR 156 | 94 | 94 / 0 | 0 | 0 | 5657 KB |
| M1.4R.2 prototype | 50 Mbps / 20 ms | initial | 7 | 200 [172–220] IQR 26 | 1387 [1293–2761] IQR 168 | 1587 [1493–2960] IQR 175 | 1587 [1493–2960] IQR 175 | 94 | 94 / 0 | 0 | 0 | 5658 KB |
| M1.4R.1 audit (proxy, headers unchanged) | 50 Mbps / 20 ms | initial | 7 | 192 [188–228] IQR 10 | 1433 [1319–1809] IQR 201 | 1633 [1519–2017] IQR 201 | 1633 [1519–2017] IQR 201 | 94 | 94 / 0 | 0 | 0 | 5657 KB |
| M1.4R.2 baseline | 50 Mbps / 20 ms | repeat | 7 | 160 [148–232] IQR 16 | 793 [463–1245] IQR 164 | 993 [663–1445] IQR 164 | 993 [663–1445] IQR 164 | 94 | 0 / 94 | 0 | 0 | 22 KB |
| M1.4R.2 prototype | 50 Mbps / 20 ms | repeat | 7 | 168 [148–188] IQR 14 | 265 [260–278] IQR 11 | 465 [460–478] IQR 10 | 465 [460–478] IQR 10 | 94 | 0 / 13 | 81 | 0 | 3 KB |
| M1.4R.1 audit (proxy, headers unchanged) | 50 Mbps / 20 ms | repeat | 7 | 160 [148–188] IQR 8 | 791 [703–910] IQR 43 | 991 [903–1110] IQR 43 | 991 [903–1110] IQR 43 | 94 | 0 / 94 | 0 | 0 | 22 KB |
| M1.4R.1 audit (proxy, all /scene/* rewritten) | 50 Mbps / 20 ms | repeat-fresh | 7 | 260 [180–284] IQR 14 | 350 [261–356] IQR 32 | 550 [461–555] IQR 30 | 550 [461–555] IQR 30 | 94 | 0 / 0 | 94 | 0 | 0 KB |
| M1.4R.2 baseline | 12 Mbps / 70 ms | initial | 7 | 324 [300–340] IQR 22 | 4281 [4250–4303] IQR 14 | 4491 [4451–4510] IQR 17 | 4558 [4451–5582] IQR 80 | 94 | 94 / 0 | 0 | 0 | 5657 KB |
| M1.4R.2 prototype | 12 Mbps / 70 ms | initial | 7 | 316 [296–332] IQR 10 | 4267 [4244–4289] IQR 17 | 4478 [4458–4508] IQR 26 | 4517 [4481–5397] IQR 49 | 94 | 94 / 0 | 0 | 0 | 5658 KB |
| M1.4R.1 audit (proxy, headers unchanged) | 12 Mbps / 70 ms | initial | 7 | 320 [300–332] IQR 8 | 4277 [4249–4299] IQR 22 | 4489 [4457–4517] IQR 22 | 4579 [4468–4683] IQR 74 | 94 | 94 / 0 | 0 | 0 | 5657 KB |
| M1.4R.2 baseline | 12 Mbps / 70 ms | repeat | 7 | 144 [128–216] IQR 60 | 1661 [1378–1695] IQR 65 | 1862 [1577–1895] IQR 65 | 1862 [1577–1895] IQR 65 | 94 | 0 / 94 | 0 | 0 | 22 KB |
| M1.4R.2 prototype | 12 Mbps / 70 ms | repeat | 7 | 184 [128–296] IQR 66 | 310 [261–395] IQR 27 | 512 [461–595] IQR 28 | 512 [461–595] IQR 28 | 94 | 0 / 13 | 81 | 0 | 3 KB |
| M1.4R.1 audit (proxy, headers unchanged) | 12 Mbps / 70 ms | repeat | 7 | 208 [144–212] IQR 58 | 1745 [1674–2775] IQR 81 | 1945 [1874–2974] IQR 82 | 1945 [1874–2974] IQR 82 | 94 | 0 / 94 | 0 | 0 | 22 KB |
| M1.4R.1 audit (proxy, all /scene/* rewritten) | 12 Mbps / 70 ms | repeat-fresh | 7 | 148 [124–212] IQR 64 | 307 [290–314] IQR 15 | 507 [490–514] IQR 15 | 507 [490–514] IQR 15 | 94 | 0 / 0 | 94 | 0 | 0 KB |

baseline 50-20 initial: v2: 81 requests, 0 disk, 0 × 304, 81 × 200; Cache-Control seen: public, max-age=0; gate fallback (style ≥ 3900 ms) 0/7; failed requests 0; console errors/warnings 0
prototype 50-20 initial: v2: 81 requests, 0 disk, 0 × 304, 81 × 200; Cache-Control seen: public, max-age=86400; gate fallback (style ≥ 3900 ms) 0/7; failed requests 0; console errors/warnings 0
baseline 50-20 repeat: v2: 81 requests, 0 disk, 81 × 304, 0 × 200; Cache-Control seen: public, max-age=0; gate fallback (style ≥ 3900 ms) 0/7; failed requests 0; console errors/warnings 0
prototype 50-20 repeat: v2: 81 requests, 81 disk, 0 × 304, 0 × 200; Cache-Control seen: public, max-age=86400; gate fallback (style ≥ 3900 ms) 0/7; failed requests 0; console errors/warnings 0
baseline 12-70 initial: v2: 81 requests, 0 disk, 0 × 304, 81 × 200; Cache-Control seen: public, max-age=0; gate fallback (style ≥ 3900 ms) 7/7; failed requests 0; console errors/warnings 0
prototype 12-70 initial: v2: 81 requests, 0 disk, 0 × 304, 81 × 200; Cache-Control seen: public, max-age=86400; gate fallback (style ≥ 3900 ms) 7/7; failed requests 0; console errors/warnings 0
baseline 12-70 repeat: v2: 81 requests, 0 disk, 81 × 304, 0 × 200; Cache-Control seen: public, max-age=0; gate fallback (style ≥ 3900 ms) 0/7; failed requests 0; console errors/warnings 0
prototype 12-70 repeat: v2: 81 requests, 81 disk, 0 × 304, 0 × 200; Cache-Control seen: public, max-age=86400; gate fallback (style ≥ 3900 ms) 0/7; failed requests 0; console errors/warnings 0

No console errors, warnings or uncaught exceptions in any trial.
