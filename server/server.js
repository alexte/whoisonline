
var express = require('express');
var app = express();

// ---- static webclient files reachable at /webclient
app.use('/webclient', express.static('../webclient'));

app.get('/', function(req,res) {
    res.send("Hello World!");
});

var server = app.listen(8042, function () {

  var host = server.address().address;
  var port = server.address().port;

  console.log('Example app listening at http://%s:%s', host, port);

});
