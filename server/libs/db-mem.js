/*
 * in memory database for whoisonline sever
 *
 */

fs=require('fs');

module.exports = function (full_config)
{
	// users and groups are assoc arrays with address as index 
	// users and groups are sub types of identity (name,address,type,...)

    var users={};
    var groups={};

    var msgs=[];
	// assoc array of conversation arrays
	//    conversation["alex@wio.at"]=[ identity, ... ]
    var conversations={};

    var changed=false;

    var config=full_config["db-mem"];

    function save_data()
    {
	if (!changed) return;
	var all={ users:users, conversations:conversations, msgs:msgs, groups:groups, timestat:new Date() };

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
	    groups=all.groups;
	    users=all.users;
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

    function for_each_conversation(f)
    {
	for(var user in conversations)
	    for (var i=0;i<conversations[user].length;i++)
	    	f(conversations[user][i]);
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

	if (full_config.auth_method=='dummy' && login.length>=3 && login==password) 
	{
		// auto register user in dummy mode
	    if (!users[username]) users[username]={ address:username };
	    changed=true;
	    callback(users[username]);
	}
	else callback(false);
    }
    
    this.get_conversations_by_user=function(username,callback)
    {
dump_data();
	if (conversations[username]) callback(conversations[username]);
	else callback([]);
    }

    function get_conversation_from_to(a,b)
    {
	if (!conversations[a]) return false;
	for (var i=0;i<conversations[a].length;i++)
	    if (conversations[a][i].other.address==b) return conversations[a][i];
	return false;
    }

    this.add_conversation=function(from,to,status,callback)
    {
	changed=true;
	var c=get_conversation_from_to(from.address,to.address);

	if (!c) c={other:to,status:status,last_used:new Date()};
	else    console.log("conv already present "+JSON.stringify(c));

	if (!conversations[from.address]) conversations[from.address]=[];
	conversations[from.address].push(c);
	console.log("add_conversation new: "+JSON.stringify(c));
	if (callback) callback(c);
    }

	// removes conversation for "from" user conv list matching "to"
	// from, to can be identities or addresses
    this.leave_conversation=function(from,to,callback)
    {
	if (!from || !to)
	{
            console.log("leave conversation called without from or to ");
            callback(false);
            return;
	}
	if (from.address) from=from.address;
	if (to.address) to=to.address;

	if (!conversations[from]) callback(false);

	for (var i=0;i<conversations[from].length;i++)
	{
	    if (!conversations[from][i].other || !conversations[from][i].other.address)
	    {
		console.log("broken conversation object: "+conversations[from][i]);
		callback(false);
		return;
	    }
	    if (conversations[from][i].other.address==to)
	    {
		changed=true;
		conversations[from].splice(i,1);
		callback(true);
		return;
	    }
	}
	callback(false);
    }

    this.search_identity=function(sw,callback)
    {
   	var r=[];
	for (var address in users)
	    if (address.toLowerCase().indexOf(sw.toLowerCase())>=0 || 
		(users[address].name && users[address].name.toLowerCase().indexOf(sw.toLowerCase())>=0))
		r.push(users[address]);
	for (var address in groups)
	    if (address.toLowerCase().indexOf(sw.toLowerCase())>=0 || 
		(groups[address].name && groups[address].name.toLowerCase().indexOf(sw.toLowerCase())>=0))
		r.push(groups[address]);
	callback(r);
    }

    this.set_fullname=function(address,name)
    {
	changed=true;
	if (users[address]) users[address].name=name;
	for_each_conversation(function (conv) {
	    if (conv.other.address==address) { conv.other.name=name; }
	});
    }

	// calls callback(identity) if identity is found 
	// calls callback(false) if identity is not found
	// TODO remote domains
    this.get_identity_by_address=function(address,callback)
    {
	if (!address) { console.log("get_identity_by_address called with address==false"); callback(false); }
	else if (users[address]) callback(users[address]);
	else if (groups[address]) callback(groups[address]);
	else callback(false);
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
        var c=get_conversation_from_to(from,to);
	if (c) c.status=status;
	f(c);
    }

	// ----------------------- groups handling

    this.add_group=function(group,callback)
    {
	if (!group.address)  { if (callback) callback(false); }
	else
	{
	    if (!group.members) group.members=[];
	    groups[group.address]=group;
	    if (callback) callback(groups[group.address]);
	}
    }

    this.set_group_info=function(group,info,callback) // address,info object
    {
	if (group in groups) { groups[group].info=info; if (callback) callback(groups[group]); }
	else { if (callback) callback(false); }
    }

    this.remove_group=function(group,callback)
    {
	if (group in groups) { delete groups[group]; if (callback) callback(true); }
	else { if (callback) callback(false); }
    }

    this.add_group_member=function(group,identity,callback)
    {
	var mem={address:identity.address,mode:"member"};
	if (group in groups) 
	{
	    if (groups[group].members.indexOf(mem)<0) groups[group].members.push(mem); 
	    if (callback) callback(groups[group]); 
	}
	else { if (callback) callback(false); }
    }

    this.remove_group_member=function(group,address,callback)
    {
	if (!group in groups) { if (callback) callback(false); return; }

	var m=groups[group].members;
	for (var i=0;i<m.length;i++)
	{
	    if (m[i].identity.address==address)
	    {
		m.splice(i,1);
		if (callback) callback(groups[group].members);
		return;
	    }
	}
	if (callback) callback(false);
    }

    this.set_group_member_info=function(group,address,info)
    {
	if (!group in groups) { if (callback) callback(false); return; }

	var m=groups[group].members;
	for (var i=0;i<m.length;i++)
	{
	    if (m[i].identity.address==address)
	    {
		m[i].info=info;
		if (callback) callback(m[i]);
		return;
	    }
	}
	if (callback) callback(false);
    }
}

