
/*  delayed_once:
 *
 *   usage: delayed_once("name",function,time_in_milliseconds)
 *
 *        function gets called in time_in_milliseconds.
 *        if called again with same name old timeout gets cancled and new function gets queued
 *        if function=="cancel" (or function not a function) this timer is cancelled
 *        if time_in_milliseconds is 0 this timer is cancelled and function called immediately
 */
function delayed_once(id,f,delay)
{
    if (!delayed_once.mem) delayed_once.mem={};

    if (delayed_once.mem[id]) { clearTimeout(delayed_once.mem[id]); delete delayed_once.mem[id]; }
    if (typeof f == 'function')
    {
	if (delay===0 || delay=="now") f();
        else delayed_once.mem[id]=setTimeout(function () {
	    delete delayed_once.mem[id];
	    f();
        },delay);
    }
}

/* delayed_once tests 
	function a() { console.log("a"); }
	function b() { console.log("b"); }

	delayed_once("a",a,4000);
	setTimeout(function () { delayed_once("a",a,4000); },3000);
	setTimeout(function () { delayed_once("a",a,4000); },6000);
	delayed_once("b",b,1000);
	setTimeout(function () { delayed_once("b",b,1000); },2500);
	setTimeout(function () { delayed_once("b",b,0); },3000);
	setTimeout(function () { delayed_once("b",b,1000); },4500);
*/
