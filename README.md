This is a placeholder while I try and make my internet-enabled shower smart. I deserve this dumb future.

# API Notes

API appears to be https://github.com/dingo/api based on the error code
Base URL is https://aqualisa.like.st/api/ 

Making blind requests until it works:

```bash
curl -X GET -H "Accept: application/vnd.nodes.v1+json;" https://aqualisa.like.st/api/
{"message":"Missing [N-Meta] header","code":400}%  
```

```bash
curl -X GET -H "Accept: application/vnd.nodes.v1+json;" -H "N-Meta: android;1.0.1" https://aqualisa.like.st/api/
{"message":"Environment is not supported, should be: local,development,staging,production","code":400}% 
```

```bash
curl -X GET -H "Accept: application/vnd.nodes.v1+json;" -H "N-Meta: android;production; (1.0.1)" https://aqualisa.like.st/api/
{"message":"Missing device os version","code":400}%
```

```bash
curl -X GET -H "Accept: application/vnd.nodes.v1+json;" -H "N-Meta: android;production;28; (1.0.1)" https://aqualisa.like.st/api/
{"message":"Missing device","code":400}%
```

```bash
curl -X GET -H "Accept: application/vnd.nodes.v1+json;" -H "N-Meta: android;production;28;pie; (1.0.1)" https://aqualisa.like.st/api/
{"message":"404: Not Found","code":500}%  
```

Wheyyyy. Nice of it to tell us what to send it.

Let's try a dingo URL we know of:

```bash
curl -X GET -H "Accept: application/vnd.nodes.v1+json;" -H "N-Meta: android;production;28;pie; (1.0.1)" https://aqualisa.like.st/api/users
{"message":"405: Method Not Allowed","code":500}%  
```

Okay, that's a valid path. Let's find the rest in the Android APK.

# Endpoints

Found interacting via `GET POST DELETE PATCH` verbs:

## GET

```
GET homes/{accesscode}?include=users,showers
GET homes/{accesscode}?include=showers
GET marketing/banners/active
GET settings
GET homes/{home_id}/dashboard
GET homes/{home_id}/dashboard
GET homes/{home_id}/dashboard/stats
GET users/homes?include=users,showers
GET marketing/news-items
GET http://192.168.4.1/connStatus?apOff=1
GET showers/{showerId}/flow
GET showers/{showerId}/onOff
GET showers/{serialNumber}/info
GET showers/{showerId}/outlet
GET showers/{showerId}/settings
GET showers/{showerId}/temperature
GET showers/{showerId}/timer
GET users/me
GET users/profiles/{user_profile_id}/dashboard
GET users/profiles/{user_profile_id}/dashboard
GET users/is-email-available
```

## POST

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

## DELETE

```
DELETE users/profiles/{user_profile_id}/image
DELETE showers/{shower_id}
DELETE users/profiles/{user_profile_id}
DELETE homes/{home_id}/users
```

## PATCH

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