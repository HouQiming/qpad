# Using the Help System

## Introduction

QPad's help system is mainly designed for per-project *private* documentations. Each help document is a markdown file with embedded scripts that can be run semi-automatically.

## Quick Start

Each embedded script is a code block followed by a specially-formatted text command. The "command" lines will be highlighted. You can double-click the highlighted region to run a specific script, or press `CTRL+E` to run them one-by-one. The script below opens the source code of this document in the editor. You can use it as an example when creating your own help documents.

Run in editor:
```js
UI.OpenEditorWindow("*res/misc/metahelp.md");
```

You can also interleave scripts with manual actions by beginning a command with "make sure". Executing such a command does nothing. It's just for you to "make sure".

## Creating a Help Document

Help documents are stored as `*.md` files in the folder `your_project/doc/`. The script below creates one such file and provides some example content.

Make sure you have a file from your favorite project open in the editor.

Run in editor:
```js
var spath=UI.GetCurrentProjectPath();
IO.Shell(['mkdir',spath+'/doc']);
UI.OpenEditorWindow(spath+'/doc/metahelp.md',function(){
	if(!(this.ed.GetTextSize()>0)){
		this.ed.Edit([0,0,IO.UIReadAll('res/misc/metahelp.md')]);
	}
});
```

Once you have some help documents in `doc/`, you can search them by typing in the help window.

That's all. Enjoy!
