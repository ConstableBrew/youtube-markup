/*
	Super simple express web server, serves pages from the ./public directory.
*/

// dependecies ================================================================
var express			= require('express');
var app				= express();

// configuration ==============================================================
var port			= process.env.PORT || 8000;
app.use(express.static(__dirname + '/public'));	// Set static file location. Required for the sendfile functions
app.use(express.logger('dev'));					// Log every request to the console

// listen =====================================================================
// homepage ----------------------------------------------------------------
app.get('/', function(req, res){
	res.sendfile('./index.html');
});

// serve up all other assets -----------------------------------------------
app.get('/:file', function(req, res){
	res.sendfile('/' + req.params.file);
});
app.get('/:folder/:file', function(req, res){
	res.sendfile('/' + req.params.folder + '/' + req.params.file);
});

app.listen(port, function() {
	console.log('Listening on ' + port);
});
