/*
 * in memory database for whoisonline sever
 *
 */

fs=require('fs');

module.exports = function (full_config)
{
    var users={};
    var msgs=[];
    var conversations=[];

    var changed=false;

    var config=full_config["db-mem"];

    function save_data()
    {
	if (!changed) return;
	var all={ users:users, conversations:conversations, msgs:msgs, timestat:new Date() };

	fs.writeFile(config.db_file,JSON.stringify(all),function (err) { 
	    if (err) console.log("writing wio database failed");
	});
    }

    function load_data()
    {
	try { 
	    var all=JSON.parse(fs.readFileSync(config.db_file));

	    msgs=all.msgs;
	    conversations=all.conversations;
	    users=all.users;
		// conversatoins need to be linked to users and not copied
	    for (var user in users)
	    {
		if (users.hasOwnProperty(user))
		{
		    var readconvs=users[user].conversations;
		    users[user].conversations=[];
		    for(var i=0;i<readconvs.length;i++)
		    {
			var c=get_conversation_a_b(readconvs[i].a.address,readconvs[i].b.address);
			if (c) users[user].conversations.push(c);
	 	    }
		}
	    }
	} catch (e) {
	    console.log("cannot read db-mem file "+config.db_file);
	}
    }

    if (config.db_file)
    {
	load_data();
	setInterval(save_data,3000);
    }

    function dump_data()
    {
	console.log("USERS: "+JSON.stringify(users,null,2));
	console.log("CONVERSATIONS: "+JSON.stringify(conversations,null,2));
    }

    function get_conversation_a_b(a,b)
    {
	for(var i=0;i<conversations.length;i++)
	{
	    if(((conversations[i].a.address==a) && (conversations[i].b.address==b)) ||
	       ((conversations[i].a.address==b) && (conversations[i].b.address==a))) return conversations[i];
	}
	return false;
    }

    function for_each_conversation(f)
    {
	for(var i=0;i<conversations.length;i++)
	    f(conversations[i]);
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
	    changed=true;
	    callback({ username:username });
	}
	else callback(false);
    }
    
    this.get_conversations_by_user=function(username,callback)
    {
dump_data();
	if (users[username]) callback(users[username].conversations);
	else callback([]);
    }

    this.add_conversation=function(from,to,status,callback)
    {
	changed=true;
	var c=get_conversation_a_b(from.address,to.address);
	if (c)
	{
	    console.log("old conv "+JSON.stringify(c));
	    if (users[from.address].conversations.indexOf(c)<0) users[from.address].conversations.push(c);
	    if (users[to.address].conversations.indexOf(c)<0) users[to.address].conversations.push(c);
	    if (from.address!=c.a.address)
	    {
		var mem=c.a;
		c.a=c.b;
		c.b=mem;
	    }
	    c.status="inviting";
	    if (callback) callback(c);
	    return;
	}

	var c={a:from,b:to,status:status,last_used:new Date()};
	console.log("new conv "+JSON.stringify(c));
	conversations.push(c);
	users[from.address].conversations.push(c);
	users[to.address].conversations.push(c);
	if (callback) callback(c);
    }

    this.leave_conversation=function(from,to,callback)
    {
	changed=true;
	if (!users[from]) callback(false);
	for (var i=0;i<users[from].conversations.length;i++)
	{
	    if (users[from].conversations[i].a.address==to ||
		users[from].conversations[i].b.address==to)
	    {
		users[from].conversations.splice(i,1);
		callback(true);
		return;
	    }
	}
	callback(false);
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
	changed=true;
	if (users[address]) users[address].name=name;
	for_each_conversation(function (conv) {
	    if (conv.a.address==address) { conv.a.name=name; }
	    if (conv.b.address==address) { conv.b.name=name; }
	});
    }

    this.get_identity_by_address=function(address,callback)
    {
	if (users[address] && users[address].name) callback({ address:address, name:users[address].name });
	else callback({ address:address });
    }

    this.save_message=function(message,callback)
    {
	changed=true;
	message.timestamp=new Date();
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

    this.set_conversation_status=function(from,to,status,f)
    {
	changed=true;
console.log("set_conv_status "+status);
        var c=get_conversation_a_b(from,to);
	if (c) c.status=status;
	f(c);
    }
}

