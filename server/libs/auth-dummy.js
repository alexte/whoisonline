/*
 * auth-dummy
 * sample auth module
 *
 * checks if login equals password
 *
 * usage:
 *      var Auth=require("libs/auth-dummy");
 *      var auth=new Auth();
 *	auth.check_login_password(login,password,callback);
 *
 *		callback receives: 
 *		   "ok" 	user authenticated successfully
 *		   "authfail" 	user authenticated failed
 */

module.exports = function(config)
{
    this.check_login_password = function(login,password,callback){
	if (login=password) callback("ok");
	else callback("authfail");
    }

    return this;
}

