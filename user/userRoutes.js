import { getOffersFromConfig } from "../services/marktguru.js";
import { getDatabase } from "../clients/mongoClient.js";


export function setupUserRoutes(app) {

    app.get("/user", (req, res) => {
        res.send("User endpoint is working");
    });

    app.get("/user/profile", (req, res) => {
        const user = req.user;

        if (!user) {
            return res.redirect('/user/login');
        }

        res.render("users/profile", {
            user: user,
            status: "Top"
        });
    });

    app.get("/user/offers", async (req, res) => {
        try {
            const user = req.user;
            if (!user) {
                return res.redirect('/user/login');
            }

            const database = await getDatabase();
            const usersCollection = database.collection("users");
            const deviceCollection = database.collection("deviceConfigurations");
            const userDB = await usersCollection.findOne({ id: user.id });

            if (!userDB) {
                return res.redirect('/user/login');
            }

            // Annahme: Ein Benutzer ist mit genau einem Gerät verbunden
            const deviceId = userDB.belongs[0] || {};
            const deviceConfig = await deviceCollection.findOne({ _id: deviceId });
            if (!deviceConfig) {
                return res.status(500).json({ error: 'Gerätekonfiguration nicht gefunden.' });
            }
            const offers = await getOffersFromConfig(deviceConfig);
            if (!offers || offers.length === 0) {
                return res.status(404).json({ message: 'Keine Angebote in der Konfiguration gefunden.' });
            }
            res.json(offers);
        } catch (error) {
            console.error('Fehler beim Abrufen der Ergebnisse:', error);
            res.status(500).json({ error: 'Fehler beim Abrufen der Ergebnisse.' });
        }
    });
}