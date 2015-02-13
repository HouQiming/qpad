var UI=require("gui2d/ui");
var W=require("gui2d/widgets");
require("gui2d/dockbar");

UI.SetFontSharpening(1.5)

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
