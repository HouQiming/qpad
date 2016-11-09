# Example Help Document

## Feature Test

We can insert code reference:

![](qtag://814459e6fe91)

We have active ops.

Run:
```sh
#!/bin/sh
ls
read -n1 -r -p "Press any key to continue..." key
```

Markdown supports **bold** and `code=function{return 1+2;}` and *emph*. We automatically fix the "quotes" and 'single-quotes'. But when we can't, we leave them in place.

We can insert images:
![](c:/tp/qpad/icon256.png)

And horizontal rules
---
Or CJK: あいうえお

Make sure a directory listing is indeed produced.

## Another Section

Sections are auto-numbered.

We can insert code:
```js
//javascript highlighting
function(){
	return 0;
}
```

List:
- List items have bullets
- It still supports **bold** and `code=function{return 1+2;}` and *emph*. We automatically fix the "quotes" and 'single-quotes'. But when we can't, we leave them in place.
- Unicode bullets

Or quote:
> "Things always seem fairer when we look back at them, and it is out of of that inaccessible tower of the past that Longing leans and beckons."
> — "Literary Essays, vol. I", by James Russel Lowell

Another op:

Insert code in your require area:
```js
var mongo=require('mongodb').MongoClient;
var co=require('co');
var db=undefined;
```

Insert code in your init function:
```js
db=yield mongo.connect('mongodb://127.0.0.1:27017/test');
```
