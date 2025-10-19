import { getDatabase } from "../clients/mongoClient.js";
import bcrypt from "bcryptjs";
import { generateToken, invalidateToken } from "../middlewares/authMiddleware.js";


export function setupAuthRoutes(app) {


    // GET für Anzeige des Loginformulars
    app.get("/user/login", (req, res) => {
        if (req.session.user) {
            return res.redirect('/user/profile');
        }
        res.render('auth/login', {
            error: req.session.error,
            success: req.session.success
        });
        // Session-Nachrichten löschen nach dem Anzeigen
        delete req.session.error;
        delete req.session.success;
    });
    // POST für Verarbeitung des Logins
    app.post("/user/login", async (req, res) => {
        try {
            const { username, password } = req.body;
            if (!username || !password) {
                req.session.error = "Benutzername und Passwort sind erforderlich";
                return res.redirect('/user/login');
            }

            const database = await getDatabase();
            const usersCollection = database.collection("users");
            const user = await usersCollection.findOne({ username });

            if (!user) {
                req.session.error = "Ungültige Anmeldedaten";
                return res.redirect('/user/login');
            }

            const passwordMatch = await bcrypt.compare(password, user.password);
            if (!passwordMatch) {
                req.session.error = "Ungültige Anmeldedaten";
                return res.redirect('/user/login');
            }

            // Erfolgreicher Login
            const token = generateToken(user);

            // Token in Session speichern
            req.session.token = token;
            req.session.user = {
                username: user.username,
                role: user.role
            };

            // Je nach Rolle unterschiedliches Redirect
            if (user.role === 'admin') {
                return res.redirect('/user/profile');
            } else {
                return res.redirect('/user/profile');
            }
        } catch (error) {
            console.error("Login-Fehler:", error);
            req.session.error = "Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.";
            res.redirect('/user/login');
        }
    });

    // Logout-Route
    app.get("/user/logout", (req, res) => {
        // Token invalidieren, falls vorhanden
        if (req.session.token) {
            invalidateToken(req.session.token).catch(err =>
                console.error("Fehler beim Invalidieren des Tokens:", err));
        }

        // Session zerstören
        req.session.destroy(err => {
            if (err) {
                console.error("Fehler beim Logout:", err);
            }
            res.redirect('/user/login');
        });
    });

}