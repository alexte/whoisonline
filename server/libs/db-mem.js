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
	if (config.auth_method=='dummy' && login.length>=3 && login==password) callback({ username:login });
	else callback(false);
    }
    
    this.get_conversations=function(user,callback)
    {
    }

    this.get_messages=function(user,selector,callback)
    {
    }
}

