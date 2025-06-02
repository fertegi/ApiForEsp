# Node.js API für Vercel

Dieses Projekt ist ein einfacher Node.js-Server mit Express, der mehrere API-Endpunkte bereitstellt und eine lokale `config.json` parst.

## Endpunkte
- `GET /api/hello` – Gibt eine Begrüßung zurück
- `GET /api/config` – Gibt die Inhalte der lokalen `config.json` zurück
- `GET /api/time` – Gibt die aktuelle Zeit zurück

## Lokale Konfiguration
Die Datei `config.json` im Projektverzeichnis enthält Konfigurationen, die über den Endpunkt `/api/config` abgerufen werden können.

## Starten (lokal)
```bash
npm install
node index.js
```

## Deployment auf Vercel
1. Vercel CLI installieren (falls nicht vorhanden):
   ```bash
   npm install -g vercel
   ```
2. Projekt deployen:
   ```bash
   vercel
   ```

## Hinweise
- Die API ist für den Einsatz auf Vercel vorbereitet.
- Passe die Endpunkte und die `config.json` nach Bedarf an.
