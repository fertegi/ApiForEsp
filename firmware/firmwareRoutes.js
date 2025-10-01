import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto'; // neu: für SHA256-Prüfung

const owner = process.env.FW_REPO_OWNER || "fertegi";
const repo = process.env.FW_REPO_NAME || "ESP32_YourWatcher";

function validateGitHubToken() {
    if (!process.env.GITHUB_TOKEN) {
        throw new Error("GITHUB_TOKEN nicht gesetzt");
    }
    return process.env.GITHUB_TOKEN;
}

async function fetchLatestRelease() {
    const token = validateGitHubToken();

    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/latest`, {
        headers: { "Authorization": `token ${token}` }
    });

    if (!response.ok) {
        throw new Error(`GitHub API Fehler: ${response.statusText}`);
    }

    return await response.json();
}

async function downloadAsset(assetUrl) {
    const token = validateGitHubToken();

    const response = await fetch(assetUrl, {
        headers: {
            "Authorization": `token ${token}`,
            "Accept": "application/octet-stream"
        }
    });

    if (!response.ok) {
        throw new Error(`Asset Download Fehler: ${response.statusText}`);
    }

    return response;
}

function findReleaseAssets(release) {
    const binAsset = release.assets.find(a => a.name.endsWith(".bin"));
    const hashAsset = release.assets.find(a => a.name.endsWith(".sha256"));

    if (!binAsset || !hashAsset) {
        throw new Error("Benötigte Assets (.bin und .sha256) nicht gefunden");
    }

    return { binAsset, hashAsset };
}

async function downloadFirmware(url, filename = "firmware.bin") {
    // Lade das Asset (GitHub Asset-URL) herunter und schreibe es lokal in ./firmware/<filename>
    const response = await fetch(url, {
        headers: {
            "Authorization": `token ${process.env.GITHUB_TOKEN}`,
            "Accept": "application/octet-stream"  // Wichtig für den Download
        }
    });

    if (!response.ok) {
        throw new Error(`Fehler beim Herunterladen der Firmware: ${response.statusText}`);
    }

    // Stelle sicher, dass das Zielverzeichnis existiert
    const dir = path.resolve(process.cwd(), "releases");
    await fs.mkdir(dir, { recursive: true });

    // Buffer erhalten und als Datei schreiben
    const buffer = Buffer.from(await response.arrayBuffer());
    const outPath = path.join(dir, filename);
    await fs.writeFile(outPath, buffer);

    return outPath;
}

// neu: Hilfsfunktionen
async function fileExists(p) {
    try {
        await fs.access(p);
        return true;
    } catch {
        return false;
    }
}

async function computeSha256(p) {
    const data = await fs.readFile(p);
    return crypto.createHash('sha256').update(data).digest('hex');
}

async function cleanReleasesDir(dir) {
    try {
        await fs.mkdir(dir, { recursive: true });

        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            await fs.rm(fullPath, { recursive: true, force: true });
        }

        console.log(`Releases-Verzeichnis bereinigt: ${entries.length} Elemente entfernt`);
    } catch (error) {
        if (error.code !== 'ENOENT') {
            console.warn(`Fehler beim Bereinigen von ${dir}:`, error.message);
        }
    }
}

export function setupFirmwareRoutes(app) {

    app.get("/api/firmware", (req, res) => {
        res.send("Firmware endpoint is working");
    });



    app.get("/api/firmware/latest", async (req, res) => {
        try {
            const release = await fetchLatestRelease();
            const { binAsset, hashAsset } = findReleaseAssets(release);

            // Hash aus der .sha256 Datei holen
            const hashResponse = await downloadAsset(hashAsset.url);
            const hashText = (await hashResponse.text()).trim().split(' ')[0];

            const filename = `${release.tag_name}.bin`;
            const dir = path.resolve(process.cwd(), "releases");
            const localPath = path.join(dir, filename);

            // Prüfe ob lokale Datei existiert und korrekt ist
            if (await fileExists(localPath)) {
                try {
                    const localHash = await computeSha256(localPath);
                    if (localHash === hashText) {
                        return res.json({
                            version: release.tag_name,
                            url: binAsset.url,
                            localPath,
                            sha256: hashText,
                            cached: true
                        });
                    }
                } catch (e) {
                    console.warn("Lokale Firmware-Prüfung fehlgeschlagen:", e.message);
                }
            }

            // Download erforderlich: Verzeichnis bereinigen und neue Datei laden
            await fs.mkdir(dir, { recursive: true });
            await cleanReleasesDir(dir);

            const downloadedPath = await downloadFirmware(binAsset.url, filename);

            res.json({
                version: release.tag_name,
                url: binAsset.url,
                localPath: downloadedPath,
                sha256: hashText,
                cached: false
            });

        } catch (err) {
            console.error("Firmware-Fehler:", err.message);

            if (err.message.includes("GITHUB_TOKEN")) {
                return res.status(500).json({
                    error: "GitHub Token nicht konfiguriert. Siehe Dokumentation für Setup-Anweisungen."
                });
            }

            res.status(500).json({ error: `Firmware-Abruf fehlgeschlagen: ${err.message}` });
        }
    });
}