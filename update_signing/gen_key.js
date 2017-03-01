//DO NOT RUN THIS UNLESS YOU KNOW WHAT YOU'RE DOING!
var NACL=require('./nacl_factory.js').instantiate(16<<20);
var path=require('path');
var fs=require('fs');
var crypto=require('crypto');

process.stdout.write('*** REGENERATING SIGNING KEYS, ARE YOU SURE? ***');
process.stdin.resume();
var response = fs.readSync(process.stdin.fd, 100, 0, "utf8");
process.stdin.pause();


var key_dir=__dirname;
var keypair=NACL.crypto_sign_keypair();
fs.writeFileSync(path.resolve(key_dir,'qpad_secret.bin'), new Buffer(keypair.signSk));
fs.writeFileSync(path.resolve(key_dir,'qpad_public.bin'), new Buffer(keypair.signPk));
