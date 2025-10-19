
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
        })


    });

    app.get("/user/offers", async (req, res) => {
        try {
            const { deviceId, config } = req;
            if (!deviceId || deviceId === 'defaultDevice') {
                return res.status(400).json({ error: 'Geräte-ID ist erforderlich.' });
            }
            if (config.error) {
                return res.status(500).json(config);
            }
            const offers = await getOffersFromConfig(config);
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