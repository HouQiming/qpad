var UI=require("gui2d/ui");
var W=require("gui2d/widgets");
require("gui2d/dockbar");

UI.SetFontSharpening(1.5)

//todo: inserting objects - editor hook, file dlg - gallery dlg - additional_hotkeys
//CreateEmbeddedImageFromFileData, PickImage
COMMAND_INSERT_OBJECT=0x100000
COMMAND_RUBBER_SPACE=0x107fff
COMMAND_SET_STYLE=0x108000
COMMAND_END=0x110000
STYLE_UNDERLINED=1
STYLE_STRIKE_OUT=2
STYLE_FONT_BOLD=(1<<16)
STYLE_FONT_ITALIC=(1<<17)
STYLE_FONT_TYPE_WRITER=(1<<18)
STYLE_FONT_SANS_SERIF=(1<<19)
LEVEL_CHAPTER=0
LEVEL_SECTION=1
LEVEL_SUBSECTION=2
LEVEL_PARAGRAPH=3
LEVEL_NORMAL=4
LEVEL_SMALL=5
////////////////
var g_computer_modern_flags=[STYLE_FONT_SANS_SERIF|STYLE_FONT_BOLD,STYLE_FONT_SANS_SERIF|STYLE_FONT_BOLD,STYLE_FONT_SANS_SERIF|STYLE_FONT_BOLD,STYLE_FONT_SANS_SERIF|STYLE_FONT_BOLD,0,0];
var g_computer_modern_sizes=[16,16,14,10,10,8];
var g_GetFontFromStyle_callbacks={
	"computer_modern":function(params){
		var font_name;
		var level=(params.level||LEVEL_NORMAL);
		var flags=(params.flags||0)^g_computer_modern_flags[level];
		var size=g_computer_modern_sizes[level];
		var embolden=0;
		if(flags&STYLE_FONT_TYPE_WRITER){
			if(flags&STYLE_FONT_BOLD){
				if(flags&STYLE_FONT_ITALIC){font_name="res/fonts/cmuntx.ttf";}else{font_name="res/fonts/cmuntb.ttf";}
			};
			if(flags&STYLE_FONT_ITALIC){font_name="res/fonts/cmunit.ttf";}
			font_name="res/fonts/cmuntt.ttf"
		}else if(flags&STYLE_FONT_SANS_SERIF){
			if(flags&STYLE_FONT_BOLD){
				if(flags&STYLE_FONT_ITALIC){font_name="res/fonts/cmunso.ttf";}else{font_name="res/fonts/cmunsx.ttf"}
			};
			if(flags&STYLE_FONT_ITALIC){font_name="res/fonts/cmunsl.ttf";}
			font_name="res/fonts/cmunss.ttf";
		}else{
			if(flags&STYLE_FONT_BOLD){
				if(flags&STYLE_FONT_ITALIC){font_name="res/fonts/cmunbi.ttf";}else{font_name="res/fonts/cmunbx.ttf"}
			};
			if(flags&STYLE_FONT_ITALIC){font_name="res/fonts/cmunci.ttf";}
			font_name="res/fonts/cmunrm.ttf";
		}
		return UI.Font(font_name,size,embolden)
	},
};
var GetFontFromStyle=function(name,params){
	return g_GetFontFromStyle_callbacks[name](params);
};
////////////////
TxtxEditor_prototype=Object.create(W.Edit_prototype)
TxtxEditor_prototype.root_style_name="computer_modern";
////////////////
TxtxEditor_prototype.GetStyleIDAt=function(ccnt){
	var ed=this.ed;
	return ed.GetStateAt(ed.m_handler_registration["renderer"],ccnt,"ddl")[2];
};
TxtxEditor_prototype.GetCurrentStyleObject=function(){
	var style_id=this.GetStyleIDAt(this.sel1.ccnt);
	return this.styles[style_id];
};
TxtxEditor_prototype.Init=function(){
	W.Edit_prototype.Init.call(this);
	this.m_style_map={};
	this.styles=[];
	this.CreateStyle({color:0xff000000,level:LEVEL_NORMAL,flags:0})
};
TxtxEditor_prototype.HookedEdit=function(ops){
	var ed=this.ed;
	for(var i=0;i<ops.length;i+=3){
		if(ops[i+1]){
			//there is deletion, preserve the style
			var s_original=ed.GetText(ops[i+0],ops[i+1]);
			for(var j=s_original.length-1;j>=0;j--){
				var ch=s_original.charCodeAt(j);
				if(ch>=COMMAND_SET_STYLE&&ch<COMMAND_END){
					ops[i+2]=String.fromCharCode(ch)+ops[i+2];
					break;
				}
			}
		}
	}
	ed.Edit(ops);
};
TxtxEditor_prototype.CreateStyle=function(params){
	var name=[this.root_style_name,(params.level||0),(params.flags||0),(params.color||0xff000000)].join("_")
	if(this.m_style_map[name]){
		return this.m_style_map[name];
	}
	this.m_style_map[name]=this.styles.length;
	params.font=GetFontFromStyle(this.root_style_name,params);
	this.styles.push(params);
	return this.m_style_map[name];
};
TxtxEditor_prototype.SetTextStyle=function(params){
	var sid=this.CreateStyle(params);
	var ed=this.ed;
	var sel=this.GetSelection();
	var s_style=String.fromCharCode(COMMAND_SET_STYLE+sid);
	var ops;
	if(sel[0]==sel[1]){
		ops=[sel[0],0,s_style];
	}else{
		var sid_original=this.GetStyleIDAt(sel[1]);
		ops=[sel[0],0,s_style];
		if(sid_original!=sid){
			ops.push(sel[1])
			ops.push(0)
			ops.push(s_style_original)
		}
	}
	ed.Edit(ops);
};
TxtxEditor_prototype.additional_hotkeys=[
	{key:"CTRL+B",action:function(obj){
		var cur_state=obj.GetCurrentStyleObject();
		obj.SetTextStyle({color:cur_state.color,level:(cur_state.level||LEVEL_NORMAL),flags:((cur_state.flags||0)^STYLE_FONT_BOLD)})
	}},
	{key:"CTRL+I",action:function(obj){
		var cur_state=obj.GetCurrentStyleObject();
		obj.SetTextStyle({color:cur_state.color,level:(cur_state.level||LEVEL_NORMAL),flags:((cur_state.flags||0)^STYLE_FONT_ITALIC)})
	}},
	{key:"ALT+SHIFT+LEFT",action:function(obj){
		var cur_state=obj.GetCurrentStyleObject();
		obj.SetTextStyle({color:cur_state.color,level:Math.max((cur_state.level||LEVEL_NORMAL)-1,0),flags:(cur_state.flags||0)})
	}},
	{key:"ALT+SHIFT+RIGHT",action:function(obj){
		var cur_state=obj.GetCurrentStyleObject();
		obj.SetTextStyle({color:cur_state.color,level:Math.min((cur_state.level||LEVEL_NORMAL)+1,LEVEL_SMALL),flags:(cur_state.flags||0)})
	}},
	{key:"ALT+I",action:function(obj){
		var img_name=UI.PickImage();
		//CreateEmbeddedImageFromFileData, actually push the object
	}},
];

//todo: TxtxEditor_prototype

var g_hyp_US=UI.ParseHyphenator(IO.UIReadAll("res/misc/ushyphmax.tex"));
var g_layout={
	direction:'tab',
	items:[
		{object_type:W.Edit,
			id:"$test",
			//font:UI.Font("res/fonts/cmunrm.ttf",32),
			styles:[{font:UI.Font("res/fonts/cmunrm.ttf",32),color:0xff000000}, {font:UI.Font("res/fonts/cmunss.ttf",44),color:0xff000000}],
			//styles:[{font:UI.Font("calibri",32),color:0xff000000}],
			state_handlers:["renderer_fancy"],
			anchor_align:"fill",anchor_valign:"fill",
			wrap_width:1024,
			h_blank_line:40,//todo: should be style dependent
			text:IO.ReadAll("mo/test/example.txt"),
			///////////////
			show_background:1,bgcolor:0xffffffff,
			///////////////
			hyphenator:g_hyp_US,
		},
	],
};
UI.Application=function(id,attrs){
	attrs=UI.Keep(id,attrs);
	UI.Begin(attrs);
		///////////////////
		UI.Begin(W.Window('app',{
				title:'Mini-Office',w:1280,h:720,bgcolor:0xffbbbbbb,
				designated_screen_size:1080,flags:UI.SDL_WINDOW_MAXIMIZED|UI.SDL_WINDOW_RESIZABLE,
				is_main_window:1}));
			if(UI.Platform.ARCH!="mac"&&UI.Platform.ARCH!="ios"){
				W.Hotkey("",{key:"ALT+F4",action:function(){UI.DestroyWindow(UI.top.app)}});
			}
			W.DockingLayout("dockbar",{anchor:UI.context_parent,anchor_align:"fill",anchor_valign:"fill",layout:g_layout})
		UI.End();
	UI.End();
};

UI.Run()
