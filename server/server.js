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

var POLL_TIMEOUT=20; // seconds

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

// ------- online queue 
//   manages the online users and the outgoing queues to them

function online_queue_class()
{
	// assoc array of queues with username as key
	//   elements:  username:
	//		seq: current sequence number of queue, increases with every msg
	//		msgs: 
	//		sessions: assoc array of { acked, connection } with sessionid as key
    var queues={};

	// when the user logs in a queue is generated or 
	// if it's the second session of the same user, the old one is used
	// Returns: the new or current seq
    this.add_session = function(username,sessionid)
    {
	if (!username) return false;
	var u=queues[username];
	if (u) 
	{
	    u.sessions[sessionid]={ acked:u.seq, connection:false };
	    return u.seq;
	}
	queues[username]={ username: username, sessions:{}, seq:1 };
	queues[username].sessoins[sessionid]={acked:1, connection:false };
	return 1;
    }

    this.remove_session = function(sessionid)
    {
	for (var username in queues) 
	{
   	    if (queues.hasOwnProperty(username)) 
	    {
		delete queues[username].sessions[sessionid];
		if (queues[username].sessions.length==0) remove_queue(username);
    	    }
	}
    }

    function run_queue(q)
    {
	for(var id in q.sessions)
	{
	    var s=q.sessions[id];
	    if (s.acked<s.seq && s.connection)
	    {
		var msgs=[];
		for(i=0;i<q.msgs.length;i++) 
		    if (q.msgs[i].seq>s.acked) msgs.push(q.msgs[i].msg);
		clearTimeout(s.connection.timeout);
		s.connection.timeout=false;
		s.connection.send({ seq:s.seq, msgs:msgs });
		s.connection==false;
	    }
	}
    }

    this.new_connection = function(req,res)
    {
	var username=req.session.username;
	var sessionid=req.session.id;
	if (!username || !sessionid) { console.log("Invalid connections in new_connection"); return false; }
	var q=queues[username];
	if (!q) { console.log("No shuch user in new_connection"); return false; }
  	var s=q.sessions[sessionid];
	if (!s) { console.log("No shuch user in new_connection"); return false; }
	if (s.connection) // found old connection
	{
	    if (s.connection.timeout) clearTimeout(s.connection.timeout); 
	    s.connection.timeout=false;
	    s.connection.send({ result:204, data:"Dropping old poll connection" });
	}
	s.connection=res;

	run_queue(q);

        if (s.connection) s.connection.timeout=setTimeout(function () { s.connection.send({ result:204, data:"I am bored" }); },POLL_TIMEOUT*1000);
	return true;
    }

    this.add_message = function(username,msg)
    {
	if (!username || !queues[username]) return false;
	var q=queues[username];
	q.seq++;
	q.msgs.push({seq:q.seq, msg:msg});

	run_queue(q);
	return true;
    }

    // this.remove_message = function .... do we need this ?

    this.ack_message = function(username,sessionid,seq)
    {
	if (!queues[username]) return false;
	if (!queues[username].sessions[sessionid]) return false;
	queues[username].sessions[sessionid].acked=seq;
	return true;
    }

    function remove_queue(username) { delete queues[username]; }

    // TODO garbage collection of msgs per queue acked by all sessions
    // setInterval(gc,2000);
}

var oq=new online_queue_class();


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

function ca_poll(req,res)
{
   oq.new_connection(req,res);
}

function ca_start(req,res)
{
    var r={ result:200, now: new Date() };

    r.seq=1; // TODO get current seq number of this user if she is logged in twice 
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

function ca_get_conversations(req,res)
{
    db.get_conversations(req.session.username,function (data) {
    	res.send({result:200, data: data });
    });
}

function ca_start_conversation(req,res)
{
    var username=req.body.username;
    if (!username) { res.send({result:400, data:"invalid call"}); return; } 

    db.add_conversation(req.session.username,username);
    // spool(req.session.username,username,"start_conversation");

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

    if (req.params.cmd=="start") ca_start(req,res); 
    else if (req.params.cmd=="start_conversation") ca_start_conversation(req,res); 
    else if (req.params.cmd=="get_conversations") ca_get_conversations(req,res);
    else if (req.params.cmd=="search_user") ca_search_user(req,res); 
    else if (req.params.cmd=="poll") ca_poll(req,res); 
    else res.send({ result:404, data: 'unknown command'}); 
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
    var server = app.listen(config.port||8042, function () {

        var host = server.address().address;
        var port = server.address().port;

        if (debug) logdebug('Example app listening at http://%s:%s', host, port);
    });
}
