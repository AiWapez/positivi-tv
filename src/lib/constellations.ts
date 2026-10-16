/**
 * The constellations drawn in the night sky behind the globe: the stars of each figure, from the published positions of the real stars.
 *
 * Source: the Hipparcos catalogue (ESA, 1997), as distributed in the d3-celestial 0.7.35 data files (stars.6.json and starnames.json,
 * BSD-3-Clause, Copyright (c) 2015, Olaf Frohn; the licence text is kept in public/ASSETS.md). `hip` is the star's Hipparcos number, so every row can be looked up again. `ra` and `dec` are right ascension and
 * declination in degrees (equinox J2000), `mag` is the apparent magnitude (smaller is brighter). The dot `size` follows the magnitude
 * (brighter is bigger, in five steps) and the `color` follows the catalogue's B-V colour index, so blue stars are blue-white and Betelgeuse,
 * Antares and Aldebaran are orange. Orion's sizes and colours were chosen by hand when it was drawn alone and are kept as they were.
 * `scale` shrinks (or, for the small figures, enlarges) the figure about its own middle so every figure looks about the same size.
 * `anchor` is how many of the first stars fix the middle of the figure (Orion: its three belt stars). Without it, all of them do.
 */
export interface FigureStar { hip: number; name: string; ra: number; dec: number; mag: number; size: number; color: readonly [number, number, number] }
export interface Figure { name: string; scale: number; anchor?: number; stars: readonly FigureStar[] }

export const FIGURES: readonly Figure[] = [
  {
    name: 'Orion', scale: 0.45, anchor: 3,
    stars: [
      { hip: 26727, name: 'Alnitak', ra: 85.1897, dec: -1.9426, mag: 1.74, size: 0.14, color: [0.82, 0.9, 1] },
      { hip: 26311, name: 'Alnilam', ra: 84.0534, dec: -1.2019, mag: 1.69, size: 0.14, color: [0.82, 0.9, 1] },
      { hip: 25930, name: 'Mintaka', ra: 83.0017, dec: -0.2991, mag: 2.25, size: 0.14, color: [0.82, 0.9, 1] },
      { hip: 27989, name: 'Betelgeuse', ra: 88.7929, dec: 7.4071, mag: 0.45, size: 0.2, color: [1, 0.72, 0.45] },
      { hip: 25336, name: 'Bellatrix', ra: 81.2828, dec: 6.3497, mag: 1.64, size: 0.17, color: [0.82, 0.9, 1] },
      { hip: 24436, name: 'Rigel', ra: 78.6345, dec: -8.2016, mag: 0.18, size: 0.22, color: [0.8, 0.9, 1] },
      { hip: 27366, name: 'Saiph', ra: 86.9391, dec: -9.6696, mag: 2.07, size: 0.17, color: [0.82, 0.9, 1] },
    ],
  },
  {
    name: 'Ursa Major (the Big Dipper)', scale: 0.35,
    stars: [
      { hip: 54061, name: 'Dubhe', ra: 165.932, dec: 61.751, mag: 1.81, size: 0.17, color: [1, 0.81, 0.56] },
      { hip: 53910, name: 'Merak', ra: 165.4603, dec: 56.3824, mag: 2.34, size: 0.14, color: [0.91, 0.94, 0.99] },
      { hip: 58001, name: 'Phecda', ra: 178.4577, dec: 53.6948, mag: 2.41, size: 0.14, color: [0.91, 0.95, 0.99] },
      { hip: 59774, name: 'Megrez', ra: 183.8565, dec: 57.0326, mag: 3.32, size: 0.115, color: [0.93, 0.95, 0.98] },
      { hip: 62956, name: 'Alioth', ra: 193.5073, dec: 55.9598, mag: 1.76, size: 0.17, color: [0.89, 0.93, 1] },
      { hip: 65378, name: 'Mizar', ra: 200.9814, dec: 54.9254, mag: 2.23, size: 0.14, color: [0.92, 0.95, 0.98] },
      { hip: 67301, name: 'Alkaid', ra: 206.8852, dec: 49.3133, mag: 1.85, size: 0.17, color: [0.84, 0.91, 1] },
    ],
  },
  {
    name: 'Cassiopeia', scale: 0.64,
    stars: [
      { hip: 3179, name: 'α Cas', ra: 10.1268, dec: 56.5373, mag: 2.24, size: 0.14, color: [1, 0.79, 0.54] },
      { hip: 746, name: 'Caph', ra: 2.2945, dec: 59.1498, mag: 2.28, size: 0.14, color: [1, 0.97, 0.88] },
      { hip: 4427, name: 'γ Cas', ra: 14.1772, dec: 60.7167, mag: 2.15, size: 0.14, color: [0.87, 0.93, 1] },
      { hip: 6686, name: 'δ Cas', ra: 21.454, dec: 60.2353, mag: 2.66, size: 0.14, color: [0.95, 0.96, 0.96] },
      { hip: 8886, name: 'ε Cas', ra: 28.5989, dec: 63.6701, mag: 3.35, size: 0.115, color: [0.81, 0.9, 1] },
    ],
  },
  {
    name: 'Ursa Minor (the Little Dipper)', scale: 0.45,
    stars: [
      { hip: 11767, name: 'Polaris', ra: 37.9545, dec: 89.2641, mag: 1.97, size: 0.17, color: [1, 0.92, 0.76] },
      { hip: 72607, name: 'Kochab', ra: 222.6764, dec: 74.1555, mag: 2.07, size: 0.14, color: [1, 0.73, 0.46] },
      { hip: 75097, name: 'γ UMi', ra: 230.1821, dec: 71.834, mag: 3, size: 0.115, color: [0.92, 0.95, 0.98] },
      { hip: 77055, name: 'ζ UMi', ra: 236.0147, dec: 77.7945, mag: 4.29, size: 0.115, color: [0.91, 0.95, 0.99] },
      { hip: 79822, name: 'η UMi', ra: 244.3762, dec: 75.7553, mag: 4.95, size: 0.115, color: [1, 0.96, 0.87] },
      { hip: 82080, name: 'ε UMi', ra: 251.4927, dec: 82.0373, mag: 4.21, size: 0.115, color: [1, 0.85, 0.63] },
      { hip: 85822, name: 'δ UMi', ra: 263.0542, dec: 86.5865, mag: 4.35, size: 0.115, color: [0.91, 0.94, 0.99] },
    ],
  },
  {
    name: 'Crux (the Southern Cross)', scale: 1.41,
    stars: [
      { hip: 60718, name: 'Acrux', ra: 186.6496, dec: -63.0991, mag: 0.77, size: 0.2, color: [0.78, 0.88, 1] },
      { hip: 62434, name: 'Mimosa', ra: 191.9303, dec: -59.6888, mag: 1.25, size: 0.2, color: [0.78, 0.88, 1] },
      { hip: 61084, name: 'Gacrux', ra: 187.7915, dec: -57.1132, mag: 1.59, size: 0.17, color: [1, 0.72, 0.45] },
      { hip: 59747, name: 'δ Cru', ra: 183.7863, dec: -58.7489, mag: 2.79, size: 0.14, color: [0.78, 0.88, 1] },
    ],
  },
  {
    name: 'Scorpius', scale: 0.35,
    stars: [
      { hip: 78820, name: 'β Sco', ra: 241.3593, dec: -19.8055, mag: 2.56, size: 0.14, color: [0.86, 0.92, 1] },
      { hip: 78401, name: 'δ Sco', ra: 240.0834, dec: -22.6217, mag: 2.29, size: 0.14, color: [0.83, 0.9, 1] },
      { hip: 78265, name: 'π Sco', ra: 239.713, dec: -26.1141, mag: 2.89, size: 0.14, color: [0.79, 0.89, 1] },
      { hip: 80112, name: 'σ Sco', ra: 245.2972, dec: -25.5928, mag: 2.9, size: 0.14, color: [1, 0.98, 0.92] },
      { hip: 80763, name: 'Antares', ra: 247.3519, dec: -26.432, mag: 1.06, size: 0.2, color: [1, 0.72, 0.45] },
      { hip: 81266, name: 'τ Sco', ra: 248.9706, dec: -28.216, mag: 2.82, size: 0.14, color: [0.78, 0.88, 1] },
      { hip: 82396, name: 'ε Sco', ra: 252.5409, dec: -34.2932, mag: 2.29, size: 0.14, color: [1, 0.79, 0.54] },
      { hip: 82514, name: 'μ Sco', ra: 252.9676, dec: -38.0474, mag: 3, size: 0.115, color: [0.78, 0.88, 1] },
      { hip: 84143, name: 'η Sco', ra: 258.0383, dec: -43.2392, mag: 3.32, size: 0.115, color: [1, 0.96, 0.85] },
      { hip: 86228, name: 'Sargas', ra: 264.3297, dec: -42.9978, mag: 1.86, size: 0.17, color: [1, 0.96, 0.87] },
      { hip: 87073, name: 'ι Sco', ra: 266.8962, dec: -40.127, mag: 2.99, size: 0.14, color: [1, 0.94, 0.82] },
      { hip: 86670, name: 'κ Sco', ra: 265.622, dec: -39.03, mag: 2.39, size: 0.14, color: [0.8, 0.89, 1] },
      { hip: 85927, name: 'Shaula', ra: 263.4022, dec: -37.1038, mag: 1.62, size: 0.17, color: [0.78, 0.88, 1] },
      { hip: 85696, name: 'Lesath', ra: 262.691, dec: -37.2958, mag: 2.7, size: 0.14, color: [0.79, 0.89, 1] },
    ],
  },
  {
    name: 'Leo', scale: 0.35,
    stars: [
      { hip: 49669, name: 'Regulus', ra: 152.093, dec: 11.9672, mag: 1.36, size: 0.17, color: [0.85, 0.91, 1] },
      { hip: 49583, name: 'η Leo', ra: 151.8331, dec: 16.7627, mag: 3.48, size: 0.115, color: [0.88, 0.93, 1] },
      { hip: 50583, name: 'Algieba', ra: 154.9931, dec: 19.8415, mag: 2.01, size: 0.14, color: [1, 0.79, 0.55] },
      { hip: 50335, name: 'ζ Leo', ra: 154.1726, dec: 23.4173, mag: 3.43, size: 0.115, color: [1, 0.98, 0.92] },
      { hip: 48455, name: 'μ Leo', ra: 148.1909, dec: 26.007, mag: 3.88, size: 0.115, color: [1, 0.78, 0.52] },
      { hip: 47908, name: 'ε Leo', ra: 146.4628, dec: 23.7743, mag: 2.97, size: 0.14, color: [1, 0.87, 0.67] },
      { hip: 54872, name: 'Zosma', ra: 168.5271, dec: 20.5237, mag: 2.56, size: 0.14, color: [0.94, 0.96, 0.97] },
      { hip: 54879, name: 'θ Leo', ra: 168.56, dec: 15.4296, mag: 3.33, size: 0.115, color: [0.9, 0.94, 1] },
      { hip: 57632, name: 'Denebola', ra: 177.2649, dec: 14.5721, mag: 2.14, size: 0.14, color: [0.93, 0.95, 0.98] },
    ],
  },
  {
    name: 'Cygnus (the Northern Cross)', scale: 0.38,
    stars: [
      { hip: 102098, name: 'Deneb', ra: 310.358, dec: 45.2803, mag: 1.25, size: 0.2, color: [0.93, 0.95, 0.98] },
      { hip: 100453, name: 'Sadr', ra: 305.5571, dec: 40.2567, mag: 2.23, size: 0.14, color: [1, 0.91, 0.74] },
      { hip: 95947, name: 'Albireo', ra: 292.6803, dec: 27.9597, mag: 3.05, size: 0.115, color: [1, 0.8, 0.56] },
      { hip: 97165, name: 'δ Cyg', ra: 296.2437, dec: 45.1308, mag: 2.86, size: 0.14, color: [0.9, 0.94, 1] },
      { hip: 102488, name: 'ε Cyg', ra: 311.5528, dec: 33.9703, mag: 2.48, size: 0.14, color: [1, 0.82, 0.57] },
    ],
  },
  {
    name: 'Lyra', scale: 1.13,
    stars: [
      { hip: 91262, name: 'Vega', ra: 279.2347, dec: 38.7837, mag: 0.03, size: 0.22, color: [0.9, 0.94, 1] },
      { hip: 92420, name: 'β Lyr', ra: 282.52, dec: 33.3627, mag: 3.52, size: 0.115, color: [0.9, 0.94, 1] },
      { hip: 93194, name: 'γ Lyr', ra: 284.7359, dec: 32.6896, mag: 3.25, size: 0.115, color: [0.87, 0.93, 1] },
      { hip: 92791, name: 'δ Lyr', ra: 283.6262, dec: 36.8986, mag: 4.22, size: 0.115, color: [1, 0.72, 0.45] },
      { hip: 91971, name: 'ζ Lyr', ra: 281.1932, dec: 37.6051, mag: 4.34, size: 0.115, color: [0.96, 0.97, 0.95] },
    ],
  },
  {
    name: 'Taurus', scale: 0.42,
    stars: [
      { hip: 21421, name: 'Aldebaran', ra: 68.9802, dec: 16.5093, mag: 0.87, size: 0.2, color: [1, 0.72, 0.45] },
      { hip: 20894, name: 'θ Tau', ra: 67.1656, dec: 15.8709, mag: 3.4, size: 0.115, color: [0.96, 0.96, 0.95] },
      { hip: 20205, name: 'γ Tau', ra: 64.9483, dec: 15.6276, mag: 3.65, size: 0.115, color: [1, 0.83, 0.59] },
      { hip: 20455, name: 'δ Tau', ra: 65.7337, dec: 17.5425, mag: 3.77, size: 0.115, color: [1, 0.82, 0.59] },
      { hip: 20889, name: 'ε Tau', ra: 67.1542, dec: 19.1804, mag: 3.53, size: 0.115, color: [1, 0.82, 0.58] },
      { hip: 25428, name: 'Elnath', ra: 81.573, dec: 28.6075, mag: 1.65, size: 0.17, color: [0.82, 0.9, 1] },
      { hip: 26451, name: 'ζ Tau', ra: 84.4112, dec: 21.1425, mag: 2.97, size: 0.14, color: [0.81, 0.9, 1] },
    ],
  },
  {
    name: 'Canis Major', scale: 0.47,
    stars: [
      { hip: 32349, name: 'Sirius', ra: 101.2872, dec: -16.7161, mag: -1.44, size: 0.22, color: [0.9, 0.94, 1] },
      { hip: 30324, name: 'Mirzam', ra: 95.6749, dec: -17.9559, mag: 1.98, size: 0.17, color: [0.78, 0.88, 1] },
      { hip: 34444, name: 'Wezen', ra: 107.0979, dec: -26.3932, mag: 1.83, size: 0.17, color: [1, 0.91, 0.74] },
      { hip: 33579, name: 'Adhara', ra: 104.6565, dec: -28.9721, mag: 1.5, size: 0.17, color: [0.78, 0.88, 1] },
      { hip: 35904, name: 'Aludra', ra: 111.0238, dec: -29.3031, mag: 2.45, size: 0.14, color: [0.85, 0.92, 1] },
      { hip: 30122, name: 'ζ CMa', ra: 95.0783, dec: -30.0634, mag: 3.02, size: 0.115, color: [0.8, 0.89, 1] },
    ],
  },
];
