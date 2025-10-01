const owner = "fertegi";
const repo = "ESP32_YourWatcher";

export function setupFirmwareRoutes(app) {

    app.get("/api/firmware", (req, res) => {
        res.send("Firmware endpoint is working");
    });

    app.get("/api/firmware/version", async (req, res) => {
        try {
            // Prüfe, ob der Token gesetzt ist
            if (!process.env.GITHUB_TOKEN) {
                // Kurze Log-Ausgabe für Entwickler
                console.warn("GITHUB_TOKEN nicht gesetzt. Lokal: .env + dotenv, Vercel: Project Settings -> Environment Variables oder 'vercel env add'.");
                return res.status(500).json({
                    error: "GITHUB_TOKEN nicht gesetzt. Lokal .env anlegen (z.B. GITHUB_TOKEN=...) und dotenv in Ihrem Startskript laden; in Vercel: Project Settings → Environment Variables oder 'vercel env add GITHUB_TOKEN production'."
                });
            }

            const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/latest`, {
                headers: { "Authorization": `token ${process.env.GITHUB_TOKEN}` }
            });

            const data = await response.json();

            // Hole die Assets (bin und sha256)
            const binAsset = data.assets.find(a => a.name.endsWith(".bin"));
            const hashAsset = data.assets.find(a => a.name.endsWith(".sha256"));

            if (!binAsset || !hashAsset) {
                return res.status(404).json({ error: "Firmware assets not found" });
            }

            // Verwende die GitHub API URL statt browser_download_url
            const hashResponse = await fetch(hashAsset.url, {
                headers: {
                    "Authorization": `token ${process.env.GITHUB_TOKEN}`,
                    "Accept": "application/octet-stream"  // Wichtig für den Download
                }
            });
            const hashText = await hashResponse.text();

            res.json({
                version: data.tag_name,
                url: binAsset.url,
                sha256: hashText.trim(),
            });

        } catch (err) {
            console.error(err);
            res.status(500).json({ error: "Firmware check failed" });
        }
    });
}