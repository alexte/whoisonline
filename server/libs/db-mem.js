/*
 * in memory database for whoisonline sever
 *
 */

module.exports = function (full_config)
{
    var users={};
    var config=full_config["db-mem"];
 
    var messages=[];

    this.check_login_password=function(login,password)
    {
	if (config.auth_method=='dummy' && login.length>=3 && login==password) return true;
	return false;
    }
    
    this.get_conversations=function(user)
    {
    }

    this.get_messages=function(user,selector)
    {
    }
}

