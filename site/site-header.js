/* Shared site header for learning.recursive.eco (working title: Recursive Eco-Improvement).
 * PORTED from recursive-tarot/site-header.js under its Prime Rule: the dropdown, positioning,
 * keyboard, touch and auto-hide code below is tarot's, unchanged. Only the menus, the brand, the
 * accent and the root prefix changed. Fix a mechanism in tarot first; the next port inherits it.
 *
 * Usage:  <script src="/site-header.js"></script>
 *         <site-header active="words"></site-header>
 * `active` is one of: home, words, sources, ideas, play, institutions. On a viewer page
 * (/viewers/...) the tab is always derived from the grammar in ?src=, so the viewers keep
 * their tarot `active` values unedited. Hand-written pages that load ../shared/nav.js get
 * this header through that shim (see the top of shared/nav.js).
 *
 * THE SITE MAP lives here, once: the menu arrays below. shared/nav.js holds only the list of
 * games and their views (the Walk's view switcher). scripts/check_all.py parses these arrays
 * and fails when an href lands on nothing.
 *
 * The brand mark is her spiral, the path copied verbatim from scripts/mark.svg (check_all
 * asserts it). No emoji, no redrawn mark.
 */
(function () {
  if (customElements.get('site-header')) return;

  // Root-relative. The site is served at the root of learning.recursive.eco (the github.io
  // address 301s there). Tarot's depth formula ('../'.repeat(segs-1)) reads /glossary/ as the
  // root, because a trailing-slash page has one segment, so it is not used here.
  const PFX = '/';

  // The spiral: her mark, verbatim from scripts/mark.svg (viewBox 0 0 100 100).
  const SPIRAL_D = 'M50.5 50L50.5 50.01 50.51,50.02 50.51,50.03 50.51,50.04 50.51,50.05 50.52,50.07 50.52,50.08 50.52,50.09 50.52,50.1 50.52,50.11 50.52,50.12 50.52,50.13 50.52,50.15 50.52,50.16 50.52,50.17 50.52,50.18 50.52,50.19 50.52,50.21 50.52,50.22 50.52,50.23 50.52,50.24 50.52,50.26 50.51,50.27 50.51,50.28 50.51,50.29 50.51,50.31 50.5,50.32 50.5,50.33 50.49,50.34 50.49,50.36 50.49,50.37 50.48,50.38 50.48,50.39 50.47,50.41 50.47,50.42 50.46,50.43 50.45,50.44 50.45,50.46 50.44,50.47 50.43,50.48 50.43,50.49 50.42,50.5 50.41,50.52 50.4,50.53 50.39,50.54 50.38,50.55 50.37,50.56 50.36,50.57 50.35,50.59 50.34,50.6 50.33,50.61 50.32,50.62 50.31,50.63 50.3,50.64 50.29,50.65 50.28,50.66 50.27,50.67 50.25,50.68 50.24,50.69 50.23,50.7 50.21,50.71 50.2,50.72 50.19,50.73 50.17,50.73 50.16,50.74 50.14,50.75 50.13,50.76 50.11,50.77 50.1,50.77 50.08,50.78 50.07,50.79 50.05,50.79 50.03,50.8 50.02,50.8 50,50.81 49.98,50.81 49.97,50.82 49.95,50.82 49.93,50.83 49.91,50.83 49.89,50.83 49.88,50.84 49.86,50.84 49.84,50.84 49.82,50.84 49.8,50.85 49.78,50.85 49.76,50.85 49.74,50.85 49.72,50.85 49.71,50.85 49.69,50.85 49.67,50.84 49.65,50.84 49.63,50.84 49.61,50.84 49.59,50.83 49.57,50.83 49.55,50.83 49.53,50.82 49.5,50.82 49.48,50.81 49.46,50.81 49.44,50.8 49.42,50.79 49.4,50.79 49.38,50.78 49.36,50.77 49.34,50.76 49.32,50.75 49.3,50.74 49.28,50.73 49.26,50.72 49.24,50.71 49.22,50.7 49.2,50.69 49.18,50.68 49.16,50.66 49.15,50.65 49.13,50.63 49.11,50.62 49.09,50.61 49.07,50.59 49.05,50.57 49.03,50.56 49.02,50.54 49,50.52 48.98,50.51 48.96,50.49 48.95,50.47 48.93,50.45 48.92,50.43 48.9,50.41 48.88,50.39 48.87,50.37 48.85,50.35 48.84,50.32 48.83,50.3 48.81,50.28 48.8,50.26 48.79,50.23 48.77,50.21 48.76,50.18 48.75,50.16 48.74,50.13 48.73,50.11 48.72,50.08 48.71,50.05 48.7,50.03 48.69,50 48.68,49.97 48.68,49.94 48.67,49.92 48.66,49.89 48.66,49.86 48.65,49.83 48.65,49.8 48.64,49.77 48.64,49.74 48.63,49.71 48.63,49.68 48.63,49.65 48.63,49.62 48.63,49.59 48.63,49.55 48.63,49.52 48.63,49.49 48.63,49.46 48.64,49.43 48.64,49.39 48.64,49.36 48.65,49.33 48.66,49.3 48.66,49.26 48.67,49.23 48.68,49.2 48.69,49.17 48.7,49.13 48.71,49.1 48.72,49.07 48.73,49.03 48.74,49 48.75,48.97 48.77,48.94 48.78,48.9 48.8,48.87 48.81,48.84 48.83,48.81 48.85,48.77 48.87,48.74 48.89,48.71 48.91,48.68 48.93,48.65 48.95,48.62 48.97,48.59 49,48.56 49.02,48.53 49.05,48.5 49.07,48.47 49.1,48.44 49.13,48.41 49.15,48.38 49.18,48.35 49.21,48.33 49.24,48.3 49.27,48.27 49.31,48.25 49.34,48.22 49.37,48.19 49.41,48.17 49.44,48.15 49.48,48.12 49.51,48.1 49.55,48.08 49.59,48.06 49.63,48.04 49.66,48.02 49.7,48 49.74,47.98 49.79,47.96 49.83,47.94 49.87,47.93 49.91,47.91 49.96,47.9 50,47.88 50.04,47.87 50.09,47.86 50.14,47.85 50.18,47.83 50.23,47.82 50.28,47.82 50.32,47.81 50.37,47.8 50.42,47.8 50.47,47.79 50.52,47.79 50.57,47.78 50.62,47.78 50.67,47.78 50.72,47.78 50.77,47.78 50.82,47.79 50.88,47.79 50.93,47.79 50.98,47.8 51.03,47.81 51.08,47.82 51.14,47.82 51.19,47.83 51.24,47.85 51.3,47.86 51.35,47.87 51.4,47.89 51.46,47.91 51.51,47.92 51.56,47.94 51.62,47.96 51.67,47.98 51.72,48.01 51.77,48.03 51.83,48.05 51.88,48.08 51.93,48.11 51.98,48.14 52.03,48.17 52.09,48.2 52.14,48.23 52.19,48.27 52.24,48.3 52.29,48.34 52.34,48.38 52.39,48.42 52.43,48.46 52.48,48.5 52.53,48.54 52.57,48.58 52.62,48.63 52.67,48.68 52.71,48.72 52.75,48.77 52.8,48.82 52.84,48.88 52.88,48.93 52.92,48.98 52.96,49.04 53,49.09 53.04,49.15 53.07,49.21 53.11,49.27 53.14,49.33 53.18,49.39 53.21,49.46 53.24,49.52 53.27,49.59 53.3,49.65 53.33,49.72 53.36,49.79 53.38,49.86 53.4,49.93 53.43,50 53.45,50.07 53.47,50.15 53.49,50.22 53.5,50.29 53.52,50.37 53.53,50.45 53.55,50.52 53.56,50.6 53.57,50.68 53.57,50.76 53.58,50.84 53.59,50.92 53.59,51 53.59,51.08 53.59,51.17 53.59,51.25 53.58,51.33 53.58,51.42 53.57,51.5 53.56,51.58 53.55,51.67 53.54,51.75 53.52,51.84 53.5,51.93 53.48,52.01 53.46,52.1 53.44,52.18 53.42,52.27 53.39,52.36 53.36,52.44 53.33,52.53 53.3,52.61 53.26,52.7 53.23,52.79 53.19,52.87 53.15,52.96 53.1,53.04 53.06,53.12 53.01,53.21 52.96,53.29 52.91,53.37 52.86,53.46 52.81,53.54 52.75,53.62 52.69,53.7 52.63,53.78 52.56,53.86 52.5,53.94 52.43,54.01 52.36,54.09 52.29,54.17 52.22,54.24 52.14,54.31 52.06,54.38 51.98,54.46 51.9,54.53 51.82,54.59 51.73,54.66 51.65,54.73 51.56,54.79 51.47,54.85 51.37,54.91 51.28,54.97 51.18,55.03 51.08,55.09 50.98,55.14 50.88,55.19 50.77,55.24 50.67,55.29 50.56,55.34 50.45,55.39 50.34,55.43 50.23,55.47 50.12,55.51 50,55.55 49.88,55.58 49.76,55.61 49.65,55.64 49.52,55.67 49.4,55.69 49.28,55.72 49.15,55.74 49.03,55.76 48.9,55.77 48.77,55.78 48.64,55.79 48.51,55.8 48.38,55.81 48.25,55.81 48.11,55.81 47.98,55.8 47.84,55.8 47.71,55.79 47.57,55.77 47.44,55.76 47.3,55.74 47.16,55.72 47.02,55.7 46.88,55.67 46.75,55.64 46.61,55.6 46.47,55.57 46.33,55.53 46.19,55.48 46.05,55.44 45.91,55.39 45.77,55.34 45.63,55.28 45.49,55.22 45.36,55.16 45.22,55.09 45.08,55.02 44.94,54.95 44.81,54.88 44.67,54.8 44.54,54.71 44.41,54.63 44.27,54.54 44.14,54.45 44.01,54.35 43.88,54.25 43.76,54.15 43.63,54.04 43.5,53.93 43.38,53.82 43.26,53.71 43.14,53.59 43.02,53.46 42.91,53.34 42.79,53.21 42.68,53.08 42.57,52.94 42.46,52.8 42.35,52.66 42.25,52.52 42.15,52.37 42.05,52.22 41.95,52.07 41.86,51.91 41.77,51.75 41.68,51.59 41.6,51.42 41.51,51.25 41.43,51.08 41.36,50.91 41.29,50.73 41.22,50.55 41.15,50.37 41.09,50.19 41.03,50 40.97,49.81 40.92,49.62 40.87,49.43 40.83,49.23 40.79,49.03 40.75,48.83 40.72,48.63 40.69,48.42 40.66,48.22 40.64,48.01 40.63,47.8 40.61,47.59 40.61,47.38 40.6,47.16 40.6,46.95 40.61,46.73 40.62,46.51 40.64,46.29 40.66,46.07 40.68,45.85 40.71,45.63 40.75,45.41 40.78,45.18 40.83,44.96 40.88,44.73 40.93,44.51 40.99,44.28 41.06,44.06 41.13,43.83 41.2,43.61 41.28,43.38 41.37,43.16 41.46,42.93 41.55,42.71 41.65,42.48 41.76,42.26 41.87,42.04 41.99,41.82 42.11,41.6 42.24,41.38 42.37,41.16 42.51,40.95 42.66,40.73 42.81,40.52 42.96,40.31 43.12,40.1 43.29,39.9 43.46,39.69 43.64,39.49 43.82,39.29 44,39.09 44.2,38.9 44.39,38.71 44.6,38.52 44.81,38.34 45.02,38.15 45.24,37.97 45.46,37.8 45.69,37.63 45.93,37.46 46.16,37.3 46.41,37.14 46.66,36.98 46.91,36.83 47.17,36.68 47.43,36.54 47.7,36.4 47.97,36.27 48.25,36.14 48.53,36.02 48.82,35.9 49.11,35.79 49.4,35.68 49.7,35.58 50,35.48 50.31,35.39 50.62,35.31 50.93,35.23 51.25,35.16 51.57,35.09 51.89,35.03 52.22,34.98 52.55,34.93 52.88,34.89 53.22,34.86 53.56,34.83 53.9,34.81 54.24,34.8 54.59,34.8 54.94,34.8 55.29,34.81 55.64,34.83 56,34.85 56.36,34.88 56.71,34.92 57.07,34.97 57.43,35.03 57.8,35.09 58.16,35.16 58.52,35.24 58.89,35.33 59.25,35.42 59.61,35.53 59.98,35.64 60.34,35.76 60.71,35.89 61.07,36.03 61.44,36.18 61.8,36.33 62.16,36.5 62.52,36.67 62.88,36.85 63.24,37.04 63.59,37.24 63.94,37.44 64.3,37.66 64.65,37.88 64.99,38.12 65.34,38.36 65.68,38.61 66.01,38.87 66.35,39.14 66.68,39.42 67,39.7 67.33,40 67.65,40.3 67.96,40.61 68.27,40.93 68.57,41.26 68.87,41.6 69.17,41.94 69.46,42.3 69.74,42.66 70.02,43.03 70.29,43.41 70.55,43.79 70.81,44.19 71.07,44.59 71.31,45 71.55,45.42 71.78,45.85 72,46.28 72.22,46.72 72.42,47.17 72.62,47.62 72.81,48.08 73,48.55 73.17,49.03 73.33,49.51 73.49,50 73.64,50.5 73.77,51 73.9,51.5 74.02,52.02 74.12,52.54 74.22,53.06 74.3,53.59 74.38,54.12 74.44,54.66 74.5,55.21 74.54,55.76 74.57,56.31 74.59,56.87 74.6,57.43 74.6,57.99 74.58,58.56 74.55,59.13 74.51,59.71 74.46,60.28 74.4,60.86 74.32,61.44 74.23,62.03 74.13,62.61 74.01,63.2 73.88,63.79 73.74,64.38 73.58,64.97 73.42,65.56 73.23,66.15 73.04,66.74 72.83,67.33 72.6,67.92 72.37,68.5 72.12,69.09 71.85,69.67 71.57,70.26 71.28,70.84 70.97,71.42 70.65,71.99 70.32,72.56 69.97,73.13 69.6,73.7 69.23,74.26 68.83,74.81 68.43,75.36 68.01,75.91 67.57,76.45 67.13,76.99 66.66,77.51 66.19,78.04 65.7,78.55 65.19,79.06 64.67,79.56 64.14,80.05 63.6,80.54 63.04,81.02 62.47,81.48 61.88,81.94 61.28,82.39 60.67,82.83 60.04,83.26 59.4,83.68 58.75,84.08 58.09,84.48 57.41,84.87 56.72,85.24 56.02,85.6 55.31,85.95 54.58,86.28 53.85,86.61 53.1,86.91 52.34,87.21 51.57,87.49 50.79,87.76 50,88.01 49.2,88.24 48.39,88.46 47.57,88.67 46.74,88.86 45.9,89.03 45.05,89.19 44.19,89.33 43.33,89.45 42.45,89.55 41.57,89.64 40.69,89.71 39.79,89.76 38.89,89.79 37.98,89.8 37.07,89.8 36.15,89.77 35.23,89.73 34.3,89.66 33.36,89.58 32.42,89.47 31.48,89.35 30.54,89.2 29.59,89.04 28.64,88.85 27.69,88.64 26.74,88.41 25.89,87.99 25.1,87.48 24.32,86.95 23.55,86.41 22.79,85.84 22.05,85.27 21.32,84.67 20.6,84.06 19.89,83.44 19.2,82.8 18.52,82.15 17.85,81.48 17.2,80.8 16.56,80.11 15.94,79.4 15.33,78.68 14.73,77.95 14.16,77.21 13.59,76.45 13.05,75.68 12.52,74.9 12.01,74.11 11.51,73.31 11.03,72.5 10.57,71.68 10.12,70.85 9.69,70.01 9.28,69.16 8.89,68.3 8.52,67.44 8.16,66.57 7.82,65.69 7.5,64.8 7.2,63.91 6.92,63.01 6.66,62.1 6.41,61.19 6.19,60.28 5.98,59.36 5.8,58.43 5.63,57.5 5.48,56.57 5.35,55.64 5.25,54.7 5.16,53.77 5.09,52.83 5.04,51.88 5.01,50.94 5,50 5.01,49.06 5.04,48.12 5.09,47.17 5.16,46.23 5.25,45.3 5.35,44.36 5.48,43.43 5.63,42.5 5.8,41.57 5.98,40.64 6.19,39.72 6.41,38.81 6.66,37.9 6.92,36.99 7.2,36.09 7.5,35.2 7.82,34.31 8.16,33.43 8.52,32.56 8.89,31.7 9.28,30.84 9.69,29.99 10.12,29.15 10.57,28.32 11.03,27.5 11.51,26.69 12.01,25.89 12.52,25.1 13.05,24.32 13.59,23.55 14.16,22.79 14.73,22.05 15.33,21.32 15.94,20.6 16.56,19.89 17.2,19.2 17.85,18.52 18.52,17.85 19.2,17.2 19.89,16.56 20.6,15.94 21.32,15.33 22.05,14.73 22.79,14.16 23.55,13.59 24.32,13.05 25.1,12.52 25.89,12.01 26.69,11.51 27.5,11.03 28.32,10.57 29.15,10.12 29.99,9.69 30.84,9.28 31.7,8.89 32.56,8.52 33.43,8.16 34.31,7.82 35.2,7.5 36.09,7.2 36.99,6.92 37.9,6.66 38.81,6.41 39.72,6.19 40.64,5.98 41.57,5.8 42.5,5.63 43.43,5.48 44.36,5.35 45.3,5.25 46.23,5.16 47.17,5.09 48.12,5.04 49.06,5.01 50,5 50.94,5.01 51.88,5.04 52.83,5.09 53.77,5.16 54.7,5.25 55.64,5.35 56.57,5.48 57.5,5.63 58.43,5.8 59.36,5.98 60.28,6.19 61.19,6.41 62.1,6.66 63.01,6.92 63.91,7.2 64.8,7.5 65.69,7.82 66.57,8.16 67.44,8.52 68.3,8.89 69.16,9.28 70.01,9.69 70.85,10.12 71.68,10.57 72.5,11.03 73.31,11.51 74.11,12.01 74.9,12.52 75.68,13.05 76.45,13.59 77.21,14.16 77.95,14.73 78.68,15.33 79.4,15.94 80.11,16.56 80.8,17.2 81.48,17.85 82.15,18.52 82.8,19.2 83.44,19.89 84.06,20.6 84.67,21.32 85.27,22.05 85.84,22.79 86.41,23.55 86.95,24.32 87.48,25.1 87.99,25.89 88.49,26.69 88.97,27.5 89.43,28.32 89.88,29.15 90.31,29.99 90.72,30.84 91.11,31.7 91.48,32.56 91.84,33.43 92.18,34.31 92.5,35.2 92.8,36.09 93.08,36.99 93.34,37.9 93.59,38.81 93.81,39.72 94.02,40.64 94.2,41.57 94.37,42.5 94.52,43.43 94.65,44.36 94.75,45.3 94.84,46.23 94.91,47.17 94.96,48.12 94.99,49.06 95,50 94.99,50.94 94.96,51.88 94.91,52.83 94.84,53.77 94.75,54.7 94.65,55.64 94.52,56.57 94.37,57.5 94.2,58.43 94.02,59.36 93.81,60.28 93.59,61.19 93.34,62.1 93.08,63.01 92.8,63.91 92.5,64.8 92.18,65.69 91.84,66.57 91.48,67.44 91.11,68.3 90.72,69.16 90.31,70.01 89.88,70.85 89.43,71.68 88.97,72.5 88.49,73.31 87.99,74.11 87.48,74.9 86.95,75.68 86.41,76.45 85.84,77.21 85.27,77.95 84.67,78.68 84.06,79.4 83.44,80.11 82.8,80.8 82.15,81.48 81.48,82.15 80.8,82.8 80.11,83.44 79.4,84.06 78.68,84.67 77.95,85.27 77.21,85.84 76.45,86.41 75.68,86.95 74.9,87.48 74.11,87.99 73.31,88.49 72.5,88.97 71.68,89.43 70.85,89.88 70.01,90.31 69.16,90.72 68.3,91.11 67.44,91.48 66.57,91.84 65.69,92.18 64.8,92.5 63.91,92.8 63.01,93.08 62.1,93.34 61.19,93.59 60.28,93.81 59.36,94.02 58.43,94.2 57.5,94.37 56.57,94.52 55.64,94.65 54.7,94.75 53.77,94.84 52.83,94.91 51.88,94.96 50.94,94.99 50,95 49.06,94.99 48.12,94.96 47.17,94.91 46.23,94.84 45.3,94.75 44.36,94.65 43.43,94.52 42.5,94.37 41.57,94.2 40.64,94.02 39.72,93.81 38.81,93.59 37.9,93.34 36.99,93.08 36.09,92.8 35.2,92.5 34.31,92.18 33.43,91.84 32.56,91.48 31.7,91.11 30.84,90.72 29.99,90.31 29.15,89.88 28.32,89.43 27.5,88.97 26.69,88.49 25.89,87.99';

  // Figure-capture mode (?fig=1): hide a viewer's own control toolbars so headless
  // screenshots become clean static plates for the print book. Only when explicitly asked.
  if (new URLSearchParams(location.search).get('fig') === '1') {
    const s = document.createElement('style');
    s.textContent = '.hint,.controls,.toolbar{display:none!important}';
    (document.head || document.documentElement).appendChild(s);
  }

  // Shared-identity widget (reads the .recursive.eco session cookie; L1 of the
  // integration ladder). Loaded once; renders as <recursive-auth> in the bar.
  if (!document.querySelector('script[data-recursive-auth]')) {
    const s = document.createElement('script');
    s.src = PFX + 'auth-widget.js?v=2';
    s.dataset.recursiveAuth = '1';
    document.head.appendChild(s);
  }

  // ---- the site map (content) ----
  // Grammar paths as the viewers take them in ?src= (relative to /viewers/).
  const WORDS = '../grammars/words-deck/grammar.json';
  const SOURCES = '../grammars/sources-of-alignment/grammar.json';
  const IDEAS = '../grammars/ideas-of-alignment/grammar.json';
  const INSTITUTIONS = '../grammars/institutions-of-alignment/grammar.json';
  // [href, label, external?] — each pill links to its hub; the dropdown lists the rest.
  const HOME_MENU = [
    [PFX,                         'Home'],
    [PFX + 'pages/about.html',    'About &amp; method'],
  ];
  const WORDS_MENU = [
    [PFX + 'glossary/',                                                     'The glossary'],
    [PFX + 'viewers/cards.html?src=' + WORDS,                               'Words as cards'],
    [PFX + 'viewers/caster-studio.html?src=../grammars/words-deck/grammar.json&spread=before-you-delegate', 'Cast: Before you delegate'],
    [PFX + 'viewers/caster-studio.html?src=../grammars/words-deck/grammar.json&spread=the-fork',            'Cast: The fork'],
    [PFX + 'viewers/caster-studio.html?src=../grammars/words-deck/grammar.json&spread=what-held',           'Cast: What held'],
    [PFX + 'viewers/caster-studio.html?src=../grammars/words-deck/grammar.json&spread=single',              'A single draw'],
    [PFX + 'viewers/explorer.html?src=' + WORDS,                            'Explore the words'],
  ];
  const SOURCES_MENU = [
    [PFX + 'map/',                                                          'All sources'],
    [PFX + 'viewers/cards.html?src=' + SOURCES + '&item=suit-podcasts#groupby=suit', 'Podcasts'],
    [PFX + 'viewers/cards.html?src=' + SOURCES + '&item=suit-papers#groupby=suit',   'Papers &amp; books'],
    [PFX + 'viewers/cards.html?src=' + SOURCES + '&item=suit-people#groupby=suit',   'People'],
    [PFX + 'pages/institutions.html',                                       'Institutions'],
    [PFX + 'viewers/tree-viewer.html?src=' + SOURCES,                       'Tree of sources'],
  ];
  const IDEAS_MENU = [
    [PFX + 'viewers/cards.html?src=' + IDEAS,                               'Ideas as cards'],
    [PFX + 'viewers/tree-viewer.html?src=' + IDEAS,                         'Ideas by lane'],
    [PFX + 'viewers/explorer.html?src=' + IDEAS,                            'Explore the ideas'],
    [PFX + 'viewers/caster-studio.html?src=../grammars/ideas-of-alignment/grammar.json&spread=single', 'Draw one idea'],
  ];
  const PLAY_MENU = [
    [PFX + 'game/as-if.html',          'As-If'],
    [PFX + 'game/potato-others.html',  'Hot Potato'],
    [PFX + 'game/potato.html',         'Hot Potato, alone'],
    [PFX + 'game/spread.html',         'The Walk'],
    [PFX + 'game/lines.html',          'Changing Lines'],
    [PFX + 'pages/play.html',          'All games →'],
  ];
  // [key, label, href, cssClass, external?] — tarot's TOOLS slot. Institutions sits where tarot
  // has Shop: pages/institutions.html (tarot's shop.html layout), where each card links out to an
  // institution's own site. It reads the INSTITUTIONS grammar; the cards view is linked from it.
  const TOOLS = [
    ['institutions', 'Institutions', PFX + 'pages/institutions.html', 't-shop'],
    ['github', 'GitHub ↗',  'https://github.com/PlayfulProcess/recursive-learning', 't-github', true],
  ];
  const KEYS = ['home', 'words', 'sources', 'ideas', 'play', 'institutions'];

  function autoActive() {
    const p = location.pathname, q = decodeURIComponent(location.search);
    if (p.startsWith('/glossary/')) return 'words';
    if (p.startsWith('/map/')) return 'sources';
    if (p.startsWith('/game/') || /\/pages\/play\.html$/.test(p)) return 'play';
    if (/\/viewers\//.test(p)) {
      if (q.includes('institutions-of-alignment')) return 'institutions';
      if (q.includes('sources-of-alignment')) return 'sources';
      if (q.includes('ideas-of-alignment')) return 'ideas';
      return 'words';   // the Words deck is every viewer's default, and the caster casts it
    }
    return 'home';
  }

  class SiteHeader extends HTMLElement {
    connectedCallback() {
      // Embedded (iframed into a course/book): render no header at all.
      if (new URLSearchParams(location.search).get('embed') === '1') { this.style.display = 'none'; return; }
      // Museum/Editorial webfonts — injected once into the document head so every page
      // (light DOM and this shadow DOM) renders in Cormorant / Fraunces / Inter.
      if (!document.getElementById('rt-fonts')) {
        const fl = document.createElement('link'); fl.id = 'rt-fonts'; fl.rel = 'stylesheet';
        fl.href = 'https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,400&family=Inter:wght@400;500;600&display=swap';
        document.head.appendChild(fl);
      }
      // The shared SVG icon library — one source, available as <rt-icon name="…"> on every page.
      if (!document.getElementById('rt-icons-lib')) {
        const si = document.createElement('script'); si.id = 'rt-icons-lib'; si.src = PFX + 'icons.js';
        document.head.appendChild(si);
      }
      // On a viewer page the grammar decides; elsewhere a known `active` wins.
      const attr = this.getAttribute('active');
      const active = (/\/viewers\//.test(location.pathname) || !KEYS.includes(attr)) ? autoActive() : attr;
      const root = this.attachShadow({ mode: 'open' });
      const tab = ([key, label, href, cls, ext]) =>
        `<a class="tab ${cls || ''}${key === active ? ' active' : ''}" href="${href}"${ext ? ' target="_blank" rel="noopener"' : ''}>${label}</a>`;
      // Dropdown menu item (used inside the Views menu) — highlights the current page.
      const menuItem = ([key, label, href, cls, ext]) =>
        `<a class="${key === active ? 'on' : ''}" href="${href}"${ext ? ' target="_blank" rel="noopener"' : ''}>${label}</a>`;
      root.innerHTML = `
        <style>
          :host{ display:block; position:sticky; top:0; z-index:50;
                 background:#fbf9f3; padding:0; margin:0; border:0; font-size:14px;
                 transition:transform .25s ease; will-change:transform; }
          @media (prefers-reduced-motion: reduce){ :host{ transition:none; } .tab, .dd-menu a, .brand{ transition:none !important; } }
          .bar{
            display:flex; align-items:center; gap:14px; flex-wrap:wrap;
            padding:13px 20px; background:#fbf9f3;
            border-bottom:1px solid #d8d2c6;
            font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif;
          }
          .brand{ display:flex; flex-direction:row; align-items:center; gap:10px; margin-right:4px; }
          .brand-logo, .brand-name{ display:inline-flex; align-items:center; text-decoration:none; }
          .brand-logo{ border-radius:50%; }
          .brand-name .name{ font-family:"Fraunces",Georgia,serif; font-size:19px; font-weight:600; letter-spacing:.2px; color:#221f1a; white-space:nowrap; }
          .brand-name{ flex-direction:column; align-items:flex-start; line-height:1.15; }
          .brand-name .sub{ font-size:10px; letter-spacing:.14em; text-transform:uppercase; color:#6b6457; margin-top:3px; white-space:nowrap; }
          @media (max-width:380px){ .brand-name .name{ font-size:16px; } }
          .brand-name:hover .name{ color:#000; }
          .brand-name .name .gold{ color:#177d56; }
          .brand svg{ flex-shrink:0; }
          .spacer{ flex:1 1 auto; }
          nav{ display:flex; gap:4px; flex-wrap:wrap; align-items:center; }
          .cap{ font-size:9.5px; text-transform:uppercase; letter-spacing:.16em;
                color:#8a8273; margin:0 2px 0 6px; user-select:none; }
          .cap.card-cap{ color:#177d56; }
          .cap.gram-cap{ color:#6b6457; }
          .sep{ width:1px; height:20px; background:#d8d2c6; margin:0 6px; }
          /* one restrained editorial language for every nav item — text links,
             gold on hover, a hairline underline when active. No pills, no per-tool colour. */
          .tab{
            color:#6b6457; text-decoration:none; font-size:13px; font-weight:500;
            padding:7px 9px; white-space:nowrap; transition:color .15s;
            border:0; border-bottom:1.5px solid transparent; border-radius:0;
          }
          .tab:hover{ color:#177d56; }
          .tab.active{ color:#177d56; font-weight:600; border-bottom-color:#177d56; }
          .t-caster,.t-course,.t-shop,.t-github,.t-contribute{ color:#6b6457; border:0; border-bottom:1.5px solid transparent; border-radius:0; }
          .t-caster:hover,.t-course:hover,.t-shop:hover,.t-github:hover,.t-contribute:hover{ color:#177d56; background:transparent; }
          /* dropdowns */
          .dd{ position:relative; }
          .dd-btn{ background:none; font-family:inherit; cursor:pointer; }
          .dd-btn::after{ content:""; display:inline-block; width:5px; height:5px; margin-left:7px;
            border-right:1.4px solid currentColor; border-bottom:1.4px solid currentColor;
            transform:rotate(45deg) translateY(-2px); opacity:.5; }
          .dd-menu{ position:absolute; top:calc(100% + 8px); right:0; min-width:220px;
            max-width:min(300px,calc(100vw - 16px)); background:#ffffff; border:1px solid #d8d2c6;
            border-radius:8px; padding:7px; box-shadow:0 16px 44px -18px rgba(60,45,20,.45); display:none; z-index:60;
            overflow-y:auto; }
          /* Horizontal/vertical clamping is computed in JS (positionMenu, below), not a fixed
             breakpoint: a left-side trigger (Home, Views) overflows the left edge whenever the
             panel is wider than the space to its left, which happens at tablet widths (~760–950px)
             just as much as on phones — a single max-width media query missed that range entirely. */
          /* Open state is .open (JS-managed, incl. desktop hover) or keyboard focus — never
             raw :hover: the gap under the trigger made :hover a dead zone (the old ::before
             bridge couldn't cover it — overflow-y:auto clips pseudo-content above the panel). */
          .dd:focus-within .dd-menu, .dd.open .dd-menu{ display:block; }
          .dd.open .dd-btn::after{ transform:rotate(225deg) translateY(2px); opacity:.85; }
          .dd-menu a{ display:block; color:#4a4439; text-decoration:none; font-size:13px;
            padding:8px 10px; border-radius:7px; white-space:nowrap; }
          .dd-menu a:hover{ background:#f1ece1; color:#221f1a; }
          .dd-menu a[href*="recursive.eco"]{ color:#9333ea; }
          .dd-menu a.on{ color:#221f1a; background:#f1ece1; font-weight:600; }
          .dd-cap{ display:block; font-family:Inter,sans-serif; font-size:9px; text-transform:uppercase; letter-spacing:.16em;
            color:#8a8273; padding:8px 10px 3px; user-select:none; }
          .dd-cap:first-child{ padding-top:2px; }
          @media (max-width:680px){
            .brand .sub{ display:none; }
            .tab{ padding:5px 8px; font-size:12px; }
            .cap{ display:none; } .sep{ display:none; }
          }
        </style>
        <div class="bar">
          <span class="brand">
            <a class="brand-logo" href="https://recursive.eco" target="_blank" rel="noopener" title="Part of recursive.eco — the parent project" aria-label="recursive.eco — the parent project">
              <span style="display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;background:#fff;border-radius:50%;flex-shrink:0;color:#9333ea"><svg viewBox="0 0 100 100" width="28" height="28" aria-hidden="true" focusable="false" style="display:block"><path d="${SPIRAL_D}" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/></svg></span>
            </a>
            <a class="brand-name" href="${PFX}" title="Recursive Eco-Improvement, home">
              <span class="name">Recursive <span class="gold">Eco-Improvement</span></span>
              <span class="sub">explorations in adaptive alignment</span>
            </a>
          </span>
          <span class="spacer"></span>
          <nav aria-label="Site sections">
            <span class="dd">
              <a class="tab dd-btn${active === 'home' ? ' active' : ''}" href="${PFX}" aria-haspopup="true" aria-expanded="false" aria-label="Home menu">Home</a>
              <span class="dd-menu">
                ${HOME_MENU.map(([href, label]) => `<a href="${href}">${label}</a>`).join('')}
              </span>
            </span>
            <span class="dd">
              <a class="tab dd-btn${active === 'words' ? ' active' : ''}" href="${PFX}glossary/" aria-haspopup="true" aria-expanded="false" aria-label="Words menu">Words</a>
              <span class="dd-menu">
                ${WORDS_MENU.map(([href, label]) => `<a href="${href}">${label}</a>`).join('')}
              </span>
            </span>
            <span class="dd">
              <a class="tab dd-btn${active === 'sources' ? ' active' : ''}" href="${PFX}map/" aria-haspopup="true" aria-expanded="false" aria-label="Sources menu">Sources</a>
              <span class="dd-menu">
                ${SOURCES_MENU.map(([href, label]) => `<a href="${href}">${label}</a>`).join('')}
              </span>
            </span>
            <span class="dd">
              <a class="tab dd-btn${active === 'ideas' ? ' active' : ''}" href="${PFX}viewers/tree-viewer.html?src=${IDEAS}" aria-haspopup="true" aria-expanded="false" aria-label="Ideas menu">Ideas</a>
              <span class="dd-menu">
                ${IDEAS_MENU.map(([href, label]) => `<a href="${href}">${label}</a>`).join('')}
              </span>
            </span>
            <span class="dd">
              <a class="tab t-caster dd-btn${active === 'play' ? ' active' : ''}" href="${PFX}pages/play.html" aria-haspopup="true" aria-expanded="false" aria-label="Games menu">Games</a>
              <span class="dd-menu">
                ${PLAY_MENU.map(([href, label, ext]) => `<a href="${href}"${ext ? ' target="_blank" rel="noopener"' : ''}>${label}</a>`).join('')}
              </span>
            </span>
            ${TOOLS.map(tab).join('')}
            <recursive-auth></recursive-auth>
          </nav>
        </div>`;

      // Dropdowns: keyboard + ARIA on top of the hover/focus-within CSS. Panels are
      // right-anchored by default (.dd-menu right:0), which reads fine when the trigger
      // sits near the right of the nav — but a left-side trigger (Home, Views) has less
      // room to its left than the panel needs, at tablet widths as much as on phones.
      // positionMenu() measures the real trigger + panel on every open and clamps
      // left/top so the panel always stays fully on-screen, at any width.
      const DD_EDGE = 8; // min gap kept between a panel and the viewport edge
      const positionMenu = dd => {
        const menu = dd.querySelector('.dd-menu');
        if (!menu) return;
        const ddRect = dd.getBoundingClientRect();
        const menuRect = menu.getBoundingClientRect();
        const vw = window.innerWidth, vh = window.innerHeight;
        // Natural position mirrors the CSS default (panel's right edge flush with the
        // trigger's right edge), then clamp so neither edge crosses the viewport.
        let left = ddRect.right - menuRect.width;
        left = Math.max(DD_EDGE, Math.min(left, vw - menuRect.width - DD_EDGE));
        menu.style.left = (left - ddRect.left) + 'px';
        menu.style.right = 'auto';
        // Vertical: cap height + let the panel scroll internally rather than running
        // off the bottom of short viewports (e.g. a phone in landscape).
        const top = ddRect.bottom + 8;
        menu.style.maxHeight = Math.max(120, vh - top - DD_EDGE) + 'px';
      };
      root.querySelectorAll('.dd').forEach(dd => {
        const btn = dd.querySelector('.dd-btn');
        const set = open => btn && btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        const closeAll = except => root.querySelectorAll('.dd.open').forEach(o => {
          if (o === except) return;
          o.classList.remove('open'); const b = o.querySelector('.dd-btn'); if (b) b.setAttribute('aria-expanded', 'false');
        });
        let closeTimer = null;
        const open = () => { clearTimeout(closeTimer); closeAll(dd); dd.classList.add('open'); set(true); positionMenu(dd); };
        const close = () => { clearTimeout(closeTimer); dd.classList.remove('open'); set(false); };
        // Desktop hover: JS-managed with a grace period on close. Pure CSS :hover
        // closed the panel the instant the cursor crossed the gap under the trigger
        // (a dead zone no bridge can cover once the panel scrolls) — and a delay
        // also survives the horizontal shift positionMenu applies near screen edges.
        dd.addEventListener('mouseenter', () => { if (window.matchMedia('(hover: hover)').matches) open(); });
        dd.addEventListener('mouseleave', () => {
          if (!window.matchMedia('(hover: hover)').matches) return;
          clearTimeout(closeTimer); closeTimer = setTimeout(close, 260);
        });
        dd.addEventListener('focusin', () => { set(true); positionMenu(dd); });
        dd.addEventListener('focusout', () => { if (!dd.matches(':focus-within')) set(false); });
        dd.addEventListener('keydown', e => {
          if (e.key === 'Escape') { close(); btn && btn.focus(); }
          // Enter/Space opens the menu when the trigger has no own link to follow
          if ((e.key === 'Enter' || e.key === ' ') && e.target === btn && !btn.getAttribute('href')) {
            const first = dd.querySelector('.dd-menu a'); if (first) { e.preventDefault(); set(true); positionMenu(dd); first.focus(); }
          }
        });
        // Touch / no-hover devices: tap the tab to toggle its menu (hover never fires).
        // Desktop (hover-capable) keeps hover-to-open + click-to-follow-link untouched.
        btn.addEventListener('click', e => {
          if (window.matchMedia('(hover: hover)').matches) return;
          e.preventDefault();
          const willOpen = !dd.classList.contains('open');
          closeAll(null);
          if (willOpen) open(); else close();
        });
      });

      // Close any open menu when tapping outside the header (touch).
      document.addEventListener('click', e => {
        if (!e.composedPath().includes(this)) {
          root.querySelectorAll('.dd.open').forEach(o => { o.classList.remove('open'); const b = o.querySelector('.dd-btn'); if (b) b.setAttribute('aria-expanded', 'false'); });
        }
      });

      // Reposition any currently-open menu on resize/orientation-change (e.g. rotating
      // a tablet with a dropdown open) — a fixed breakpoint can't react to this either.
      window.addEventListener('resize', () => {
        root.querySelectorAll('.dd').forEach(dd => {
          const menu = dd.querySelector('.dd-menu');
          if (menu && getComputedStyle(menu).display !== 'none') positionMenu(dd);
        });
      });

      // Auto-hide on scroll down, reveal on scroll up — but never while the nav has keyboard focus.
      let lastY = window.scrollY || 0, host = this;
      window.addEventListener('scroll', () => {
        const y = window.scrollY || 0;
        const hide = y > 90 && y > lastY + 4 && !host.matches(':focus-within');
        host.style.transform = hide ? 'translateY(-100%)' : 'translateY(0)';
        lastY = y;
      }, { passive: true });
    }
  }
  customElements.define('site-header', SiteHeader);
})();
