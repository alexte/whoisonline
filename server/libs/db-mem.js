/*
 * in memory database for whoisonline sever
 *
 */

module.exports = function (full_config)
{
    var users={};
    var config=full_config["db-mem"];

    var messages=[];

	// calls callback with user object if login/password is ok
	// calls callback with false if login/password is not ok
    this.check_login_password=function(login,password,callback)
    {
	var username; 

	if (login.indexOf("@")==-1)
	{
	    if (full_config.domains && full_config.domains[0].length>1) username=login+"@"+full_config.domains[0];
	    else { callback(false); return; }
	}
	else username=login;
	if (config.auth_method=='dummy' && login.length>=3 && login==password) callback({ username:username });
	else callback(false);
    }
    
    this.get_conversations=function(user,callback)
    {
    }

    this.save_messages=function(message,callback)
    {
    }

    this.get_messages=function(user,selector,callback)
    {
    }
}

