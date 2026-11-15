import { getCachedByPattern } from "../../../clients/cacheClient.js";


async function _getImageOfOffers(offers) {
    const className = "col pic"
    for (const [market, items] of Object.entries(offers)) {
        items.forEach(async item => {
            try {
                // const response = await fetch(item.img_url)
                // console.log(response)
                console.log(item.img_url)
            }
            catch (error) {
                console.log("fetch did not work", error)
            }
        });
        break;
    }

}


export async function getRenderItem(name = "", deviceId) {
    const query = new RegExp(`device:.*${name}.*${deviceId}`)

    try {
        const cached_items = await getCachedByPattern(query)

        let offers = cached_items[0]
        _getImageOfOffers(offers)

        return offers
    } catch (error) {
        console.error(error)
        return [];
    }
}


