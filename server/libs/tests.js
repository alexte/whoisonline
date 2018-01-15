
// HUB.js tests start
var Hubs=require("./hub.js");
var hub=new Hubs();

var check="";

hub.subscribe("ANY",function (obj) { 
    // console.log("received for ANY: ",obj);
    check+=" a "+obj; 
});

hub.subscribe("topic1",function (obj) { 
    // console.log("received for topic1: ",obj);
    check+=" b "+obj; 
});

hub.subscribe("topic2",function (obj) { 
    // console.log("received for topic2: ",obj);
    check+=" c "+obj; 
});

hub.send("topic1","msg to topic1");
hub.send("topic2","msg to topic2");
hub.send("topic3","msg to topic3");

if (check!=" a msg to topic1 b msg to topic1 a msg to topic2 c msg to topic2 a msg to topic3")
{
    console.log("HUB CHECK failed");
    process.exit(2);
}
console.log("HUB CHECK ok");

// HUB.js tests end

