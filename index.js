const slackbot = require('slackbots');
const enigma = require('enigma.js');
const WebSocket = require('ws');
const qixSchema = require('./schemas/qix/3.1/schema.json');
const logger = require('winston');
const Q = require('q');


const fs = require('fs');
const path = require('path');

const certPath = '/Users/kop/Dev/slack_bot/certs/rd-kop.rdlund.qliktech.com';
const senseHost = "rd-kop-win12.rdlund.qliktech.com";
const prefix = "/slack/";

var bot = new slackbot({
    token: "xoxb-144199859111-ZaORzLaMvr1QElWTco726II1",
    name: "QlikBot"
});

var params = { icon_emoji: ':qlik:' };

bot.on('start', function() {
    logger.log('info', 'Bot started');
});

bot.on('message', function(data) {
    if (data.bot_id) {
        return;
    }
    if (data.type === "message") {
        console.log("data", data);
        parse(data);
    }
});


function parse(data) {

    logger.log('message', data);

    var user = bot.users.filter(function(u) {
        return u.id === data.user;
    });

    var group = bot.groups.filter(function(u) {
        return u.id === data.channel;
    });
    group = group[0] ? group[0] : null;

    if (!user || user.length === 0) {
        logger.log("no user found!", data );
        return;
    }

    var username = user[0].name;

    if (data.text.startsWith("whoami")) {
        bot.postMessage(data.channel, "Hi, you are " + user[0].real_name, params);
        return;
    }

    if (data.text.startsWith("help")) {
        bot.postMessage(data.channel, "Feature coming soon");
        console.log("user:", data.user);
        console.log("group:", data.channel);
        return;
    }

    if(data.text.startsWith("list-apps")) {
        getApps(function(apps, err) {
            if(err) {
                bot.postMessage(data.channel, err);
            }
            var appList = appList(user[0].real_name, apps);
            appList.attachments.push({
                "fallback": "Required plain-text summary of the attachment.",
                "color": "#36a64f",
                "pretext": "",
                "author_name": "",
                "fields": [{
                    "title": "Current Active app",
                    "value": appUser[username] ? appUser[username] : "None",
                    "short": false
                }]
            });
            bot.postMessage(data.channel, appList);
        });
        //bot.postMessage(data.channel, appList1);
        return;
    }
}

var qixSession = {
    host: 'rd-kop-win12.rdlund.qliktech.com',
    route: 'app/engineData',
    port: 4747,
    unsecure: 'false',
    disableCache: true
}

function qixConfig() {
    var qixConn = {
        schema: qixSchema,
        session: qixSession,
        createSocket(url) {
            console.log("Connected: ", url);
            return new WebSocket(url, {
                ca: [fs.readFileSync(path.resolve(certPath, 'root.pem'))],
                key: fs.readFileSync(path.resolve(certPath, 'client_key.pem')),
                cert: fs.readFileSync(path.resolve(certPath, 'client.pem')),
                headers: {
                    'X-Qlik-User': 'UserDirectory=QTSEL;UserId=KOP'
                },

            });
        }
    };
    return qixConn;
}

function qixEnigmaService() {
    var deferred = Q.defer();

    var conConfig = qixConfig();
    enigma.getService('qix', conConfig).then((qix) => {
        console.log('Connected to QIX Service');
        deferred.resolve(qix.global);
    }).catch((err) => {
        console.log(`Error when connecting to qix service: ${err}`);
        deferred.reject(err);
    });
    return deferred.promise;
}

function getApps(callback) {
    qixEnigmaService().then(function(qix) {
        return qix.getDocList();
    }).then( function( docList ) {
        callback( docList, null );
    }).fail(function(error) {
        callback(null, error);
    }).done();
}

function appList(username, apps) {
    var fields = apps.map(function(a) {
        return { "title": a.qDocId, "value": "<https://" + senseHost + prefix + "sense/app/" + a.qDocId + "|" + a.qDocName + ">", "short": false };
    });
    return {
        "icon_emoji": ':qlik:',
        "response_type": "in_channel",
        "text": username + ", these the apps you have access to:",
        "attachments": [{
            "fallback": "Required plain-text summary of the attachment.",
            "color": "#36a64f",
            "pretext": "Your are logged in as " + username,
            "author_name": "",
            "fields": fields,
            "image_url": "",
            "thumb_url": "",
            "footer": "Qlik Sense API",
            "footer_icon": "https://platform.slack-edge.com/img/default_application_icon.png",
            "ts": new Date().getTime()
        }]
    };
}
