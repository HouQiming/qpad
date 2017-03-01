var NACL=require('./nacl_factory.js').instantiate(128<<20);
var path=require('path');
var fs=require('fs');
var crypto=require('crypto');

(function(){
	if(process.argv.length<4){
		console.log([
			'usage: ',process.argv[0],' ',process.argv[1],' <input> <output>',
		].join(''));
		return;
	}
	var sk=fs.readFileSync(path.resolve(__dirname,'qpad_secret.bin'));
	var msg=fs.readFileSync(process.argv[2]);
	var sign=NACL.crypto_sign(msg,sk);
	fs.writeFileSync(process.argv[3],new Buffer(sign));
})();
