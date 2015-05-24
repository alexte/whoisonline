/*
 * WhoisOnline Node Server
 */

var debug=1;
var config={};

var fs = require('fs');
var ini = require('ini');

var express = require('express');
var app = express();
var path = require('path');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');

var Session = require('./libs/session.js');
var session = new Session();
var db=false;

// ------------ startup serializer
function run_serialized(f)
{
    var i=0;

    function run_next()
    {
	i++;
	f[i](run_next);
    }

    f[0](run_next);
}

run_serialized([read_config,parse_arguments,db_init,run]);

// -------------- logfile

function logdebug()
{
    if (debug>0) console.log.apply(null,arguments);
}

// ------------ read config
function read_config(next)
{
    logdebug("Reading Config");
    var content=fs.readFile('wio.config', 'utf8',function (err,data) {
	if (err) console.log("cannot open config.json");
	else 
	try { config=ini.parse(data); } catch(e) { console.log("error parsing config file "+e); }
        next();
    });
}

// ------------ argument parsing
function parse_arguments(next)
{
	// TODO
    logdebug("Parsing Arguments");
    next();
}

function valid_username(w)
{
    return w.match(/^[a-zA-Z0-9.#$%&*+/=?^_~-]+@[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)+$/);
}

// ------------ db init
function db_init(next)
{
    if (!config.db_module || config.db_module.length<=0) 
    { console.log("db_module has to be set in config file"); next(); }
    else
    {
    	logdebug("Init DB: "+config.db_module);

    	if (!fs.existsSync("./libs/"+config.db_module+".js"))
        { console.log("db_module does not exist"); next(); }
	else
	{
	    var DB=require("./libs/"+config.db_module+".js");
	    db=new DB(config);
            next();
	}
    }
}

// ------- spooler

function spool(from,to,type,data)
{
    // TODO
	// save to "from" queue 
	// save to database for "from"
	// push to "to" queue 
	// save to database for "to"
}

function queue_to(msg)
{
}

function queue_from(msg)
{
}

// ------ clientapi functions
function ca_login(req,res)
{
    var username=false;
    
    if (req.body.username && req.body.password)
    {
	username=req.body.username;
	if (db.check_login_password(username,req.body.password, function(u)
	    {
		if (!u) { res.send({result:401, data:"username or password wrong"}); return; }
		session.init_session(req,res);
		req.session.username=u.username;
		res.send({result:200, data:"OK"});
	    }));
    }
    else { res.send({result:400, data:"invalid call"}); }
		// TODO: throtteling for login attempts
}

function ca_logout(req,res)
{
    session.remove_session(req.session);
    res.send({result:200, data:"OK"});
}

function ca_start(req,res)
{
    var r={ result:200, now: new Date() };

    r.username=req.session.username;
    // r.fullname=get_fullname_by_username(req.session.username));

    res.send(r);
}

function ca_search_user(req,res)
{
    var sw=req.query.search;
    if (!sw) { res.send({result:400, data:"invalid call (s)"}); return; } 

    r={result:200, userlist:[] };
    if (valid_username(sw)) 
    {
	r.userlist[0]={};
	r.userlist[0].username=sw;
    }
    res.send(r);
}

function ca_invite(req,res)
{
    var rec=req.body.recipient;
    if (!rec) { res.send({result:400, data:"invalid call"}); return; } 

    spool(req.session.username,rec,"invite");

    res.send({result:200, data:"sent" });
}

// ---- express middleware modules
app.use(cookieParser());

app.use(session.check_session);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

// ------- webclient urls
app.use('/css', express.static('../webclient/css'));

app.all("/clientapi/:cmd",function (req,res) { 
    if (!req.params.cmd) { res.send({ result:404, data: 'missing command'}); return; }
    if (req.params.cmd=="login") { ca_login(req,res); return; }
    if (req.params.cmd=="logout") { ca_logout(req,res); return; }
    if (!req.session.authenticated) { res.send({ result:401, data: 'authentication needed'}); return; }
    if (req.params.cmd=="start") { ca_start(req,res); return; }
    if (req.params.cmd=="invite") { ca_invite(req,res); return; }
    if (req.params.cmd=="search_user") { ca_search_user(req,res); return; }
    res.send({ result:404, data: 'unknown command'}); 
});

app.get("/",function (req,res) { 
    if (!req.session.authenticated) res.redirect("/login");
    else res.sendFile(path.resolve("../webclient/index.html"));
});

app.get("/login",function (req,res) { 
    res.sendFile(path.resolve("../webclient/login.html")); 
});

// --------------------------
function run()
{
    var server = app.listen(8042, function () {

        var host = server.address().address;
        var port = server.address().port;

        if (debug) logdebug('Example app listening at http://%s:%s', host, port);
    });
}
