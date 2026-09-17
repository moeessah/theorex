THEOREX SPLIT

Pages
- index.html = video hero homepage
- glass.html = glass version
- plain.html = plain version

Shared assets
- css/theorex-shared.css = shared site styling + system light/dark theme
- js/theorex-shared.js = shared interactions

Version-only assets
- css/theorex-video.css + js/theorex-video.js
- css/theorex-glass.css + js/theorex-glass.js
- css/theorex-plain.css

Put the existing theorexpics/ folder beside these files, preserving its current paths.
Each page has its own light/dark theme toggle. The first visit follows the visitor's computer/browser prefers-color-scheme setting; after a manual toggle, the chosen theme is remembered in localStorage.
