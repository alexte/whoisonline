/*
 * WhoisOnline Node Server
 * by Alexander Terczka
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
	if (f[i]) f[i](run_next);
    }

    f[0](run_next);
}

run_serialized([read_config,parse_arguments,db_init,run,background_jobs]);

// -------------- logfile/tools

function logdebug()
{
    if (debug>0) console.log.apply(null,arguments);
}

function contains(arr,element)
{
    var i;
    for (i=0;i<arr.length;i++)
       if (arr[i]==element) return true;
    return false;
}

function isEmpty(obj) {
    var name;
    for (name in obj) {
        return false;
    }
    return true;
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

function valid_address(w)
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
	logdebug("adding session "+sessionid+" for user "+username);
	if (!username) return false;
	var u=queues[username];
	if (u) 
	{
	    u.sessions[sessionid]={ acked:u.seq, connection:false };
	    return u.seq;
	}
	queues[username]={ username: username, sessions:{}, seq:1, msgs:[] };
	queues[username].sessions[sessionid]={ acked:1, connection:false };
	return 1;
    }

    function dump()
    {
	console.log("oq:");
	for (var username in queues)
	{
	    console.log("  "+username);
	    for (var id in queues[username].sessions)
	    {
	        console.log("     "+id);
	    }
	}
    }
    this.dump = dump;

    this.remove_sessions = function(sessionids)
    {
	var list=[];
	for (var i=0;i<sessionids.length;i++) 
	{
	    var r=remove_session(sessionids[i]);
	    if (r.logout) list.push(r.logout);
	}
	return list;
    }

    function remove_session(sessionid)
    {
	var ret="close";
	for (var username in queues) 
	{
   	    if (queues.hasOwnProperty(username)) 
	    {
		if (queues[username].sessions[sessionid])
		{
		    delete queues[username].sessions[sessionid];
		    if (isEmpty(queues[username].sessions)) 
		    {
			remove_queue(username);
			return {"logout":username};
		    }
		    return "done";
		}
    	    }
	}
	return "not found";
    }
    this.remove_session = remove_session;

    function run_queue(q)
    {
	for(var id in q.sessions)
	{
	    logdebug("running queue for "+q.username+" "+id);
	    var s=q.sessions[id];
	    // logdebug("    session "+s);
	    // logdebug("    msgs "+(q.seq-s.acked)+" "+(s.connection?"CON":"NOCON"));
	    if (s.acked<q.seq && s.connection)
	    {
		var msgs=[];
		for(var i=0;i<q.msgs.length;i++) 
		    if (q.msgs[i].seq>s.acked) msgs.push(q.msgs[i].msg);
		clearTimeout(s.connection.timeout);
		s.connection.timeout=false;
		s.connection.send({ result:200, seq:q.seq, msgs:msgs });
		s.connection=false;
	    }
	}
    }

    this.new_connection = function(req,res)
    {
	var username=req.session.username;
	var sessionid=req.session.id;
	if (!username || !sessionid) { console.log("Invalid connections in new_connection"); return false; }
	var q=queues[username];
	if (!q) { console.log("No such user in new_connection "+username); return false; }
  	var s=q.sessions[sessionid];
	if (!s) { console.log("No shuch user in new_connection"); return false; }
	if (s.connection) // found old connection
	{
	    if (s.connection.timeout) clearTimeout(s.connection.timeout); 
	    s.connection.timeout=false;
	    s.connection.send({ result:204, data:"Dropping old poll connection" });
	    s.connection=false;
	}
	s.connection=res;

	if (req.query.ack) s.acked=req.query.ack;
	else console.log("poll error from "+username+ ": ack missing");

	run_queue(q);

        if (s.connection) 
	    s.connection.timeout=setTimeout(function () { 
		s.connection.send({ result:204, data:"I am bored" 
	    }); s.connection=false; },POLL_TIMEOUT*1000);
	return true;
    }

    this.add_message = function(username,msg)
    {
	logdebug("oq.add_message "+username+" "+msg);
	if (!username || !queues[username]) return false;
	var q=queues[username];
	q.seq++;
	q.msgs.push({seq:q.seq, msg:msg});

	run_queue(q);
	return true;
    }

    // this.remove_message = function .... do we need this ?

    this.get_seq_by_username = function(username)
    {
	if (!queues[username]) return false;
	return queues[username].seq;
    }

    this.get_queue = function(username)
    {
	return queues[username];
    }

    function remove_queue(username) { delete queues[username]; }

    // TODO garbage collection of msgs per queue acked by all sessions
    // setInterval(gc,2000);
}

var oq=new online_queue_class();

// ------ msg dispatcher
function dispatch_status(username,status)
{

    get_identity_by_address(username,function (identity) {
	if (!identity) {
	    console.log("unexpected address "+username);
	    return;
	}
    	var o={type:"status",from:identity,status:status};
    	// get conversation partners that are online
    	db.get_conversations_by_user(username,function (data) {
    	    // send status to all of them
	    for (var i=0;i<data.length;i++)
	    {
	        if (data[i].a.address!=username) oq.add_message(data[i].a.address,o);
	        if (data[i].b.address!=username) oq.add_message(data[i].b.address,o);
	    }
    	});
    });
}

function dispatch_msg(from,to,msg)
{
    var o={ type:"msg", from:from, to:to, msg:msg };
    oq.add_message(to,o);
    oq.add_message(from,o);
    db.save_message(o);
}

function get_identity_by_address(address,callback)
{
    // TODO identity cache
    if (db.get_identity_by_address) db.get_identity_by_address(address,callback);
}

function get_status(address)
{
    return oq.get_queue(address)?"online":"offline";
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
		get_identity_by_address(u.username,function (identity) {
		    if (!identity) {
	    	    	console.log("unexpected address "+username);
		        res.send({result:500, data:"unexprected address"});
	    	    	return;
		    }
		    req.session.identity=identity;
		    oq.add_session(u.username,req.session.id);
		    dispatch_status(u.username,"online");
		    res.send({result:200, data:"OK"});
		});
	    }));
    }
    else { res.send({result:400, data:"invalid call"}); }
		// TODO: throtteling for login attempts
}

function ca_logout(req,res)
{
    if (oq.remove_session(req.session.id)=="logout")
    	dispatch_status(req.session.username,"offline");
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

	// get current seq number of this user if she is logged in twice 
    r.seq=oq.get_seq_by_username(req.session.username); 

    get_identity_by_address(req.session.username,function (identity) {
        r.identity=identity;
        r.group_suffix=config.group_suffix;
        res.send(r);
    });
}

function ca_search_user(req,res)
{
    var sw=req.query.search;
    var i;

    if (!sw) { res.send({result:400, data:"invalid call (s)"}); return; } 

    r={ result:200, identities:[] };
    i=sw.indexOf("@");
    if (i>=0)    // user searches address
    {
	var domain=sw.substring(i+1);
	if (contains(config.domains,domain))  // local domain
	{
	    db.search_user(sw,function (identities) {
	    	r.identities=identities;
		res.send(r); 
	    });
	    return;
	}
	// TODO check if remote domain is wio enabled
	r.info="The domain \'"+domain+"\' is not WhoisOnline enabled yet.";
    }
    else  // user searches name ?
    {
	db.search_user(sw,function (identities) {
            r.identities=identities;
            res.send(r); 
        });
        return;
    }
    res.send(r);
}

function ca_get_conversations(req,res)
{
    db.get_conversations_by_user(req.session.username,function (data) {
        for (var i=0;i<data.length;i++)
	{
	    data[i].a.status=get_status(data[i].a.address);
	    data[i].b.status=get_status(data[i].b.address);
	    // TODO check online status of remote users
	}
    	res.send({result:200, conversations: data });
    });
}

function ca_start_conversation(req,res)
{
    var address=req.body.address;
    if (!address) { res.send({result:400, data:"invalid call"}); return; } 

    get_identity_by_address(address,function (identity) {
    	db.add_conversation(req.session.identity,identity,"inviting",function(c) {
	    if (!c.a.status) c.a.status=get_status(req.session.identity.address);
	    if (!c.b.status) c.b.status=get_status(identity.address);

	    oq.add_message(req.session.username,{ type: "add_conversation", conversation: c });
	    oq.add_message(address,             { type: "add_conversation", conversation: c });
	    res.send({result:200, data:"done" });
	});
    });
}

function ca_leave_conversation(req,res)
{
    var address=req.body.address;
    if (!address) { res.send({result:400, data:"invalid call"}); return; } 

    db.leave_conversation(req.session.username,address,function (data) {
        db.set_conversation_status(req.session.username,address,"disconnected",function (c) {
            res.send({result:200, data:"ok" });
            oq.add_message(req.session.username,{ type: "remove_conversation", conversation: c });
            oq.add_message(address, { type: "update_conversation", conversation: c });
        });
    });
}

function ca_set_fullname(req,res)
{
    var fullname=req.body.fullname;

    if (!fullname || fullname.length<1) { res.send({result:400, data:"fullname missing" }); return; }

    db.set_fullname(req.session.username,fullname);
    req.session.identity.name=fullname;
    res.send({result:200, data:"saved" });
}

function ca_send_message(req,res)
{
    var to=req.body.to;
    var msg=req.body.msg;

    if (msg.length==0) { res.send({result:200, data:"ignoring empty message" }); return; }
    if (!valid_address(to)) { res.send({result:400, data:"receipient missing" }); return; }

    dispatch_msg(req.session.username,to,msg);
    res.send({result:200, data:"sent" });
}

function ca_set_conversation_status(req,res)
{
    var to=req.body.to; // identity
    var status=req.body.status; // identity

    db.set_conversation_status(req.session.username,to,status,function (c) {
        res.send({result:200, data:"ok" });
        oq.add_message(req.session.username,{ type: "update_conversation", conversation: c });
        oq.add_message(to,                  { type: "update_conversation", conversation: c });
    });
}

function ca_get_messages(req,res)
{
    var from=req.query.from;
    var to=req.query.to;

    if (req.session.username!=from && req.session.username!=to)
    {
	res.send({result:403, data:"Forbidden"});
	return;
    }

    db.get_messages_for_conversation(from,to,0,function(msgs) {
	res.send({result:200, msgs:msgs});
    });
}

function ca_new_group(req,res)
{
    var group;
    if(req.query.check_only) group=req.query.group;
    else group=req.body.group;

    if (!group) {
        res.send({result:400, data:"group object missing"});
        return;
    }

    // validate group object
    if (!group.identity.address || !group.identity.name) {
        res.send({result:400, data:"group identity missing"});
        return;
    }

    var n=group.identity.name;
    var a=group.identity.address;
    if (n.length<2 || a.substr(a.length-config.group_suffix)!=config.group_suffix)
    {
        res.send({result:403, data:"invalid group name or address"});
        return;
    }

    // check if group object is available
    // TODO db.get_identity_by_address


    if (!req.query.check_only) 
    {
	db.add_group(group,function (result) {
	    if (result) {
		res.send({result:200, msgs:"new group added"});
		// TODO new conversation
	    }
	    else res.send({result:500, msgs:"internal server error"});
	});
    }
}

// ---- express middleware modules
app.use(cookieParser());

app.use(session.check_session);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

// ------- webclient urls
app.use('/css', express.static('../webclient/css'));
app.use('/fa', express.static('node_modules/font-awesome'));

app.all("/clientapi/:cmd",function (req,res) { 
    if (!req.params.cmd) { res.send({ result:404, data: 'missing command'}); return; }
    if (req.params.cmd=="login") { ca_login(req,res); return; }
    if (req.params.cmd=="logout") { ca_logout(req,res); return; }
    if (!req.session.authenticated) { res.send({ result:401, data: 'authentication needed'}); return; }

    if (req.params.cmd=="start") ca_start(req,res); 
    else if (req.params.cmd=="start_conversation") ca_start_conversation(req,res); 
    else if (req.params.cmd=="leave_conversation") ca_leave_conversation(req,res); 
    else if (req.params.cmd=="get_conversations") ca_get_conversations(req,res);
    else if (req.params.cmd=="search_user") ca_search_user(req,res); 
    else if (req.params.cmd=="send_message") ca_send_message(req,res); 
    else if (req.params.cmd=="set_conversation_status") ca_set_conversation_status(req,res); 
    else if (req.params.cmd=="get_messages") ca_get_messages(req,res); 
    else if (req.params.cmd=="set_fullname") ca_set_fullname(req,res); 
    else if (req.params.cmd=="new_group") ca_new_group(req,res); 
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
function run(next)
{
    var server = app.listen(config.port||8042, function () {

        var host = server.address().address;
        var port = server.address().port;

        if (debug) logdebug('WIO Server listening at http://%s:%s', host, port);
	next();
    });
}

function idle_logout()
{
    var logout_users=oq.remove_sessions(session.remove_old_sessions(config.idletime||60));
    for (var i=0;i<logout_users.length;i++)
	dispatch_status(logout_users[i],"offline");
}

function background_jobs(next)
{
    setInterval(idle_logout,10000);
    next();
}
