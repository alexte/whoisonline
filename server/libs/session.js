/*
 * Web/Cookie Session Handling for whoisonline webclient
 */

var uid = require('uid-safe');
var cookie_name = "wio_sess";
var debug = 0;

module.exports = function()
{
    var sesslist={};

    // sets a session when user logges in
    this.init_session = function(req,res)
    {
        var id=uid.sync(20);
        res.cookie(cookie_name,id);
        sesslist[id]={ "id":id, last_used:Date.now()/1000, authenticated:true };
        req.session=sesslist[id];
        return sesslist[id];
    };

    // express middleware to check if user has a session allready
    this.check_session = function(req,res,next)
    {
        req.session={ authenticated: false };

        if(req.cookies && req.cookies[cookie_name])
        {
            if (sesslist[req.cookies[cookie_name]])
	    {
		sesslist[req.cookies[cookie_name]].last_used=Date.now()/1000;
		req.session=sesslist[req.cookies[cookie_name]];
	    }
            else { res.clearCookie(cookie_name); }
        }
        next();
    };

    // remove session by session_id or session object
    this.remove_session = function(o)
    {
        if (!o) return false;
        if (sesslist[o]) { delete sesslist[o]; return true; }
        if (o.id && sesslist[o.id]) { delete sesslist[o.id]; return true; }
        return false;
    };

    // returns array of sessionid, of sessions not used in the lasts idletime seconds
    this.get_old_sessions = function(idletime)
    {
	var t=Date.now()/1000-idletime;
 	var old=[];

	for (var id in sesslist)
	{
	    if (sesslist.hasOwnProperty(id))
		if (sesslist[id].last_used<t) old.push(id);
	}
	return old;
    }
   
    if (debug) console.log("modules sessions loaded");

    return this;
}

