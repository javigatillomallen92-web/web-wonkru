# web-wonkru

Pulse 3D hero landing page: a heartbeat-pulsing, noise-displaced 3D core with shockwave rings and an orbiting particle field (Three.js), over a "Full Workflow Automation" hero.

Static site, no build step. Serve the folder and open it:

```sh
python3 -m http.server 8000
# http://localhost:8000
```

- `index.html` — markup (nav, hero copy)
- `styles.css` — layout, typography, entrance animations
- `main.js` — Three.js scene (loaded from the jsDelivr CDN via an import map)
