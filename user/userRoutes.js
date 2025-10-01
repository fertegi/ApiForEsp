import { app } from "../index.js";



export function setupUserRoutes(app) {

    app.get("/user", (req, res) => {
        res.send("User endpoint is working");
    });


    app.post('/user/form', async (req, res) => {
        const deviceId = req.query.deviceId || 'defaultDevice';
        if (!deviceId) {
            return res.status(400).json({ error: 'Geräte-ID ist erforderlich.' });
        }
        try {
            const userData = req.body;
            // Hier können Sie die Logik zum Speichern der Benutzerdaten implementieren
            console.log('Empfangene Benutzerdaten:', userData);
            res.status(200).json({ message: 'Benutzerdaten erfolgreich gespeichert', data: userData });
        } catch (error) {
            console.error('Fehler beim Verarbeiten der Benutzerdaten:', error);
            res.status(500).json({ error: 'Fehler beim Verarbeiten der Benutzerdaten' });
        }
    });
}