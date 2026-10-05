# Strikketeller

Enkel web-app (PWA) for å telle omganger og økninger/fellinger per strikkeprosjekt. Fungerer på mobil og i nettleser, også offline, og kan legges på hjemskjermen.

- Flere prosjekter med eget navn (eller standardnavn «Prosjekt N»)
- Stor knapp for økning/felling og stor knapp for omganger, med −1 og nullstill
- Valgfritt «omganger per økning/felling»: når omgangene når tallet, telles én økning/felling automatisk
- «Skjermen holdes på» via Screen Wake Lock API
- Alt lagres lokalt i nettleseren (localStorage) på den enheten du bruker

## Kjøre lokalt

```
python -m http.server 8765
```

Åpne http://localhost:8765. (Service worker og «skjermen på» krever http(s), ikke `file://`.)

## Publisere

Appen er bare statiske filer, så den kan legges på GitHub Pages, Netlify eller Cloudflare Pages uten byggesteg. Den må serveres over https for at installasjon og «skjermen på» skal virke på mobil.

Når du endrer filer, øk `CACHE` i `sw.js` (f.eks. `strikketeller-v2`) så gamle filer ryddes bort.
