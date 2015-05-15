/*
 * in memory database for whoisonline sever
 *
 */

module.exports = function (config)
{
    var users={};
 
    var messages=[];

    this.check_login_password=function(login,password)
    {
	if (login==password) return true;
	return false;
    }
    
    this.get_conversations=function(user)
    {
    }

    this.get_messages=function(user,selector)
    {
    }
}

