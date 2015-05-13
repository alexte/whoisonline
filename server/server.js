/*
 * WhoisOnline Node Server
 */

var express = require('express');
var app = express();
var path = require('path');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');

var Session = require('./libs/session.js');
var session = new Session();

// ------ clientapi functions
function ca_login(req,res)
{
    var login_ok=false;

    if (req.body.username && req.body.password)
    {
	if (req.body.username==req.body.password)  // TODO: real login check
	    login_ok=true;
    }
   
    // check login password
    if (login_ok) 
    {
	session.init_session(req,res);
	res.send({result:200, data:"OK"});
    }
    else res.send({result:401, data:"username or password wrong"});
		// TODO: throttleing for login attempts
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
    if (!req.session.authenticated) { res.send({ result:401, data: 'authentication needed'}); return; }
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

var server = app.listen(8042, function () {

  var host = server.address().address;
  var port = server.address().port;

  console.log('Example app listening at http://%s:%s', host, port);

});
