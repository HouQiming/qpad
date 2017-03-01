#!/usr/bin/node
var http = require('http');
var express = require('express');
var path = require('path');

var app=express();
app.use(express.static(path.resolve(__dirname,'public')));

app.use("*",function(req, res, next) {
	res.header({"Cache-Control":"no-cache"});
	res.status(404).send('Not found');
});

app.use(function(err, req, res, next) {
	console.log(err.stack)
	res.header({"Cache-Control":"no-cache"});
	res.status(500).send('Error');
});

http.createServer(app).listen(3000);
