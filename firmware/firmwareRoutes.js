import crypto from 'crypto';
import fetch from 'node-fetch';

const owner = process.env.FW_REPO_OWNER || "fertegi";
const repo = process.env.FW_REPO_NAME || "ESP32_YourWatcher";




// Ephemeral Tickets
const tickets = new Map(); // ticketId -> { assetUrl, expires }
const TICKET_TTL_MS = 60_0000; // 1 Minute


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
    console.log("Lade Asset herunter von:", assetUrl);
    console.log("Verwende Token:", token ? "✓ gesetzt" : "✗ fehlt");

    const response = await fetch(assetUrl, {
        headers: {
            "Authorization": `token ${token}`,
            "Accept": "application/octet-stream",
            "User-Agent": "ApiForEsp/1.0" // GitHub empfiehlt User-Agent
        }
    });
    console.log("GitHub Download Antwortstatus:", response.status);
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

function genTicketId() {
    return crypto.randomBytes(16).toString('hex');
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
                download_url: binAsset.url,
                size: binAsset.size,
                published_at: release.published_at,
                url: binAsset.url,
                sha256: hashText,
            });

        } catch (err) {
            console.error("Firmware-Fehler:", err.message);

            if (err.message.includes("GITHUB_TOKEN")) {
                return res.status(500).json({
                    error: "Token nicht konfiguriert. Siehe Dokumentation für Setup-Anweisungen."
                });
            }
            res.status(500).json({ error: `Firmware-Abruf fehlgeschlagen: ${err.message}` });
        }
    });
    app.get("/api/firmware/ticket", async (req, res) => {
        try {
            const release = await fetchLatestRelease();
            const { binAsset } = findReleaseAssets(release);
            const ticket = genTicketId();
            tickets.set(ticket, {
                assetUrl: binAsset.url,
                expires: Date.now() + TICKET_TTL_MS
            });
            res.json({
                ticket,
                download_url: `/api/firmware/download/${ticket}`
            });
        } catch (err) {
            console.error("Ticket-Fehler:", err.message);
            res.status(500).json({ error: `Ticket-Abruf fehlgeschlagen: ${err.message}` });
        }
    });

    app.get("/api/firmware/download/:ticket", async (req, res) => {
        const info = tickets.get(req.params.ticket);
        if (!info) return res.status(404).end();
        if (Date.now() > info.expires) {
            tickets.delete(req.params.ticket);
            return res.status(410).end(); // Gone
        }
        // Optional: Einmalig verbrauchen
        tickets.delete(req.params.ticket);


        try {
            const response = await downloadAsset(info.assetUrl);

            if (!response.ok) {
                const errorText = await response.text();
                console.error("Download-Fehler:", response.statusText, errorText);
                return res.status(502).json({
                    error: "GitHub Download fehlgeschlagen",
                    status: response.status,
                    message: response.statusText
                });
            };
            const contentLengtgh = response.headers.get('content-length');
            if (contentLengtgh) {
                res.setHeader('Content-Length', contentLengtgh);
            }
            res.setHeader('Content-Type', 'application/octet-stream');
            res.setHeader('Content-Disposition', 'attachment; filename="firmware.bin"');
            response.body.pipe(res);
        } catch (err) {
            console.error("Download-Fehler:", err.message);
            res.status(500).end();
        }
    });
}