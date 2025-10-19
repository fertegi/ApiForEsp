import session from 'express-session';

// Session-Middleware für Express
export const sessionMiddleware = session({
    secret: process.env.SESSION_SECRET || 'unsicheres-session-geheimnis',
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000 // 24 Stunden
    }
});