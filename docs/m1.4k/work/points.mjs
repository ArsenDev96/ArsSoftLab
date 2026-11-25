// M1.4I.1E: the points the pointer tests use (scene px, at rest). raise() = where Playground's lift takes a label point.
export const raise = ([x, y]) => [1218 + (x - 1218) * 1.01, 546 + (y - 546) * 1.01 - 18];
export const P = {
  engineering: { art: [405, 430], art2: [520, 440], platform: [470, 525], corner: [580, 515], corner2: [300, 500], title: [480, 333], icon: [383, 341], chips: [[465, 366], [560, 366]], empty: [700, 620], next: ["creative", [250, 600]], edge: [500, 376] },
  educational: { art: [858, 330], art2: [735, 365], platform: [838, 470], corner: [980, 470], corner2: [690, 440], title: [880, 235], icon: [783, 242], chips: [[862, 267], [940, 267]], empty: [640, 300], next: ["playground", [1200, 440]], edge: [862, 277] },
  playground: { art: [1200, 400], art2: [1250, 420], platform: [1215, 530], corner: [1360, 510], corner2: [1080, 520], title: [1340, 336], icon: null, chips: [[1316, 369]], empty: [1480, 430], next: ["experience", [1450, 610]], edge: [1316, 378] },
  creative: { art: [250, 600], art2: [400, 680], platform: [300, 740], corner: [490, 720], corner2: [110, 740], title: [480, 586], icon: [366, 597], chips: [[454, 620]], empty: [640, 720], next: ["engineering", [470, 525]], edge: [454, 630] },
  experience: { art: [1450, 610], art2: [1400, 575], platform: [1400, 730], corner: [1225, 720], corner2: [1640, 720], title: [1323, 579], icon: [1235, 586], chips: [[1311, 613]], empty: [1120, 760], next: ["playground", [1215, 530]], edge: [1311, 623] },
};
