
import { createClient } from 'hafas-client'
// import { profile as bvgProfile } from 'hafas-client/p/bvg/index.js'

const stopId = "900079201"
const duration = 10
const userAgent = "bumaye@zoho.eu"
// const client = createClient(bvgProfile, userAgent)
// const res = await client.departures(stopId, { when: new Date(), duration: duration })
// const res = await fetch(`https://v6.vbb.transport.rest/stops/${stopId}/departures?duration=${duration}`)
const res = await fetch(`https://v6.vbb.transport.rest/lines?operator=796&variants=false`)


const data = await res.json()
console.log(data)

