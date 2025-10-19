import { getDatabase } from "../clients/mongoClient.js";
import bcrypt from "bcryptjs";
import { invalidateToken, loginUser } from "../middlewares/authMiddleware.js";
import cookieParser from 'cookie-parser';

export function setupAuthRoutes(app) {

    app.use(cookieParser());
    // GET für Anzeige des Loginformulars
    app.get("/user/login", (req, res) => {
        const token = req.cookies?.auth_token;
        if (token) {
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                return res.redirect('/user/profile');
            } catch (err) {
                res.clearCookie('auth_token');
            }
        }
        const error = req.cookies.flash_error;
        const success = req.cookies.flash_success;
        // Cookies löschen
        if (error) res.clearCookie('flash_error');
        if (success) res.clearCookie('flash_success');
        res.render('auth/login', {
            error: error || req.query.error,
            success: success || req.query.success
        });
    });
    // POST für Verarbeitung des Logins
    app.post("/user/login", async (req, res) => {
        try {
            const { username, password } = req.body;
            if (!username || !password) {
                res.cookie('flash_error', "Benutzername und Passwort sind erforderlich", {
                    maxAge: 5000, // 5 Sekunden
                    httpOnly: true
                }); return res.redirect('/user/login');
            }
            // Rest des Codes mit Cookie-Fehlermeldungen

            const database = await getDatabase();
            const usersCollection = database.collection("users");
            const user = await usersCollection.findOne({ username });

            if (!user) {
                res.cookie('flash_error', "Ungültige Anmeldedaten", { maxAge: 5000, httpOnly: true });
                return res.redirect('/user/login');
            }
            const passwordMatch = await bcrypt.compare(password, user.password);
            if (!passwordMatch) {
                res.cookie('flash_error', "Ungültige Anmeldedaten", { maxAge: 5000, httpOnly: true });
                return res.redirect('/user/login');
            }

            loginUser(res, user);

            // Je nach Rolle unterschiedliches Redirect
            if (user.role === 'admin') {
                return res.redirect('/user/profile');
            } else {
                return res.redirect('/user/profile');
            }
        } catch (error) {
            console.error("Login-Fehler:", error);
            res.cookie('flash_error', "Ein Fehler ist aufgetreten", { maxAge: 5000, httpOnly: true });
            return res.redirect('/user/login');
        }
    });

    // Logout-Route
    app.get("/user/logout", (req, res) => {
        // Token invalidieren, falls vorhanden
        const token = req.cookies?.auth_token;

        if (token) {
            invalidateToken(token).catch(err =>
                console.error("Fehler beim Invalidieren des Tokens:", err));

            res.clearCookie('auth_token');
        }

        res.redirect('/user/login');
    });
}