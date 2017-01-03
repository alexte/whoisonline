/*
 * auth-imap
 * delegated auth using imap server
 *
 * usage:
 *      var Imap=require("libs/auth-imap");
 *      var imap=new Imap("imap.server");
 *	imap.check_login_password(login,password,callback);
 *
 *		callback receives: 
 *		   "ok" 	user authenticated successfully
 *		   "authfail" 	user authenticated failed, login or password wrong
 *		   "serverfail"	user authenticated failed, server not reachable or similar
 */

var Imap = require("imap");

module.exports = function(imap_server)
{
    this.check_login_password = function(login,password,callback){
	// try to login to imap server
	var imap=new Imap({ user: login, password: password, host: imap_server, autotls:"required"});
	imap.once("ready",function () { imap.end(); callback("ok"); });
	imap.once("error",function (err) { 
	    imap.end();
	    if (err.source=="authentication") { callback("authfail"); }
	    else callback("serverfail");
	});
	imap.connect(); 
    }

    return this;
}

