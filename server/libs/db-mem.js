/*
 * in memory database for whoisonline sever
 *
 */

module.exports = function (full_config)
{
    var users={};
    var msgs=[];
    var config=full_config["db-mem"];

    var messages=[];

    function for_each_conversation(f)
    {
	for (var user in users)
	    if (users.hasOwnProperty(user))
	        for (var conv in users[user].conversations)
	    	    if (users[user].conversations.hasOwnProperty(conv))
			f(users[user].conversations[conv]);
    }

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

	if (config.auth_method=='dummy' && login.length>=3 && login==password) 
	{
	    if (!users[username]) users[username]={ conversations:[] };
	    callback({ username:username });
	}
	else callback(false);
    }
    
    this.get_conversations=function(username,callback)
    {
	if (users[username]) callback(users[username].conversations);
	else callback([]);
    }

    this.add_conversation=function(from,to,callback)
    {
	users[from].conversations.push({to:to});
	if (callback) callback(true);
    }

    this.search_user=function(sw,callback)
    {
	var username;
   	var r=[];
	for (username in users)
	    if (username.toLowerCase().indexOf(sw.toLowerCase())>=0 || 
		users[username].name.toLowerCase().indexOf(sw.toLowerCase())>=0) 
		r.push({ address: username, name:users[username].name});
	callback(r);
    }

    this.set_fullname=function(address,name)
    {
	if (users[address]) users[address].name=name;
	for_each_conversation(function (conv) {
	    if (conv.to.address==address) { conv.to.name=name; }
	});
    }

    this.get_identity_by_address=function(address,callback)
    {
	if (users[address] && users[address].name) callback({ address:address, name:users[address].name });
	else callback({ address:address });
    }

    this.save_message=function(message,callback)
    {
	messages.timestamp=Date.now();
	msgs.push(message);
	if (callback) callback(true);
    }

	// fetch msgs from msgs store
	// sample call:   
	//	db.get_messages("alex@wio.at",{from:"alex@wio.at",to:"barbara@wio.at"},count,function (array) {...});
	//	returns count newst messages from alex@wio.at to barbara@wio.at
	//	(count==0 : all messages)
    this.get_messages=function(user,selector,count,callback)
    {
	var out=[];

	for (var i=msgs.length-1;i>=0;i--)   // TODO optimize msg search, user authorization for msg
	{
	    var ok=true;
	    for (var f in selector)
	    {
		if (msgs[i][f]!=selector[f]) { ok=false; break; }
	    }
	    if (ok) 
	    {
		out.unshift(msgs[i]);
		if (count!=0) { count--; if (count==0) break; }
	    }
	}
	callback(out);
    }

    this.get_messages_for_conversation=function(from,to,count,callback)
    {
	var out=[];

	for (var i=msgs.length-1;i>=0;i--)   // TODO optimize msg search, user authorization for msg
	{
	    if ((msgs[i].from==from && msgs[i].to==to) || (msgs[i].to==from && msgs[i].from==to)) 
	    { 	out.unshift(msgs[i]); 
		if (count!=0) { count--; if (count==0) break; }
	    }
	}
	callback(out);
    }
}

