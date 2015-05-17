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
        sesslist[id]={ "id":id, authenticated:true };
        req.session=sesslist[id];
        return sesslist[id];
    };

    // express middleware to check if user has a session allready
    this.check_session = function(req,res,next)
    {
        req.session={ authenticated: false };

        if(req.cookies && req.cookies[cookie_name])
        {
            if (sesslist[req.cookies[cookie_name]]) req.session=sesslist[req.cookies[cookie_name]];
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
   
    if (debug) console.log("modules sessions loaded");

    return this;
}

