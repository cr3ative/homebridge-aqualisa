This is a placeholder while I try and make my internet-enabled shower smart. I deserve this dumb future.

# API Details and Postman Collection

I've put together a [postman collection for the Aqualisa API here](aqualisa.json) - remember to set the variables in the parent collection for the requests to work.

The API is based on Dingo. The root runs Nodes Backend: https://github.com/nodes-php/backend

Translations for the app come in via NStack: https://github.com/nodes-php/nstack

Here's en-GB at time of writing: https://cdn-raw.vapor.cloud/nstack/data/localize-publish/publish-100-IOMehgAi_IXGTIdkG1j.json - you can see some interesting not-yet-live features in there, such as notifications for when the shower becomes available, if someone else is using it when you want a shower!

## Pretending to be the app to run a bath

The sequence the app performs to start a shower/bath is:

* `GET onOff` - Shower occupancy check
* `PATCH timer` - Sends `time_set=300` for example
* `GET timer`
* `PATCH onOff` - Sends `in_use=1&user_profile_id=1234` for example
* `GET onOff`
* `PATCH temperature` - Sends `temperature=5100` for example
* `GET temperature`
* `PATCH flow` - Sends `flow=Max` for example
* `GET flow`
* `PATCH outlet` - Sends `outlet=B` for divert
* `GET outlet`

To stop the session, only one command is needed

* `PATCH onOff` - Sends `in_use=0`

Interesting upshots of this:

* The `PATCH` followed by `GET` sequence is strange and unnecessary, as `PATCH` returns the state. Only one command doesn't return the desired state immediately, and that's `onOff` - the query is live, so with the shower taking a few seconds to start, the immediate reply is `in_use: false`; if you ask again a couple of seconds later, you get `in_use: true`.
* The occupancy check is app-only. It isn't enforced by the server. With direct API access you can modify a running shower started by someone that isn't you, which is very handy.
* Speaking of API nonsense, the app incorrectly allows you to set flow rate on the "divert" option, as it has no concept of a bath. Just A or B valves. This means with a bath filler, you can run it at Eco speed. Not sure why you'd want to, but hey, nobody's stopping you.

## Unanswered questions

* How do firmware updates work?

## Endpoints

Captured with Charles Proxy and looking at strings in the APK

The useful ones are in the Postman collection, but this is probably all of the major ones

### GET

```
GET homes/{accesscode}?include=users,showers
GET homes/{accesscode}?include=showers
GET marketing/banners/active
GET settings
GET homes/{home_id}/dashboard
GET homes/{home_id}/dashboard/stats
GET users/homes?include=users,showers
GET marketing/news-items
GET showers/{showerId}/flow
GET showers/{showerId}/onOff
GET showers/{serialNumber}/info
GET showers/{showerId}/outlet
GET showers/{showerId}/settings
GET showers/{showerId}/temperature
GET showers/{showerId}/timer
GET users/me
GET users/profiles/{user_profile_id}/dashboard
GET users/is-email-available
```

### POST

```
POST homes/{home_id}/showers
POST homes?include=users,showers
POST users/profiles
POST users/profiles/{user_profile_id}
POST homes/{accesscode}/users?include=users,showers
POST users/login
POST showers/{serialNumber}/register
POST users/init-password-reset
POST users
```

### DELETE

```
DELETE users/profiles/{user_profile_id}/image
DELETE showers/{shower_id}
DELETE users/profiles/{user_profile_id}
DELETE homes/{home_id}/users
```

### PATCH

```
PATCH showers/{showerId}/flow
PATCH showers/{showerId}/onOff
PATCH showers/{showerId}/outlet
PATCH showers/{showerId}/temperature
PATCH showers/{showerId}/timer
PATCH homes/{home_id}?include=users,showers
PATCH users/password
PATCH showers/{shower_id}
```

## Other URLs from the app

Probably to do with setting the WiFi up. Haven't looked in to it.

```
GET http://192.168.4.1/connStatus?apOff=1               (connection status and serial number)
POST http://192.168.4.1/updateMQTTDetails?Var1=XX       (interesting - local MQTT or proxy it?)
POST http://192.168.4.1/updateDetails?Var1=XX&Var2=XX   (base64 encoded)
```

# Shower controller network traffic

Captured with Wireshark

## DNS

* `aqualisa-mqtt.like.st` is looked up by the controller. Current response is `A aqualisa-mqtt.like.st CNAME k8s.aqualisa.like.st A 52.51.16.1 A 54.78.109.102`
* `aqualisa.like.st` (main API)
* `pool.ntp.org` (naughty, should be vendor-specific)

## MQTT

The MQTT server it connects to is `aqualisa-mqtt.like.st` on port `8883`. It requires a client certificate to connect (so I haven't yet), and the server emits a self-signed certificate.

## Mystery Port

`49153` is open on the controller on UDP. Sending it data seems to cause it to immediately re-request the current NTP time - maybe it sends an MQTT message?

There's this: https://github.com/nodes-android/aqualisa-socket-test - which suggests it could reply back to the same port, but I tried talking to it with YAT (https://sourceforge.net/projects/y-a-terminal/) and it wasn't being very chatty.
