/* 
 * HUB
 * a javascript module to dispatch objects to subscibed receivers
 */

module.exports = function ()
{
    // subcriptions: and object of topics 
    //		     where every topic is a list of callbacks
    //		     subscribe to topic "ANY" to receive every object
    var sub={ "ANY": [] };

    this.subscribe=function(topic,callback)
    {
	if (!(topic in sub))	// new topic
	    sub[topic]=[];
	sub[topic].push(callback);
    }

    this.send=function(topic,obj)
    {
	for (i=0;i<sub["ANY"].length;)
	{
	    var ret=sub["ANY"][i](obj);
	    if (ret=="UNSUBSCRIBE") sub["ANY"].splice(i,1);
	    else i++;
	}
	if (topic in sub) for (i=0;i<sub[topic].length;)
	{
	    var ret=sub[topic][i](obj);
	    if (ret=="UNSUBSCRIBE") sub[topic].splice(i,1);
	    else i++;
	}
    }

    return this;
}
