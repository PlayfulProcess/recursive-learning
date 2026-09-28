/* A takeover scenario, in his voice.
   The official video of Making Sense #494 plays Ryan Greenblatt's scenario; the
   drawing beside it follows his words one beat at a time. Beats come from
   beats.json (absolute seconds in the video). The video is never hidden, muted
   or covered: it starts large, sits in a corner (never below 356 x 200 CSS px)
   while the drawing takes the stage, and grows back for the end. */
(function () {
'use strict';

const LOGO = 'M50.5 50L50.5 50.01 50.51,50.02 50.51,50.03 50.51,50.04 50.51,50.05 50.52,50.07 50.52,50.08 50.52,50.09 50.52,50.1 50.52,50.11 50.52,50.12 50.52,50.13 50.52,50.15 50.52,50.16 50.52,50.17 50.52,50.18 50.52,50.19 50.52,50.21 50.52,50.22 50.52,50.23 50.52,50.24 50.52,50.26 50.51,50.27 50.51,50.28 50.51,50.29 50.51,50.31 50.5,50.32 50.5,50.33 50.49,50.34 50.49,50.36 50.49,50.37 50.48,50.38 50.48,50.39 50.47,50.41 50.47,50.42 50.46,50.43 50.45,50.44 50.45,50.46 50.44,50.47 50.43,50.48 50.43,50.49 50.42,50.5 50.41,50.52 50.4,50.53 50.39,50.54 50.38,50.55 50.37,50.56 50.36,50.57 50.35,50.59 50.34,50.6 50.33,50.61 50.32,50.62 50.31,50.63 50.3,50.64 50.29,50.65 50.28,50.66 50.27,50.67 50.25,50.68 50.24,50.69 50.23,50.7 50.21,50.71 50.2,50.72 50.19,50.73 50.17,50.73 50.16,50.74 50.14,50.75 50.13,50.76 50.11,50.77 50.1,50.77 50.08,50.78 50.07,50.79 50.05,50.79 50.03,50.8 50.02,50.8 50,50.81 49.98,50.81 49.97,50.82 49.95,50.82 49.93,50.83 49.91,50.83 49.89,50.83 49.88,50.84 49.86,50.84 49.84,50.84 49.82,50.84 49.8,50.85 49.78,50.85 49.76,50.85 49.74,50.85 49.72,50.85 49.71,50.85 49.69,50.85 49.67,50.84 49.65,50.84 49.63,50.84 49.61,50.84 49.59,50.83 49.57,50.83 49.55,50.83 49.53,50.82 49.5,50.82 49.48,50.81 49.46,50.81 49.44,50.8 49.42,50.79 49.4,50.79 49.38,50.78 49.36,50.77 49.34,50.76 49.32,50.75 49.3,50.74 49.28,50.73 49.26,50.72 49.24,50.71 49.22,50.7 49.2,50.69 49.18,50.68 49.16,50.66 49.15,50.65 49.13,50.63 49.11,50.62 49.09,50.61 49.07,50.59 49.05,50.57 49.03,50.56 49.02,50.54 49,50.52 48.98,50.51 48.96,50.49 48.95,50.47 48.93,50.45 48.92,50.43 48.9,50.41 48.88,50.39 48.87,50.37 48.85,50.35 48.84,50.32 48.83,50.3 48.81,50.28 48.8,50.26 48.79,50.23 48.77,50.21 48.76,50.18 48.75,50.16 48.74,50.13 48.73,50.11 48.72,50.08 48.71,50.05 48.7,50.03 48.69,50 48.68,49.97 48.68,49.94 48.67,49.92 48.66,49.89 48.66,49.86 48.65,49.83 48.65,49.8 48.64,49.77 48.64,49.74 48.63,49.71 48.63,49.68 48.63,49.65 48.63,49.62 48.63,49.59 48.63,49.55 48.63,49.52 48.63,49.49 48.63,49.46 48.64,49.43 48.64,49.39 48.64,49.36 48.65,49.33 48.66,49.3 48.66,49.26 48.67,49.23 48.68,49.2 48.69,49.17 48.7,49.13 48.71,49.1 48.72,49.07 48.73,49.03 48.74,49 48.75,48.97 48.77,48.94 48.78,48.9 48.8,48.87 48.81,48.84 48.83,48.81 48.85,48.77 48.87,48.74 48.89,48.71 48.91,48.68 48.93,48.65 48.95,48.62 48.97,48.59 49,48.56 49.02,48.53 49.05,48.5 49.07,48.47 49.1,48.44 49.13,48.41 49.15,48.38 49.18,48.35 49.21,48.33 49.24,48.3 49.27,48.27 49.31,48.25 49.34,48.22 49.37,48.19 49.41,48.17 49.44,48.15 49.48,48.12 49.51,48.1 49.55,48.08 49.59,48.06 49.63,48.04 49.66,48.02 49.7,48 49.74,47.98 49.79,47.96 49.83,47.94 49.87,47.93 49.91,47.91 49.96,47.9 50,47.88 50.04,47.87 50.09,47.86 50.14,47.85 50.18,47.83 50.23,47.82 50.28,47.82 50.32,47.81 50.37,47.8 50.42,47.8 50.47,47.79 50.52,47.79 50.57,47.78 50.62,47.78 50.67,47.78 50.72,47.78 50.77,47.78 50.82,47.79 50.88,47.79 50.93,47.79 50.98,47.8 51.03,47.81 51.08,47.82 51.14,47.82 51.19,47.83 51.24,47.85 51.3,47.86 51.35,47.87 51.4,47.89 51.46,47.91 51.51,47.92 51.56,47.94 51.62,47.96 51.67,47.98 51.72,48.01 51.77,48.03 51.83,48.05 51.88,48.08 51.93,48.11 51.98,48.14 52.03,48.17 52.09,48.2 52.14,48.23 52.19,48.27 52.24,48.3 52.29,48.34 52.34,48.38 52.39,48.42 52.43,48.46 52.48,48.5 52.53,48.54 52.57,48.58 52.62,48.63 52.67,48.68 52.71,48.72 52.75,48.77 52.8,48.82 52.84,48.88 52.88,48.93 52.92,48.98 52.96,49.04 53,49.09 53.04,49.15 53.07,49.21 53.11,49.27 53.14,49.33 53.18,49.39 53.21,49.46 53.24,49.52 53.27,49.59 53.3,49.65 53.33,49.72 53.36,49.79 53.38,49.86 53.4,49.93 53.43,50 53.45,50.07 53.47,50.15 53.49,50.22 53.5,50.29 53.52,50.37 53.53,50.45 53.55,50.52 53.56,50.6 53.57,50.68 53.57,50.76 53.58,50.84 53.59,50.92 53.59,51 53.59,51.08 53.59,51.17 53.59,51.25 53.58,51.33 53.58,51.42 53.57,51.5 53.56,51.58 53.55,51.67 53.54,51.75 53.52,51.84 53.5,51.93 53.48,52.01 53.46,52.1 53.44,52.18 53.42,52.27 53.39,52.36 53.36,52.44 53.33,52.53 53.3,52.61 53.26,52.7 53.23,52.79 53.19,52.87 53.15,52.96 53.1,53.04 53.06,53.12 53.01,53.21 52.96,53.29 52.91,53.37 52.86,53.46 52.81,53.54 52.75,53.62 52.69,53.7 52.63,53.78 52.56,53.86 52.5,53.94 52.43,54.01 52.36,54.09 52.29,54.17 52.22,54.24 52.14,54.31 52.06,54.38 51.98,54.46 51.9,54.53 51.82,54.59 51.73,54.66 51.65,54.73 51.56,54.79 51.47,54.85 51.37,54.91 51.28,54.97 51.18,55.03 51.08,55.09 50.98,55.14 50.88,55.19 50.77,55.24 50.67,55.29 50.56,55.34 50.45,55.39 50.34,55.43 50.23,55.47 50.12,55.51 50,55.55 49.88,55.58 49.76,55.61 49.65,55.64 49.52,55.67 49.4,55.69 49.28,55.72 49.15,55.74 49.03,55.76 48.9,55.77 48.77,55.78 48.64,55.79 48.51,55.8 48.38,55.81 48.25,55.81 48.11,55.81 47.98,55.8 47.84,55.8 47.71,55.79 47.57,55.77 47.44,55.76 47.3,55.74 47.16,55.72 47.02,55.7 46.88,55.67 46.75,55.64 46.61,55.6 46.47,55.57 46.33,55.53 46.19,55.48 46.05,55.44 45.91,55.39 45.77,55.34 45.63,55.28 45.49,55.22 45.36,55.16 45.22,55.09 45.08,55.02 44.94,54.95 44.81,54.88 44.67,54.8 44.54,54.71 44.41,54.63 44.27,54.54 44.14,54.45 44.01,54.35 43.88,54.25 43.76,54.15 43.63,54.04 43.5,53.93 43.38,53.82 43.26,53.71 43.14,53.59 43.02,53.46 42.91,53.34 42.79,53.21 42.68,53.08 42.57,52.94 42.46,52.8 42.35,52.66 42.25,52.52 42.15,52.37 42.05,52.22 41.95,52.07 41.86,51.91 41.77,51.75 41.68,51.59 41.6,51.42 41.51,51.25 41.43,51.08 41.36,50.91 41.29,50.73 41.22,50.55 41.15,50.37 41.09,50.19 41.03,50 40.97,49.81 40.92,49.62 40.87,49.43 40.83,49.23 40.79,49.03 40.75,48.83 40.72,48.63 40.69,48.42 40.66,48.22 40.64,48.01 40.63,47.8 40.61,47.59 40.61,47.38 40.6,47.16 40.6,46.95 40.61,46.73 40.62,46.51 40.64,46.29 40.66,46.07 40.68,45.85 40.71,45.63 40.75,45.41 40.78,45.18 40.83,44.96 40.88,44.73 40.93,44.51 40.99,44.28 41.06,44.06 41.13,43.83 41.2,43.61 41.28,43.38 41.37,43.16 41.46,42.93 41.55,42.71 41.65,42.48 41.76,42.26 41.87,42.04 41.99,41.82 42.11,41.6 42.24,41.38 42.37,41.16 42.51,40.95 42.66,40.73 42.81,40.52 42.96,40.31 43.12,40.1 43.29,39.9 43.46,39.69 43.64,39.49 43.82,39.29 44,39.09 44.2,38.9 44.39,38.71 44.6,38.52 44.81,38.34 45.02,38.15 45.24,37.97 45.46,37.8 45.69,37.63 45.93,37.46 46.16,37.3 46.41,37.14 46.66,36.98 46.91,36.83 47.17,36.68 47.43,36.54 47.7,36.4 47.97,36.27 48.25,36.14 48.53,36.02 48.82,35.9 49.11,35.79 49.4,35.68 49.7,35.58 50,35.48 50.31,35.39 50.62,35.31 50.93,35.23 51.25,35.16 51.57,35.09 51.89,35.03 52.22,34.98 52.55,34.93 52.88,34.89 53.22,34.86 53.56,34.83 53.9,34.81 54.24,34.8 54.59,34.8 54.94,34.8 55.29,34.81 55.64,34.83 56,34.85 56.36,34.88 56.71,34.92 57.07,34.97 57.43,35.03 57.8,35.09 58.16,35.16 58.52,35.24 58.89,35.33 59.25,35.42 59.61,35.53 59.98,35.64 60.34,35.76 60.71,35.89 61.07,36.03 61.44,36.18 61.8,36.33 62.16,36.5 62.52,36.67 62.88,36.85 63.24,37.04 63.59,37.24 63.94,37.44 64.3,37.66 64.65,37.88 64.99,38.12 65.34,38.36 65.68,38.61 66.01,38.87 66.35,39.14 66.68,39.42 67,39.7 67.33,40 67.65,40.3 67.96,40.61 68.27,40.93 68.57,41.26 68.87,41.6 69.17,41.94 69.46,42.3 69.74,42.66 70.02,43.03 70.29,43.41 70.55,43.79 70.81,44.19 71.07,44.59 71.31,45 71.55,45.42 71.78,45.85 72,46.28 72.22,46.72 72.42,47.17 72.62,47.62 72.81,48.08 73,48.55 73.17,49.03 73.33,49.51 73.49,50 73.64,50.5 73.77,51 73.9,51.5 74.02,52.02 74.12,52.54 74.22,53.06 74.3,53.59 74.38,54.12 74.44,54.66 74.5,55.21 74.54,55.76 74.57,56.31 74.59,56.87 74.6,57.43 74.6,57.99 74.58,58.56 74.55,59.13 74.51,59.71 74.46,60.28 74.4,60.86 74.32,61.44 74.23,62.03 74.13,62.61 74.01,63.2 73.88,63.79 73.74,64.38 73.58,64.97 73.42,65.56 73.23,66.15 73.04,66.74 72.83,67.33 72.6,67.92 72.37,68.5 72.12,69.09 71.85,69.67 71.57,70.26 71.28,70.84 70.97,71.42 70.65,71.99 70.32,72.56 69.97,73.13 69.6,73.7 69.23,74.26 68.83,74.81 68.43,75.36 68.01,75.91 67.57,76.45 67.13,76.99 66.66,77.51 66.19,78.04 65.7,78.55 65.19,79.06 64.67,79.56 64.14,80.05 63.6,80.54 63.04,81.02 62.47,81.48 61.88,81.94 61.28,82.39 60.67,82.83 60.04,83.26 59.4,83.68 58.75,84.08 58.09,84.48 57.41,84.87 56.72,85.24 56.02,85.6 55.31,85.95 54.58,86.28 53.85,86.61 53.1,86.91 52.34,87.21 51.57,87.49 50.79,87.76 50,88.01 49.2,88.24 48.39,88.46 47.57,88.67 46.74,88.86 45.9,89.03 45.05,89.19 44.19,89.33 43.33,89.45 42.45,89.55 41.57,89.64 40.69,89.71 39.79,89.76 38.89,89.79 37.98,89.8 37.07,89.8 36.15,89.77 35.23,89.73 34.3,89.66 33.36,89.58 32.42,89.47 31.48,89.35 30.54,89.2 29.59,89.04 28.64,88.85 27.69,88.64 26.74,88.41 25.89,87.99 25.1,87.48 24.32,86.95 23.55,86.41 22.79,85.84 22.05,85.27 21.32,84.67 20.6,84.06 19.89,83.44 19.2,82.8 18.52,82.15 17.85,81.48 17.2,80.8 16.56,80.11 15.94,79.4 15.33,78.68 14.73,77.95 14.16,77.21 13.59,76.45 13.05,75.68 12.52,74.9 12.01,74.11 11.51,73.31 11.03,72.5 10.57,71.68 10.12,70.85 9.69,70.01 9.28,69.16 8.89,68.3 8.52,67.44 8.16,66.57 7.82,65.69 7.5,64.8 7.2,63.91 6.92,63.01 6.66,62.1 6.41,61.19 6.19,60.28 5.98,59.36 5.8,58.43 5.63,57.5 5.48,56.57 5.35,55.64 5.25,54.7 5.16,53.77 5.09,52.83 5.04,51.88 5.01,50.94 5,50 5.01,49.06 5.04,48.12 5.09,47.17 5.16,46.23 5.25,45.3 5.35,44.36 5.48,43.43 5.63,42.5 5.8,41.57 5.98,40.64 6.19,39.72 6.41,38.81 6.66,37.9 6.92,36.99 7.2,36.09 7.5,35.2 7.82,34.31 8.16,33.43 8.52,32.56 8.89,31.7 9.28,30.84 9.69,29.99 10.12,29.15 10.57,28.32 11.03,27.5 11.51,26.69 12.01,25.89 12.52,25.1 13.05,24.32 13.59,23.55 14.16,22.79 14.73,22.05 15.33,21.32 15.94,20.6 16.56,19.89 17.2,19.2 17.85,18.52 18.52,17.85 19.2,17.2 19.89,16.56 20.6,15.94 21.32,15.33 22.05,14.73 22.79,14.16 23.55,13.59 24.32,13.05 25.1,12.52 25.89,12.01 26.69,11.51 27.5,11.03 28.32,10.57 29.15,10.12 29.99,9.69 30.84,9.28 31.7,8.89 32.56,8.52 33.43,8.16 34.31,7.82 35.2,7.5 36.09,7.2 36.99,6.92 37.9,6.66 38.81,6.41 39.72,6.19 40.64,5.98 41.57,5.8 42.5,5.63 43.43,5.48 44.36,5.35 45.3,5.25 46.23,5.16 47.17,5.09 48.12,5.04 49.06,5.01 50,5 50.94,5.01 51.88,5.04 52.83,5.09 53.77,5.16 54.7,5.25 55.64,5.35 56.57,5.48 57.5,5.63 58.43,5.8 59.36,5.98 60.28,6.19 61.19,6.41 62.1,6.66 63.01,6.92 63.91,7.2 64.8,7.5 65.69,7.82 66.57,8.16 67.44,8.52 68.3,8.89 69.16,9.28 70.01,9.69 70.85,10.12 71.68,10.57 72.5,11.03 73.31,11.51 74.11,12.01 74.9,12.52 75.68,13.05 76.45,13.59 77.21,14.16 77.95,14.73 78.68,15.33 79.4,15.94 80.11,16.56 80.8,17.2 81.48,17.85 82.15,18.52 82.8,19.2 83.44,19.89 84.06,20.6 84.67,21.32 85.27,22.05 85.84,22.79 86.41,23.55 86.95,24.32 87.48,25.1 87.99,25.89 88.49,26.69 88.97,27.5 89.43,28.32 89.88,29.15 90.31,29.99 90.72,30.84 91.11,31.7 91.48,32.56 91.84,33.43 92.18,34.31 92.5,35.2 92.8,36.09 93.08,36.99 93.34,37.9 93.59,38.81 93.81,39.72 94.02,40.64 94.2,41.57 94.37,42.5 94.52,43.43 94.65,44.36 94.75,45.3 94.84,46.23 94.91,47.17 94.96,48.12 94.99,49.06 95,50 94.99,50.94 94.96,51.88 94.91,52.83 94.84,53.77 94.75,54.7 94.65,55.64 94.52,56.57 94.37,57.5 94.2,58.43 94.02,59.36 93.81,60.28 93.59,61.19 93.34,62.1 93.08,63.01 92.8,63.91 92.5,64.8 92.18,65.69 91.84,66.57 91.48,67.44 91.11,68.3 90.72,69.16 90.31,70.01 89.88,70.85 89.43,71.68 88.97,72.5 88.49,73.31 87.99,74.11 87.48,74.9 86.95,75.68 86.41,76.45 85.84,77.21 85.27,77.95 84.67,78.68 84.06,79.4 83.44,80.11 82.8,80.8 82.15,81.48 81.48,82.15 80.8,82.8 80.11,83.44 79.4,84.06 78.68,84.67 77.95,85.27 77.21,85.84 76.45,86.41 75.68,86.95 74.9,87.48 74.11,87.99 73.31,88.49 72.5,88.97 71.68,89.43 70.85,89.88 70.01,90.31 69.16,90.72 68.3,91.11 67.44,91.48 66.57,91.84 65.69,92.18 64.8,92.5 63.91,92.8 63.01,93.08 62.1,93.34 61.19,93.59 60.28,93.81 59.36,94.02 58.43,94.2 57.5,94.37 56.57,94.52 55.64,94.65 54.7,94.75 53.77,94.84 52.83,94.91 51.88,94.96 50.94,94.99 50,95 49.06,94.99 48.12,94.96 47.17,94.91 46.23,94.84 45.3,94.75 44.36,94.65 43.43,94.52 42.5,94.37 41.57,94.2 40.64,94.02 39.72,93.81 38.81,93.59 37.9,93.34 36.99,93.08 36.09,92.8 35.2,92.5 34.31,92.18 33.43,91.84 32.56,91.48 31.7,91.11 30.84,90.72 29.99,90.31 29.15,89.88 28.32,89.43 27.5,88.97 26.69,88.49 25.89,87.99'; /* scripts/mark.svg #spiral, verbatim */
const NS = 'http://www.w3.org/2000/svg';
const RM = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const EMBED = params.get('embed') === '1';
const FRAMED = (() => { try { return window.self !== window.top; } catch (_) { return true; } })();
if (EMBED) document.documentElement.classList.add('embed');
$('logoPath').setAttribute('d', LOGO);

const page = $('page'), th = $('theatre'), dia = $('dia'), world = $('world');
const LEAD = 0.4;   /* seek this far before a beat so his first word is not clipped */
const TOL = 0.6;    /* a beat counts as reached this close to its start */
const FULLCAM = [0, 0, 1600, 680];

let DATA = null, BEATS = [], PLAY = null;
let cur = -1;                 /* active beat, 0-based */
let player = null, ready = false, ended = false;
let lastPoll = null;          /* { t, wall, moving } from the last getCurrentTime() */
let seekGuard = null;         /* ignore stale times right after a seek */
let driven = false;           /* the parent frame owns the steps */
let pendingStart = null;      /* where Play starts, before the player exists */
let stacked = false;

/* ---------- small builders ---------- */
const R = n => Math.round(n * 10) / 10;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function S(tag, a, p, txt) {
  const e = document.createElementNS(NS, tag);
  if (a) for (const k in a) if (a[k] != null) e.setAttribute(k, a[k]);
  if (txt != null) e.textContent = txt;
  if (p) p.appendChild(e);
  return e;
}
const dl = d => d == null ? null : '--d:' + d + 's';
function T(p, x, y, s, cls, size, anchor, d, extra) {
  return S('text', Object.assign({ x, y, class: cls || null, 'font-size': size || 16, 'text-anchor': anchor || 'start', style: dl(d) }, extra || {}), p, s);
}
function D(p, d, cls, delay, extra) { return S('path', Object.assign({ d, class: cls || null, style: dl(delay) }, extra || {}), p); }
function drawn(p, d, cls, delay, sw) { return D(p, d, 'in draw nf rnd ' + cls, delay, { pathLength: 1, 'stroke-width': sw || 2 }); }
function beat(on, lit, cls) { return S('g', { 'data-on': on, 'data-lit': (lit || [on]).join(' '), class: cls || null }, world); }
function person(p, x, y, s, cls, gcls, d) {
  const g = S('g', { class: gcls || null, style: dl(d) }, p);
  S('circle', { cx: x, cy: y, r: R(6 * s), class: cls }, g);
  D(g, `M${R(x - 9 * s)},${R(y + 26 * s)} Q${R(x - 9 * s)},${R(y + 9 * s)} ${x},${R(y + 9 * s)} Q${R(x + 9 * s)},${R(y + 9 * s)} ${R(x + 9 * s)},${R(y + 26 * s)} Z`, cls);
  return g;
}
function robot(p, x, y, s, cls, gcls, d) {
  const g = S('g', { class: gcls || null, style: dl(d) }, p);
  S('rect', { x: R(x - 4 * s), y: R(y - 9 * s), width: R(8 * s), height: R(6 * s), rx: R(1.5 * s), class: cls }, g);
  S('rect', { x: R(x - 5 * s), y: R(y - 2 * s), width: R(10 * s), height: R(9 * s), rx: R(1.5 * s), class: cls }, g);
  return g;
}
function head(p, x, y, deg, cls, size, d, sw) {
  const a = deg * Math.PI / 180, s = size || 9, c = Math.cos(a), si = Math.sin(a);
  const x1 = x - s * c + s * .6 * si, y1 = y - s * si - s * .6 * c, x2 = x - s * c - s * .6 * si, y2 = y - s * si + s * .6 * c;
  return D(p, `M${R(x1)},${R(y1)} L${R(x)},${R(y)} L${R(x2)},${R(y2)}`, 'in nf rnd ' + cls, d, { 'stroke-width': sw || 2.5 });
}
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

/* capability over the top of the stage: a year of past progress, then a
   hockey stick after full automation (schematic; no dates are implied) */
const AUTO_X = 700, TOP_X = 1180;
function capY(x) {
  if (x <= AUTO_X) return 166 - 70 * Math.pow(Math.max(0, x - 90) / (AUTO_X - 90), 0.9);
  const u = (x - AUTO_X) / (TOP_X - AUTO_X), k = 4.5;
  return 96 - 80 * (Math.exp(k * u) - 1) / (Math.exp(k) - 1);
}
function capPath(x0, x1) {
  let d = '';
  for (let x = x0; x < x1 + 5; x += 6) { const xx = Math.min(x, x1); d += (d ? 'L' : 'M') + R(xx) + ',' + R(capY(xx)); if (xx === x1) break; }
  return d;
}

/* ---------- the drawing: one continuous diagram, one group per beat ---------- */
const TILE = i => ({ x: 570 + (i % 6) * 72, y: 340 + Math.floor(i / 6) * 56 });
const AUTO4 = [2, 9, 13, 16, 22];
const AUTO9 = [0, 1, 4, 5, 7, 8, 10, 11, 14, 15, 17, 19, 20, 21, 23];
const GX = 186, GY = 350;           /* agent-hour grid inside the company */
const LX = 400, LY = 300;           /* oversight lens */
const LOOP = [440, 420];            /* the AI-builds-AI loop */
const live = { loop: null, agents: [], glyphs: [], robots: [], robotsShown: -1, capNum: null, score: null, scoreShown: -1 };

function buildDiagram() {
  const defs = S('defs', null, dia);
  const f = S('filter', { id: 'fogBlur', x: '-30%', y: '-30%', width: '160%', height: '160%' }, defs);
  S('feGaussianBlur', { stdDeviation: 7 }, f);
  const cp = S('clipPath', { id: 'lensClip' }, defs);
  S('circle', { cx: LX, cy: LY, r: 52 }, cp);

  /* 1. the timeline */
  { const g = beat(1);
    drawn(g, 'M330,180 L1506,180', 's-ink', 0, 2);
    head(g, 1510, 180, 0, 's-ink', 11, .8, 2);
    D(g, 'M330,172 L330,188', 'in nf s-ink', .05, { 'stroke-width': 2 });
    T(g, 330, 208, 'today', 'in mono f-mut', 17, 'middle', .05);
    T(g, 1510, 162, 'the next few years, maybe 5', 'in ser it', 24, 'end', .8);
  }
  /* 2. capabilities rise fast */
  { const g = beat(2);
    D(g, 'M70,186 L70,30', 'in nf s-line', 0, { 'stroke-width': 2 });
    T(g, 78, 38, 'capability', 'in mono f-mut', 17, 'start', 0);
    D(g, 'M90,180 L330,180', 'in nf s-mut dash', 0, { 'stroke-width': 1.5 });
    D(g, 'M90,174 L90,186', 'in nf s-mut', 0, { 'stroke-width': 2 });
    T(g, 90, 208, 'a year ago', 'in mono f-mut', 17, 'start', .05);
    drawn(g, capPath(90, 330), 's-acc', .15, 4);
    S('circle', { cx: 90, cy: R(capY(90)), r: 7, class: 'in pop f-acc', style: dl(.1) }, g);
    D(g, 'M90,156 L90,132', 'in nf s-mut', .15, { 'stroke-width': 1 });
    T(g, 84, 124, 'best high schoolers', 'in f-mut', 20, 'start', .15);
    S('circle', { cx: 330, cy: R(capY(330)), r: 7, class: 'in pop f-acc', style: dl(.95) }, g);
    T(g, 342, 163, 'best mathematicians', 'in', 20, 'start', .95);
    D(g, capPath(330, AUTO_X), 'in nf s-acc dash', 1.1, { 'stroke-width': 2.5 });
    T(g, 470, 94, 'progress continues', 'in mono f-mut', 17, 'middle', 1.2);
  }
  /* 3. inside the AI company, agents do most of the work */
  { const g = beat(3);
    S('rect', { x: 60, y: 290, width: 440, height: 300, rx: 8, class: 'in swell f-surf s-acc', 'stroke-width': 1.5, style: dl(0) }, g);
    T(g, 80, 321, 'AI COMPANY', 'in mono f-mut caps', 18, 'start', .05);
    for (let i = 0; i < 100; i++) {
      const col = i % 10, row = 9 - Math.floor(i / 10);
      const d = i < 30 ? .15 + i * .008 : i < 50 ? .55 + (i - 30) * .008 : .9 + (i - 50) * .006;
      S('rect', { x: GX + col * 17, y: GY + row * 17, width: 13, height: 13, rx: 2, class: 'in pop f-acc', style: dl(d.toFixed(3)) }, g);
    }
    const cx = GX + 83;
    T(g, cx - 47, 548, '30', 'in mono f-mut', 24, 'middle', .15);
    T(g, cx - 23, 548, '·', 'in mono f-mut', 24, 'middle', .55);
    T(g, cx, 548, '50', 'in mono f-mut', 24, 'middle', .55);
    T(g, cx + 23, 548, '·', 'in mono f-mut', 24, 'middle', .9);
    T(g, cx + 52, 548, '100', 'in mono f-acc', 24, 'middle', .9);
    T(g, cx, 572, 'agent hours per human hour', 'in mono f-mut', 14, 'middle', 1.0);
  }
  { const g = beat(3, [3, 5], 'human'); const w = S('g', { class: 'walk' }, g);
    person(w, 120, 402, 1.6, 'f-calm', 'in rise', .05);
    const hr = S('g', { class: 'hr' }, w);
    S('rect', { x: 109, y: 456, width: 22, height: 22, rx: 3, class: 'in pop f-calm', style: dl(.15) }, hr);
    T(hr, 120, 502, '1 human', 'in mono f-mut', 16, 'middle', .2);
    T(hr, 120, 520, 'hour', 'in mono f-mut', 16, 'middle', .2);
  }
  /* 4. deployed across the economy */
  { const g = beat(4);
    T(g, 570, 326, 'THE ECONOMY', 'in mono f-mut caps', 18, 'start', 0);
    drawn(g, 'M502,446 L558,446', 's-acc', .05, 2.5);
    head(g, 564, 446, 0, 's-acc', 9, .45);
    T(g, 534, 434, 'deployed', 'in mono f-acc', 13, 'middle', .25);
    for (let i = 0; i < 24; i++) {
      const t = TILE(i), tg = S('g', { class: 'in fade', style: dl((.05 + i * .012).toFixed(3)) }, g);
      S('rect', { x: t.x, y: t.y, width: 62, height: 46, rx: 5, class: 'f-surf s-line', 'stroke-width': 1.5 }, tg);
      person(tg, t.x + 18, t.y + 12, .8, 'f-calm');
    }
    for (let i = 0; i < 24; i++) { const t = TILE(i); S('circle', { cx: t.x + 47, cy: t.y + 14, r: 5.5, class: 'in pop f-acc', style: dl((.45 + i * .018).toFixed(3)) }, g); }
    AUTO4.forEach((i, k) => { const t = TILE(i), a = S('g', { class: 'in pop', style: dl((1.05 + k * .08).toFixed(2)) }, g);
      S('rect', { x: t.x, y: t.y, width: 62, height: 46, rx: 5, class: 'f-acc' }, a);
      S('rect', { x: t.x + 24, y: t.y + 16, width: 14, height: 14, rx: 2, class: 'f-gnd' }, a); });
    S('circle', { cx: 577, cy: 574, r: 6, class: 'in fade f-acc', style: dl(.45) }, g);
    T(g, 589, 580, 'augmenting', 'in mono f-mut', 17, 'start', .45);
    S('rect', { x: 710, y: 568, width: 12, height: 12, rx: 2, class: 'in fade f-acc', style: dl(1.05) }, g);
    T(g, 728, 580, 'automated', 'in mono f-mut', 17, 'start', 1.05);
  }
  /* 5. AI development without humans: the human steps out, the loop speeds up */
  { const g = beat(5);
    drawn(g, capPath(AUTO_X, TOP_X), 's-acc', .25, 4);
    const k = 4.5, slope = -80 * k * Math.exp(k) / (Math.exp(k) - 1) / (TOP_X - AUTO_X);
    head(g, TOP_X + 3, R(capY(TOP_X) - 2), Math.atan2(slope, 1) * 180 / Math.PI, 's-acc', 13, 1.2, 4);
    S('circle', { cx: AUTO_X, cy: 96, r: 9, class: 'in pop nf s-acc', 'stroke-width': 2.5, style: dl(0) }, g);
    T(g, 714, 126, 'full automation', 'in f-mut', 20, 'start', .1);
    T(g, TOP_X + 14, 28, 'speeds up', 'in f-acc', 21, 'start', 1.2);
    const lp = S('g', { class: 'in pop', style: dl(.3) }, g);
    const rot = S('g', null, lp); live.loop = rot;
    const cx = LOOP[0], cy = LOOP[1], r = 36, P = a => [R(cx + r * Math.cos(a * Math.PI / 180)), R(cy + r * Math.sin(a * Math.PI / 180))];
    [[200, 330], [20, 150]].forEach(([a0, a1]) => {
      const p0 = P(a0), p1 = P(a1);
      D(rot, `M${p0[0]},${p0[1]} A${r},${r} 0 0 1 ${p1[0]},${p1[1]}`, 'nf rnd s-acc', null, { 'stroke-width': 4 });
      const ta = (a1 + 90) * Math.PI / 180, s = 10, c = Math.cos(ta), si = Math.sin(ta), x = p1[0], y = p1[1];
      D(rot, `M${R(x - s * c + s * .6 * si)},${R(y - s * si - s * .6 * c)} L${x},${y} L${R(x - s * c - s * .6 * si)},${R(y - s * si + s * .6 * c)}`, 'nf rnd s-acc', null, { 'stroke-width': 4 });
    });
    T(g, cx, 482, 'AI builds AI', 'in mono f-acc', 16, 'middle', .5);
  }
  /* 6. oversight is lost */
  { const g = beat(6);
    const lens = S('g', { class: 'in pop', style: dl(0) }, g);
    S('circle', { cx: LX, cy: LY, r: 52, class: 'f-gnd', 'fill-opacity': .35 }, lens);
    const clip = S('g', { 'clip-path': 'url(#lensClip)' }, lens);
    const fog = S('g', { class: 'fog', filter: 'url(#fogBlur)' }, clip);
    [[-20, -16, 34, 18], [20, 8, 30, 22], [-8, 26, 40, 14], [14, -30, 22, 14], [-30, 12, 18, 20]].forEach(([x, y, rx, ry]) => S('ellipse', { cx: LX + x, cy: LY + y, rx, ry, class: 'f-mut' }, fog));
    S('circle', { cx: LX, cy: LY, r: 54, class: 'nf s-ink', 'stroke-width': 5 }, lens);
    D(lens, `M${LX + 38},${LY - 38} L${LX + 74},${LY - 74}`, 'nf rnd s-ink', null, { 'stroke-width': 9 });
    T(g, LX + 84, LY - 62, 'human oversight', 'in f-calm', 20, 'start', .1);
    T(g, LX + 84, LY - 36, 'too complicated, too much stuff, too superhuman', 'in ser it f-mut', 19, 'start', .6);
  }
  /* 7. misalignment could enter anywhere; the dashboard says fine */
  { const g = beat(7);
    [560, AUTO_X, 940, 1120].forEach((x, k) => { const y = R(capY(x));
      D(g, `M${x},${R(y - 11)} L${x + 11},${y} L${x},${R(y + 11)} L${x - 11},${y} Z`, 'in pop f-gnd s-risk', (.1 + k * .22).toFixed(2), { 'stroke-width': 2.5 }); });
    T(g, 760, 158, 'misalignment could enter at any point', 'in f-risk', 21, 'start', .25);
    S('rect', { x: GX + 153, y: GY + 153, width: 13, height: 13, rx: 2, class: 'in pop f-risk', style: dl(.95) }, g);
    S('circle', { cx: GX + 159.5, cy: GY + 159.5, r: 13, class: 'in pop nf s-risk blink', 'stroke-width': 2, style: dl(1.05) }, g);
  }
  { const g = beat(7, [7, 11]);
    S('rect', { x: 60, y: 606, width: 440, height: 70, rx: 5, class: 'in fade f-surf s-line', 'stroke-width': 1.5, style: dl(.5) }, g);
    T(g, 76, 628, 'DASHBOARD', 'in mono f-mut caps', 14, 'start', .5);
    [[82, 'aligned'], [184, 'safe'], [252, 'fine to deploy']].forEach(([x, s], k) => {
      S('circle', { cx: x, cy: 651, r: 6, class: 'in pop f-calm', style: dl((.7 + k * .15).toFixed(2)) }, g);
      T(g, x + 12, 658, s, 'in', 19, 'start', (.7 + k * .15).toFixed(2));
    });
  }
  /* 8. why: cheating in training generalises */
  { const g = beat(8);
    S('rect', { x: 382, y: 498, width: 108, height: 84, rx: 4, class: 'in fade f-gnd s-line', 'stroke-width': 1.5, style: dl(0) }, g);
    T(g, 436, 518, 'SCORE', 'in mono f-mut caps', 14, 'middle', 0);
    live.score = T(g, 436, 550, '100', 'in mono f-risk', 28, 'middle', .15);
    T(g, 436, 572, 'controlled', 'in mono f-risk', 14, 'middle', .6);
    drawn(g, `M${GX + 167},${GY + 160} C${GX + 186},${GY + 160} 362,540 381,540`, 's-risk', .2, 3);
    S('rect', { x: 48, y: 278, width: 464, height: 324, rx: 12, class: 'in swell nf s-risk dash', 'stroke-width': 2.5, style: dl(1.0) }, g);
    T(g, 52, 270, 'control the whole process', 'in f-risk', 20, 'start', 1.2);
  }
  /* 9. the company runs itself and ships everywhere */
  { const g = beat(9);
    T(g, 80, 345, 'runs itself', 'in mono f-acc', 16, 'start', 0);
    D(g, 'M502,398 C530,398 536,372 562,372', 'in nf s-acc dash', .1, { 'stroke-width': 2 });
    D(g, 'M502,494 C530,494 536,520 562,520', 'in nf s-acc dash', .15, { 'stroke-width': 2 });
    AUTO9.forEach((i, k) => { const t = TILE(i), a = S('g', { class: 'in drop', style: dl((.3 + k * .05).toFixed(2)) }, g);
      S('rect', { x: t.x, y: t.y, width: 62, height: 46, rx: 5, class: 'f-acc' }, a);
      S('rect', { x: t.x + 24, y: t.y + 16, width: 14, height: 14, rx: 2, class: 'f-gnd' }, a); });
    const all = new Set(AUTO4.concat(AUTO9)), sync = S('g', { class: 'in fade', style: dl(1.2) }, g);
    all.forEach(i => { const t = TILE(i);
      [[1, 0], [0, 1]].forEach(([dc, dr]) => { const j = i + dc + dr * 6;
        if ((dc && i % 6 === 5) || j > 23 || !all.has(j)) return; const u = TILE(j);
        S('line', { x1: t.x + 31, y1: t.y + 23, x2: u.x + 31, y2: u.y + 23, class: 's-ink flow', 'stroke-width': 1.8 }, sync); }); });
  }
  /* 10. swarms we cannot read */
  { const g = beat(10);
    const sw = S('g', { class: 'in fade', style: dl(0) }, g), rnd = rng(10);
    for (let i = 0; i < 34; i++) {
      live.agents.push({ el: S('circle', { r: 6, class: 'f-acc', stroke: '#111014', 'stroke-width': 2 }, sw),
        ax: 60 + rnd() * 150, ay: 26 + rnd() * 72, wx: .25 + rnd() * .35, wy: .3 + rnd() * .4, px: rnd() * 6.3, py: rnd() * 6.3 });
    }
    for (let j = 0; j < 6; j++) {
      const gg = S('g', null, sw);
      S('rect', { x: -27, y: -16, width: 54, height: 32, rx: 9, class: 'f-gnd s-acc', 'stroke-width': 2 }, gg);
      for (let q = 0; q < 3; q++) { const ox = -14 + q * 14; let d = '';
        for (let s = 0; s < 3; s++) d += (s ? 'L' : 'M') + R(ox - 4 + rnd() * 8) + ',' + R(-8 + s * 8 + (rnd() - .5) * 4);
        D(gg, d, 'nf rnd s-ink', null, { 'stroke-width': 2.2 }); }
      live.glyphs.push(gg);
    }
    T(g, 992, 580, 'not in English', 'in mono f-acc', 17, 'end', .4);
  }
  /* 11. people are afraid; it looks aligned */
  { const g = beat(11);
    for (let i = 0; i < 5; i++) { const x = 592 + i * 38, pg = S('g', { class: 'in rise', style: dl((.05 + i * .06).toFixed(2)) }, g);
      person(pg, x, 618, 1.1, 'f-calm');
      const al = S('g', { class: 'shake' }, pg);
      D(al, `M${x - 7},605 L${x - 11},599 M${x},603 L${x},596 M${x + 7},605 L${x + 11},599`, 'nf rnd s-risk', null, { 'stroke-width': 2.2 }); }
    D(g, 'M826,652 A34,34 0 0 1 894,652', 'in nf s-line', .3, { 'stroke-width': 7 });
    D(g, 'M871.6,620.1 A34,34 0 0 1 894,652', 'in nf s-risk', .35, { 'stroke-width': 7 });
    D(g, 'M868.9,627.6 L875,610.7', 'in nf s-calm', .35, { 'stroke-width': 2.5 });
    T(g, 884, 604, 'fear', 'in mono f-calm', 16, 'middle', .35);
    D(g, 'M860,652 L860,623', 'needle nf rnd s-ink', null, { 'stroke-width': 3 });
    S('circle', { cx: 860, cy: 652, r: 4.5, class: 'in fade', fill: '#ede9f2', style: dl(.3) }, g);
    T(g, 904, 640, 'competitive', 'in mono f-mut', 16, 'start', .4);
    T(g, 904, 659, 'pressure', 'in mono f-mut', 16, 'start', .4);
    T(g, 490, 628, 'looks aligned; isn’t', 'in mono f-risk', 15, 'end', 1.0);
  }
  /* 12. robots building robots */
  { const g = beat(12);
    T(g, 1050, 270, 'AI designs, robots build robots', 'in mono f-mut', 17, 'start', 0);
    D(g, 'M1050,420 L1050,330 L1090,300 L1090,330 L1130,300 L1130,330 L1170,300 L1170,330 L1210,300 L1210,330 L1250,300 L1250,420 Z', 'in fade f-surf s-mut', 0, { 'stroke-width': 2, 'stroke-linejoin': 'round' });
    S('rect', { x: 1064, y: 346, width: 46, height: 46, rx: 3, class: 'in fade nf s-acc dash', 'stroke-width': 1.5, style: dl(.3) }, g);
    robot(g, 1087, 374, 2.2, 'f-surf s-acc', 'in fade', .35).setAttribute('stroke-width', 1.5);
    drawn(g, 'M1118,370 L1144,370', 's-mut', .55, 2);
    head(g, 1148, 370, 0, 's-mut', 8, .75, 2);
    robot(g, 1178, 376, 2.4, 'f-acc', 'in pop', .75);
    T(g, 1087, 412, 'design', 'in mono f-mut', 14, 'middle', .35);
    T(g, 1178, 412, 'build', 'in mono f-mut', 14, 'middle', .75);
    const field = S('g', { class: 'in fade', style: dl(.9) }, g);
    for (let i = 0; i < 64; i++) live.robots.push(robot(field, 1276 + (i % 8) * 15.5, 318 + Math.floor(i / 8) * 14.5, .85, 'f-acc'));
    D(g, 'M1420,298 L1420,420 L1560,420', 'in nf s-mut', .2, { 'stroke-width': 1.5 });
    let d = ''; for (let s = 0; s <= 40; s++) { const u = s / 40; d += (s ? 'L' : 'M') + R(1422 + u * 134) + ',' + R(418 - 112 * (Math.exp(4.2 * u) - 1) / (Math.exp(4.2) - 1)); }
    drawn(g, d, 's-risk', .5, 3);
    T(g, 1420, 270, 'physical capacity', 'in mono f-mut', 17, 'start', .2);
    live.capNum = T(g, 1432, 328, '×1', 'in mono f-risk', 26, 'start', .5);
  }
  /* 13. they can't stop, or feel they can't */
  { const g = beat(13);
    person(g, 1068, 478, 1.2, 'f-calm', 'in rise', 0);
    person(g, 1100, 488, 1.2, 'f-calm', 'in rise', .08);
    D(g, 'M1116,506 L1140,506', 'in nf rnd s-calm dash', .3, { 'stroke-width': 2.5 });
    const W3 = [1086, 1190, 1294];
    W3.forEach((x, k) => drawn(g, `M1190,538 L${x},588`, 's-mut', (.45 + k * .1).toFixed(2), 2));
    [[W3[0], 'economic'], [W3[1], 'geopolitical'], [W3[2], 'military']].forEach(([x, s], k) => {
      D(g, `M${x - 17},588 L${x + 17},588 L${x + 24},622 L${x - 24},622 Z`, 'in drop f-mut', (.7 + k * .12).toFixed(2));
      T(g, x, 648, s, 'in mono f-mut', 14, 'middle', (.8 + k * .12).toFixed(2)); });
    const b = S('g', { class: 'in pop', style: dl(.1) }, g);
    S('circle', { cx: 1190, cy: 500, r: 38, class: 'f-surf s-risk', 'stroke-width': 4 }, b);
    T(b, 1190, 508, 'STOP', null, 22, 'middle', null, { 'font-weight': 600 });
  }
  /* 14. AI capability passes humanity's, faster than expected */
  { const g = beat(14);
    D(g, `M${AUTO_X},96 L1500,64`, 'in nf s-mut dash', .1, { 'stroke-width': 2 });
    T(g, 1500, 57, 'what people were expecting', 'in f-mut', 20, 'end', .2);
    T(g, 1338, 458, 'capability', 'in mono f-mut', 16, 'start', 0);
    S('rect', { x: 1346, y: 530, width: 44, height: 110, class: 'in fade f-calm', style: dl(.1) }, g);
    S('rect', { x: 1406, y: 470, width: 44, height: 170, class: 'grow f-acc' }, g);
    D(g, 'M1338,530 L1462,530', 'in nf s-ink dash', .2, { 'stroke-width': 1.5 });
    T(g, 1368, 662, 'humans', 'in mono f-mut', 15, 'middle', .1);
    T(g, 1428, 662, 'AIs', 'in mono f-acc', 15, 'middle', .3);
    for (let k = 0; k < 4; k++) { const x = 1522, y = 490 + k * 38, dg = S('g', { class: 'drone nf', 'stroke-width': 2, style: dl((.8 + k * .15).toFixed(2)) }, g);
      D(dg, `M${x - 9},${y - 9} L${x + 9},${y + 9} M${x + 9},${y - 9} L${x - 9},${y + 9}`, null);
      [[-9, -9], [9, -9], [-9, 9], [9, 9]].forEach(([dx, dy]) => S('circle', { cx: x + dx, cy: y + dy, r: 4.5 }, dg)); }
    T(g, 1522, 646, 'military', 'in mono f-mut', 14, 'middle', .8);
    T(g, 1522, 664, 'AI-run', 'in mono f-acc', 14, 'middle', 1.2);
  }
  /* 15. takeover: the levers they hold light up */
  { const g = beat(15);
    [{ r: [54, 284, 452, 312], s: 'software', px: 8, py: 470, left: true },
     { r: [564, 334, 434, 226], s: 'hacking', px: 998, py: 312 },
     { r: [1044, 284, 352, 142], s: 'robotic infrastructure', px: 1044, py: 430, left: true },
     { r: [1498, 470, 48, 152], s: 'the military', px: 1566, py: 446 }].forEach((o, k) => {
      S('rect', { x: o.r[0], y: o.r[1], width: o.r[2], height: o.r[3], rx: 10, class: 'in swell nf s-risk', 'stroke-width': 3, style: dl((.1 + k * .3).toFixed(2)) }, g);
      const w = 20 + o.s.length * 8.6, x0 = o.left ? o.px : o.px - w, pg = S('g', { class: 'in pop', style: dl((.25 + k * .3).toFixed(2)) }, g);
      S('rect', { x: R(x0), y: o.py, width: R(w), height: 24, rx: 12, class: 'f-risk' }, pg);
      T(pg, R(x0 + w / 2), o.py + 17, o.s, 'mono f-gnd', 14.5, 'middle', null, { 'font-weight': 600 }); });
  }
}

/* ---------- the beat engine ---------- */
let groups = [];
function applyBeat(i) {
  const n = i + 1;
  for (const gr of groups) {
    const st = n < gr.on ? 'fut' : gr.lit.includes(n) ? 'lit' : 'dim';
    gr.el.classList.remove('fut', 'lit', 'dim');
    gr.el.classList.add(st);
    if (gr.on === n) { gr.el.classList.remove('enter'); void gr.el.getBoundingClientRect(); gr.el.classList.add('enter'); }
    else gr.el.classList.remove('enter');
  }
  for (let k = 1; k <= BEATS.length; k++) dia.classList.toggle('r' + k, n >= k);
}
function setBeat(i, force) {
  i = clamp(i | 0, 0, BEATS.length - 1);
  if (i === cur && !force) return;
  cur = i;
  applyBeat(i);
  renderWords(i);
  renderList();
  aimCamera(false);
  tell();
}
function beatAt(t) { let i = 0; for (let k = 0; k < BEATS.length; k++) if (BEATS[k].t <= t + TOL) i = k; return i; }

const pad2 = n => String(n).padStart(2, '0');
function fmt(sec) { sec = Math.max(0, Math.floor(sec)); const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60; return (h ? h + ':' + pad2(m) : m) + ':' + pad2(s); }
function renderWords(i) {
  const b = BEATS[i], w = $('words');
  $('wn').textContent = pad2(i + 1) + ' / ' + pad2(BEATS.length);
  $('wt').textContent = fmt(b.t);
  $('wl').textContent = b.label;
  $('wq').textContent = '“' + b.his_words + '”';
  $('wc').textContent = 'Ryan Greenblatt, ' + fmt(b.t);
  w.classList.remove('swap'); void w.offsetWidth; w.classList.add('swap');
}

/* ---------- beat list, progress ---------- */
function buildList() {
  const ol = $('beatList');
  BEATS.forEach((b, i) => {
    const li = document.createElement('li'), bt = document.createElement('button');
    bt.type = 'button'; bt.textContent = String(i + 1); bt.dataset.i = i;
    bt.title = b.label + ' (' + fmt(b.t) + ')';
    bt.setAttribute('aria-label', 'Beat ' + (i + 1) + ': ' + b.label + ', ' + fmt(b.t));
    bt.addEventListener('click', () => gotoBeat(i));
    li.appendChild(bt); ol.appendChild(li);
  });
  const prog = $('prog'), span = PLAY.end - PLAY.start;
  BEATS.forEach(b => { const tk = document.createElement('div'); tk.className = 'tick'; tk.style.left = ((b.t - PLAY.start) / span * 100).toFixed(2) + '%'; prog.appendChild(tk); });
  prog.addEventListener('click', e => { const r = prog.getBoundingClientRect(); seekTo(PLAY.start + clamp((e.clientX - r.left) / r.width, 0, 1) * span); });
}
function renderList() {
  document.querySelectorAll('#beatList button').forEach((bt, i) => {
    bt.setAttribute('aria-current', i === cur ? 'true' : 'false');
    bt.classList.toggle('done', i < cur);
  });
}
function progress(t) {
  const span = PLAY.end - PLAY.start;
  $('fill').style.width = (clamp((t - PLAY.start) / span, 0, 1) * 100).toFixed(2) + '%';
  $('time').textContent = fmt(t) + ' / ' + fmt(PLAY.end);
}

/* ---------- the video box: large, corner, large ---------- */
function computeFull(t) {
  if (ended) return true;
  if (t == null) return cur === 0;
  if (driven) return cur === 0 || (cur === BEATS.length - 1 && t >= PLAY.video_full_from);
  return t < PLAY.video_full_until || t >= PLAY.video_full_from;
}
function setFull(full, t) {
  th.classList.toggle('vfull', !!full);
  const endPhase = ended || (t != null && t >= PLAY.video_full_from);
  $('cardTitle').hidden = !!endPhase;
  $('cardEnd').hidden = !endPhase;
}

/* ---------- YouTube ---------- */
let ytQueue = [];
const prevReady = window.onYouTubeIframeAPIReady;
window.onYouTubeIframeAPIReady = function () { if (typeof prevReady === 'function') prevReady(); const q = ytQueue; ytQueue = []; q.forEach(f => f()); };
function whenYT(fn) { if (window.YT && window.YT.loaded && window.YT.Player) fn(); else ytQueue.push(fn); }
function status(msg, html) { const s = $('status'); if (html) s.innerHTML = msg; else s.textContent = msg || ''; }

function startPlayer() {
  if (player) { player.playVideo(); return; }
  const at = pendingStart != null ? pendingStart : PLAY.start;
  $('goText').textContent = 'Loading the video…';
  $('go').disabled = true;
  const fail = setTimeout(() => { if (!ready) status('The YouTube player did not load. Check the connection, then reload.'); }, 12000);
  whenYT(() => {
    $('startc').hidden = true;       /* nothing ever sits over the player */
    player = new YT.Player('yt', {
      videoId: DATA.source.youtube_id,
      width: '100%', height: '100%',
      playerVars: { start: Math.max(0, Math.floor(at)), end: PLAY.end, autoplay: 1, playsinline: 1, rel: 0, modestbranding: 1,
        cc_load_policy: 1, cc_lang_pref: 'en', hl: 'en', iv_load_policy: 3, enablejsapi: 1, origin: location.origin },
      events: {
        onReady: e => { clearTimeout(fail); ready = true; try { e.target.playVideo(); } catch (_) {}
          setInterval(poll, 200); poll();
          setTimeout(() => { const st = player.getPlayerState(); if (st !== 1 && st !== 3) status('If the video has not started, press play on the video itself.'); }, 3000); },
        onStateChange: e => { if (e.data === 0) ended = true; else if (e.data === 1) { ended = false; status(''); } $('pp').textContent = e.data === 1 || e.data === 3 ? 'Pause' : ended ? 'Replay' : 'Play'; poll(); },
        onError: e => status('The video could not play here (YouTube error ' + e.data + '). <a href="https://www.youtube.com/watch?v=' + DATA.source.youtube_id + '&t=' + PLAY.start + 's" target="_blank" rel="noopener">Open it on YouTube</a>.', true)
      }
    });
  });
}
function poll() {
  if (!player || !ready || typeof player.getCurrentTime !== 'function') return;
  const t = player.getCurrentTime(), st = player.getPlayerState();
  if (seekGuard) { if (performance.now() < seekGuard.until && Math.abs(t - seekGuard.to) > 1.5) return; seekGuard = null; }
  lastPoll = { t, wall: performance.now(), moving: st === 1 };
  if (!driven) setBeat(beatAt(t));
  setFull(computeFull(t), t);
  th.classList.toggle('paused', !(st === 1 || st === 3));
  progress(t);
}
function seekTo(t, keepBeat) {
  t = clamp(t, PLAY.start, PLAY.end - 0.5);
  if (player && ready) {
    if (ended) { ended = false; }
    player.seekTo(t, true);
    if (player.getPlayerState() === 0) player.playVideo();
    seekGuard = { to: t, until: performance.now() + 1500 };
    lastPoll = { t, wall: performance.now(), moving: lastPoll ? lastPoll.moving : false };
  } else pendingStart = t;
  if (!keepBeat) setBeat(beatAt(t));
  setFull(computeFull(player && ready ? t : null), player && ready ? t : null);
  progress(t);
}
function gotoBeat(i, fromParent) {
  i = clamp(i | 0, 0, BEATS.length - 1);
  const b = BEATS[i], target = i === 0 ? PLAY.start : Math.max(PLAY.start, b.t - LEAD);
  let inside = false;
  if (player && ready && lastPoll) { const t = lastPoll.t; inside = t >= b.t - TOL - LEAD && (i === BEATS.length - 1 || t < BEATS[i + 1].t - TOL); }
  setBeat(i, true);
  if (!(fromParent && driven && inside)) seekTo(target, true);
}
function togglePlay() {
  if (!player) { startPlayer(); return; }
  if (!ready) return;
  const st = player.getPlayerState();
  if (ended) { seekTo(PLAY.start); player.playVideo(); }
  else if (st === 1 || st === 3) player.pauseVideo();
  else player.playVideo();
}

/* ---------- continuous motion, on the video's clock ---------- */
function vtNow() { if (!lastPoll) return null; return lastPoll.moving ? lastPoll.t + (performance.now() - lastPoll.wall) / 1000 : lastPoll.t; }
function loopAngle(vt, now) {
  if (vt == null) return (now / 1000 * 110) % 360;
  const s = vt - BEATS[4].t;
  if (s <= 0) return (vt * 90) % 360;
  const ramp = 20, a = s <= ramp ? 90 * s + 310 * s * s / (2 * ramp) : 90 * ramp + 310 * ramp / 2 + 400 * (s - ramp);
  return a % 360;
}
function frame(now) {
  const vt = vtNow(), clock = vt != null ? vt : now / 1000;
  if (cur >= 4 && live.loop) live.loop.setAttribute('transform', 'rotate(' + (RM ? 0 : loopAngle(vt, now)).toFixed(1) + ' ' + LOOP[0] + ' ' + LOOP[1] + ')');
  if (cur >= 7 && live.score) {
    const s = vt == null || RM || cur > 7 ? 100 : clamp(72 + Math.floor((vt - BEATS[7].t - .6) * 14), 72, 100);
    if (s !== live.scoreShown) { live.score.textContent = String(s); live.scoreShown = s; }
  }
  if (cur >= 9) {
    const t = RM ? 3 : clock, pos = [];
    live.agents.forEach(a => { const x = 781 + a.ax * Math.sin(a.wx * t + a.px), y = 447 + a.ay * Math.sin(a.wy * t + a.py); pos.push([x, y]); a.el.setAttribute('cx', x.toFixed(1)); a.el.setAttribute('cy', y.toFixed(1)); });
    const N = pos.length;
    live.glyphs.forEach((gg, j) => {
      const ph = t / 1.7 + j / 6, k = Math.floor(ph), f = ph - k;
      const a = (k * 7 + j * 13) % N, b = (k * 11 + j * 5 + 3) % N, e = f < .5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2;
      const x = pos[a][0] + (pos[b][0] - pos[a][0]) * e, y = pos[a][1] + (pos[b][1] - pos[a][1]) * e - 14;
      gg.setAttribute('transform', 'translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ')');
      gg.setAttribute('opacity', RM ? 1 : Math.sin(Math.PI * f).toFixed(2));
    });
  }
  if (cur >= 11) {
    let n = 64;
    if (vt != null && !RM && cur === 11) { const s = vt - BEATS[11].t; n = s < 0 ? 1 : Math.min(64, Math.pow(2, Math.floor(s / 1.4))); }
    if (n !== live.robotsShown) { live.robots.forEach((r, i) => r.setAttribute('opacity', i < n ? 1 : 0)); live.capNum.textContent = '×' + n; live.robotsShown = n; }
  }
  camera(now);
  requestAnimationFrame(frame);
}

/* ---------- camera: on narrow screens the drawing zooms to the focus ---------- */
const CAMS = { title: FULLCAM, 'capability-line': [40, 10, 660, 440], company: [30, 250, 510, 340], economy: [480, 270, 540, 360], loop: [0, 0, 1200, 680],
  oversight: [40, 200, 840, 480], misalignment: [0, 0, 1200, 680], score: [20, 250, 520, 350], deploy: [30, 250, 990, 440], swarm: [540, 290, 480, 320],
  'appears-aligned': [40, 360, 990, 330], robots: [1030, 240, 560, 380], 'cant-stop': [1030, 430, 320, 250], surpass: [1320, 430, 270, 250], takeover: FULLCAM };
let cam = FULLCAM.slice(), camFrom = null, camTo = null, camT0 = 0;
function aimCamera(instant) {
  const to = stacked && cur >= 0 ? (CAMS[BEATS[cur].focus] || FULLCAM) : FULLCAM;
  if (instant || RM) { cam = to.slice(); camTo = null; dia.setAttribute('viewBox', cam.join(' ')); return; }
  camFrom = cam.slice(); camTo = to; camT0 = performance.now();
}
function camera(now) {
  if (!camTo) return;
  const p = clamp((now - camT0) / 900, 0, 1), e = p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
  cam = camFrom.map((v, k) => v + (camTo[k] - v) * e);
  dia.setAttribute('viewBox', cam.map(v => v.toFixed(1)).join(' '));
  if (p >= 1) camTo = null;
}

/* ---------- layout: real CSS pixels for the video, never below 356 x 200 ---------- */
let layoutKey = '';
function layout() {
  const cs = getComputedStyle(page), rs = document.documentElement.style;
  const cw = page.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  const key = cw + 'x' + window.innerHeight + 'x' + page.clientHeight * (EMBED ? 1 : 0);
  if (key === layoutKey) return;
  layoutKey = key;
  const was = stacked;
  stacked = cw < 760;
  page.classList.toggle('stacked', stacked);
  th.classList.add('nosize');
  if (stacked) {
    const vw = EMBED ? page.clientWidth : cw + 32;
    rs.setProperty('--sh', Math.max(200, Math.round(vw * 9 / 16)) + 'px');
    rs.setProperty('--W', cw + 'px');
  } else {
    const headH = EMBED ? 0 : $('top').offsetHeight + 10, ctlH = EMBED ? 0 : $('ctl').offsetHeight + 12;
    const availH = EMBED ? page.clientHeight : window.innerHeight - headH - ctlH - 30;
    const bandOf = W => Math.round(clamp(Math.round(W * .29), 356, 460) * 9 / 16) + 28;
    let W = cw;
    for (let k = 0; k < 4; k++) { const need = W * 680 / 1600 + bandOf(W); if (need > availH) W = Math.floor((availH - bandOf(W)) * 1600 / 680); }
    W = clamp(W, 760, cw);
    const pipW = clamp(Math.round(W * .29), 356, 460), pipH = Math.round(pipW * 9 / 16), pad = 14;
    const svgH = Math.round(W * 680 / 1600), fullW = Math.min(W, Math.round(svgH * 16 / 9));
    const v = { '--W': W, '--H': svgH + pipH + 2 * pad, '--svgH': svgH, '--bandH': pipH + 2 * pad, '--bandT': svgH + pad, '--pad': pad,
      '--pipW': pipW, '--pipH': pipH, '--fullL': Math.round((W - fullW) / 2), '--fullW': fullW, '--fullH': svgH, '--wordsL': pad + pipW + 24,
      '--lblF': Math.round(clamp(W * .03, 22, 40)), '--hisF': Math.round(clamp(W * .0155, 15, 21)) };
    for (const k in v) rs.setProperty(k, v[k] + 'px');
  }
  requestAnimationFrame(() => requestAnimationFrame(() => th.classList.remove('nosize')));
  if (was !== stacked) aimCamera(true);
}

/* ---------- stepped-explainer contract ---------- */
function tell() { if (FRAMED) { try { window.parent.postMessage({ type: 'explainer-step', n: cur + 1, total: BEATS.length }, '*'); } catch (_) {} } }
window.addEventListener('message', e => {
  if (!FRAMED || e.source !== window.parent) return;
  const d = e.data;
  if (!d || typeof d !== 'object' || !BEATS.length) return;
  if (d.type === 'driven') { driven = true; document.documentElement.classList.add('driven'); return; }
  if (d.type === 'step') { const n = d.n === 'next' ? cur + 2 : Number(d.n); if (isFinite(n)) gotoBeat(Math.round(n) - 1, true); }
});

/* ---------- start ---------- */
function init(data) {
  DATA = data; BEATS = data.beats; PLAY = data.play;
  buildDiagram();
  groups = Array.from(world.querySelectorAll('[data-on]')).map(el => ({ el, on: +el.dataset.on, lit: el.dataset.lit.split(' ').map(Number) }));
  buildList();
  $('span').textContent = fmt(PLAY.start) + ' to ' + fmt(PLAY.end);
  $('goText').textContent = 'Play the scenario (' + fmt(PLAY.end - PLAY.start) + ')';
  $('fullLink').href = 'https://www.youtube.com/watch?v=' + data.source.youtube_id + '&t=' + PLAY.start + 's';
  $('go').addEventListener('click', startPlayer);
  $('pp').addEventListener('click', togglePlay);
  $('replay').addEventListener('click', () => { if (player && ready) { seekTo(PLAY.start); player.playVideo(); } else startPlayer(); });
  document.addEventListener('keydown', e => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const tag = (e.target && e.target.tagName || '').toLowerCase();
    if (e.key === ' ' || e.code === 'Space') {
      if (tag === 'input' || tag === 'textarea' || tag === 'a' || ['pp', 'go', 'replay'].includes(e.target.id)) return;
      e.preventDefault(); togglePlay();
    } else if (e.key === 'ArrowRight') { e.preventDefault(); gotoBeat(cur + 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); gotoBeat(cur - 1); }
  });
  document.addEventListener('keyup', e => { if ((e.key === ' ' || e.code === 'Space') && e.target && e.target.closest && e.target.closest('#beatList')) e.preventDefault(); });
  layout();
  if (window.ResizeObserver) new ResizeObserver(() => layout()).observe(page);
  window.addEventListener('resize', layout);
  const n = params.has('step') ? clamp(parseInt(params.get('step'), 10) || 1, 1, BEATS.length) : 1;
  gotoBeat(n - 1);
  requestAnimationFrame(frame);
  window.__scenario = { setBeat: i => setBeat(i, true), gotoBeat, beats: BEATS, get beat() { return cur + 1; }, get stacked() { return stacked; }, layout };
  window.__explainer = { get step() { return cur + 1; }, get total() { return BEATS.length; }, get driven() { return driven; }, gotoStep: n => gotoBeat(n - 1, true) };
}
fetch('beats.json', { cache: 'no-cache' }).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }).then(init).catch(() => {
  status('Could not read beats.json. Serve this folder over http (python -m http.server) and open it from there.');
  $('wl').textContent = 'beats.json did not load';
});
})();
