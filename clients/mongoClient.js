import { MongoClient, ServerApiVersion } from "mongodb";
import { apiUrls } from "../apiUrls.js";

class MongoDBConnection {
    constructor() {
        this.client = null;
        this.db = null;
        this.isConnecting = false;
        this.connectionPromise = null;
    }

    async connect() {
        // Wenn bereits verbunden, Database zurückgeben
        if (this.db && this.client?.topology?.isConnected()) {
            return this.db;
        }

        // Wenn gerade dabei ist zu verbinden, auf bestehende Promise warten
        if (this.isConnecting && this.connectionPromise) {
            return this.connectionPromise;
        }

        this.isConnecting = true;

        try {
            this.connectionPromise = this._establishConnection();
            this.db = await this.connectionPromise;
            return this.db;
        } catch (error) {
            console.error('MongoDB Verbindungsfehler:', error);
            this.cleanup();
            throw error;
        } finally {
            this.isConnecting = false;
        }
    }

    async _establishConnection() {
        // Alte Verbindung cleanup falls vorhanden
        if (this.client) {
            try {
                await this.client.close();
            } catch (error) {
                console.warn('Fehler beim Schließen der alten Verbindung:', error);
            }
        }
        // Neue Verbindung für Vercel optimiert
        this.client = new MongoClient(apiUrls.mongoDBUri, {
            serverApi: {
                version: ServerApiVersion.v1,
                strict: true,
                deprecationErrors: true,
            },
            // Vercel-optimierte Einstellungen
            maxPoolSize: 5, // Kleiner Pool für Serverless
            serverSelectionTimeoutMS: 5000, // 5 Sekunden Timeout
            socketTimeoutMS: 45000, // 45 Sekunden Socket Timeout
            maxIdleTimeMS: 30000, // Verbindungen nach 30s Idle schließen
            retryWrites: true,
            retryReads: true,
            connectTimeoutMS: 10000, // 10 Sekunden Connection Timeout
        });

        await this.client.connect();

        // Test der Verbindung
        await this.client.db("admin").command({ ping: 1 });

        console.log("MongoDB erfolgreich verbunden");
        return this.client.db("ApiForEsp");
    }

    cleanup() {
        this.client = null;
        this.db = null;
        this.isConnecting = false;
        this.connectionPromise = null;
    }

    async disconnect() {
        if (this.client) {
            try {
                await this.client.close();
                console.log("MongoDB Verbindung geschlossen");
            } catch (error) {
                console.warn('Fehler beim Schließen der MongoDB Verbindung:', error);
            }
        }
        this.cleanup();
    }

    // Health Check für die Verbindung
    isConnected() {
        return this.client?.topology?.isConnected() || false;
    }
}

// Singleton Instanz
const mongoConnection = new MongoDBConnection();

// Export der Hauptfunktion
export async function getDatabase() {
    return await mongoConnection.connect();
}

// Hilfsfunktionen exportieren
export function isMongoConnected() {
    return mongoConnection.isConnected();
}

export async function disconnectMongo() {
    return await mongoConnection.disconnect();
}

export async function getAllDevices() {
    const db = await getDatabase();
    const deviceConfigurations = db.collection("deviceConfigurations");
    const devices = await deviceConfigurations
        .find({}, { projection: { deviceId: 1, _id: 0 } })
        .toArray();
    return devices;
}


export async function getDeviceConfiguaration(deviceId) {
    const db = await getDatabase();
    const deviceConfigurations = db.collection("deviceConfigurations");
    const config = await deviceConfigurations.findOne({
        deviceId:
            deviceId
    });
    return config;
}

// Graceful Shutdown für Vercel
process.on('SIGTERM', async () => {
    console.log('SIGTERM empfangen, MongoDB Verbindung wird geschlossen...');
    await disconnectMongo();
});