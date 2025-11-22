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

            res.json({
                version: release.tag_name,
                download_url: binAsset.browser_download_url, // Direkte öffentliche URL
                size: binAsset.size,
                published_at: release.published_at,
                url: binAsset.url,
                sha256: hashText,
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