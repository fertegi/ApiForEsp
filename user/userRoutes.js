import { getOffersFromConfig } from "../services/marktguru.js";
import { getDatabase, getDeviceConfiguaration } from "../clients/mongoClient.js";


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

    app.get("/user/deviceConfiguration", async (req, res) => {
        const user = req.user;
        console.log(user);
        const deviceConfigurations = user.belongs.map(async (deviceId) => {
            const config = await getDeviceConfiguaration(deviceId);
            return {
                deviceId,
                config
            };
        });
        const configurations = await Promise.all(deviceConfigurations);
        console.log("Device Configurations:", configurations);

        if (!user) {
            return res.redirect('/user/login');
        }
        return res.render("users/deviceConfiguration", {
            user: user
        });
    });

}