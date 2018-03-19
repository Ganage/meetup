"use strict";

const http = require("http");
const https = require("https");
const url = require("url");
const fs = require("fs");
const uuidv4 = require("uuid/v4");

let connectionCount = 0;

const CONSUMER_KEY = "l3rsf0pa7db0mjvkpnltv48fvu";
const CONSUMER_SECRET = "9v4i46u7okuvtuj9rkiljpnu5m";
const REDIRECT_URI_ROOT = "http://localhost:8080/";

main();

function main() {
    console.log("Starting listen server");
    http.createServer((request, response) => {

        connectionCount++;
        console.log(`Connection ${connectionCount} from ${request.socket.address().address} to ${request.url}`);

        if (request.url.startsWith("/loggedin")) {
            handleLoggedIn(request, response);
        }
        else if (request.url.startsWith("/profile")) {
            handleProfile(request, response);
        }
        else {
            handleIndex(request, response);
        }
    }).listen(8080);
}

function serveFile(response, fileName, data) {
    let fileSize = fs.statSync(fileName).size;

    fs.readFile(fileName, (err, html) => {
        if (err) {
            console.log("err");
            response.writeHead(404);
            response.end(err);
        }
        else if (html) {

            if (data !== undefined) {
                html = formatString(html, data);
            }
            console.log(`Sending ${fileName}, ${fileSize} bytes`);
            response.writeHead(200, null, {
                "Content-Type": "text/html",
                "Content-Length": fileSize
            });
            response.end(html);
        }
    });
}

function formatString(text, object) {
    let newText = text.toString();
    for (let key of Object.keys(object)) {

        if (typeof(object[key]) === "object") {
            newText = formatString(newText, object[key]);
        }
        else {
            // console.log(`[[${key}]] = ${object[key]}`);
            newText = newText.split(`[[${key}]]`).join(object[key]);
        }
    }
    return newText;
}

function handleIndex(request, response) {
    const data = {} ;
    data.id = uuidv4();
    data.key = CONSUMER_KEY;
    data.secret = CONSUMER_SECRET;
    data.redirectUrl = REDIRECT_URI_ROOT;

    serveFile(response, "./index.html", data);
}

function handleLoggedIn(request, response) {
    var query = url.parse(request.url, true).query;

    if (query.code) {
        console.log(`User logged in via oauth, userId ${query.userId}, code ${query.code}`);
        getAccessToken(query, sendUserPage, response);
    }
    else {
        console.log(`Failed oauth, userId ${query.userId}, error ${query.error}`);
    }

}

function handleProfile(clientRequest, clientResponse) {
    var query = url.parse(clientRequest.url, true).query;
    
    let apiUri = `https://api.meetup.com/members/self?access_token=${query.access_token}`;
    const apiRequest = https.get(apiUri, apiResponse => {

        let data = "";
        apiResponse.on("data", (chunk) => {
            data += chunk;
        });

        apiResponse.on("end", (chunk) => {
            console.log("Profile:");
            console.log(data);
            serveFile(clientResponse, "./profile.html", JSON.parse(data));
        });

    }).on("error", (err) => {
        console.log(`Profile error: ${err.message}`);
    });
}

function sendUserPage(response, data) {
    if (data == undefined) {
        // Tell user it went wrong
    }
    else {
        serveFile(response, "./loggedin.html", data);
    }
}

function getAccessToken(query, sendUserPage, clientResponse) {
    console.log("Making HTTPS POST to oauth provider for access token");

    const body = `client_id=${CONSUMER_KEY}&client_secret=${CONSUMER_SECRET}&grant_type=authorization_code&redirect_uri=${REDIRECT_URI_ROOT}loggedin?userId=${query.userId}&code=${query.code}`;
    const options = {
        protocol: "https:",
        hostname: "secure.meetup.com",
        path: "/oauth2/access",
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Content-Length": Buffer.byteLength(body)
        }
    };
 
    const request = https.request(options, response => {
        let data = "";
        
        response.on("data", (chunk) => {
            data += chunk;
        });

        response.on("end", (chunk) => {
            console.log("Access token request response:");
            console.log(data);
            const pageData = JSON.parse(data);
            pageData.postBody = body;
            pageData.rawJson = data;
            sendUserPage(clientResponse, pageData);
        });
    })
    
    request.on("error", (err) => {
        console.log(`Access token request error: ${err.message}`);
    });

    request.write(body);
    request.end();
}