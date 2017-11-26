'use strict';

// const PAGE_ACCESS_TOKEN    = process.env.PAGE_ACCESS_TOKEN;
// TODO: these token should be invisible "normally"
const PAGE_ACCESS_TOKEN = "EAACTtgbTPxgBAFh39tXgYLLwpK6mPHCnE9AEuETuHYIxXr5vvmmFrODgdC2ibtSB0yWsQD3HQGIa4oUanny6lhif3EX1vNar5b4C4zRw9lG0dBPIEBZAUZCV2MZA2tZANF50ZCEtXIMd3dpcHANIFOFZBWDvWZAOX4aZCiFlYhuOtcB1Yc2ADZAq5";
const APIAI_API_KEY     = "6db172e663ca431e95f9835768e63ab5";
const WWO_API_KEY       = "316d6757fba7430f901171934172611";
const WWO_HOST          = 'api.worldweatheronline.com';

// Imports dependencies and set up http server
const http       = require('http'),
      express    = require('express'),
      bodyParser = require('body-parser'),
      request    = require('request'),
      apiaiApp   = require('apiai')(APIAI_API_KEY, {
          language: 'fr'
      }),
      app        = express().use(bodyParser.json()); // creates express http server

// Sets server port and logs message on success
app.listen(process.env.PORT || 1337, () => console.log('webhook is listening'));

/* Handling all messages */
app.post('/webhook', (req, res) => {
    console.log("Webhook POST");
    console.log(req.body);
    if (req.body.object === 'page') {
        req.body.entry.forEach((entry) => {
            entry.messaging.forEach((event) => {
                if (event.message && event.message.text) {
                    sendMessage(event);
                }
            });
        });
        res.status(200).end();
    }
});

// Adds support for GET requests to our webhook
app.get('/webhook', (req, res) => {

    // Your verify token. Should be a random string.
    const VERIFY_TOKEN = "SuperBotNeverEverSeen";

    // Parse the query params
    let mode      = req.query['hub.mode'];
    let token     = req.query['hub.verify_token'];
    let challenge = req.query['hub.challenge'];

    // Checks if a token and mode is in the query string of the request
    if (mode && token) {

        // Checks the mode and token sent is correct
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {

            // Responds with the challenge token from the request
            console.log('WEBHOOK_VERIFIED');
            res.status(200).send(challenge);

        } else {
            // Responds with '403 Forbidden' if verify tokens do not match
            res.sendStatus(403);
        }
    }
});

app.post('/ai', (req, res) => {

    if (req.body.result.action === 'weather') {
        // Get the city and date from the request
        let city = req.body.result.parameters['geo-city']; // city is a required param
        // Get the date for the weather forecast (if present)
        let date = '';
        if (req.body.result.parameters['date']) {
            date = req.body.result.parameters['date'];
            console.log('Date: ' + date);
        }

        // Call the weather API
        callWeatherApi(city, date).then((output) => {
            // Return the results of the weather API to Dialogflow
            res.setHeader('Content-Type', 'application/json');
            res.send(JSON.stringify({'speech': output, 'displayText': output}));
        }).catch((error) => {
            // If there is an error let the user know
            res.setHeader('Content-Type', 'application/json');
            res.send(JSON.stringify({'speech': error, 'displayText': error}));
        });

    }
});

function sendMessage(event) {
    let sender = event.sender.id;
    let text   = event.message.text;

    let apiai = apiaiApp.textRequest(text, {
        sessionId: 'this_is_an_arbitrary_id', // use any arbitrary id,
        lang: "fr"
    });

    apiai.on('response', (response) => {
        let aiText = response.result.fulfillment.speech;

        request({
            url: 'https://graph.facebook.com/v2.6/me/messages',
            qs: {access_token: PAGE_ACCESS_TOKEN},
            method: 'POST',
            json: {
                recipient: {id: sender},
                message: {text: aiText}
            }
        }, (error, response) => {
            if (error) {
                console.log('Error sending message: ', error);
            } else if (response.body.error) {
                console.log('Error: ', response.body.error);
            }
        });
    });

    apiai.on('error', (error) => {
        console.log(error);
    });

    apiai.end();
}

function callWeatherApi(city, date) {
    return new Promise((resolve, reject) => {
        // Create the path for the HTTP request to get the weather
        let path = '/premium/v1/weather.ashx?format=json&num_of_days=1' +
            '&q=' + encodeURIComponent(city) + '&key=' + WWO_API_KEY + '&date=' + date + '&lang=fr';
        console.log('API Request: ' + WWO_HOST + path);
        // Make the HTTP request to get the weather
        http.get({host: WWO_HOST, path: path}, (res) => {
            let body = ''; // var to store the response chunks
            res.on('data', (d) => {
                body += d;
            }); // store each response chunk
            res.on('end', () => {

                console.log("here");
                console.log(JSON.parse(body)['data']);

                // After all the data has been received parse the JSON for desired data
                let response          = JSON.parse(body);
                let forecast          = response['data']['weather'][0];
                let location          = response['data']['request'][0];
                let conditions        = response['data']['current_condition'][0];
                let currentConditions = conditions['weatherDesc'][0]['value'];
                // Create response
                let output            = `La météo à ${location['query']} est qualifiée de "${currentConditions}" avec comme température max ${forecast['maxtempC']}°C et comme température min ${forecast['mintempC']}°C le ${forecast['date']} ! ;-)`;
                // Resolve the promise with the output text
                console.log(output);
                resolve(output);
            });
            res.on('error', (error) => {
                reject(error);
            });
        });
    });
}