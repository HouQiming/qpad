var UI=require("gui2d/ui");
var W=require("gui2d/widgets");
require("gui2d/dockbar");

UI.SetFontSharpening(1.5)

var g_layout={
	direction:'tab',
	items:[],
};
UI.Application=function(id,attrs){
	attrs=UI.Keep(id,attrs);
	UI.Begin(attrs);
		///////////////////
		UI.Begin(W.Window('app',{
				title:'Mini-Office',w:1280,h:720,bgcolor:0xffbbbbbb,
				designated_screen_size:1440,flags:UI.SDL_WINDOW_MAXIMIZED|UI.SDL_WINDOW_RESIZABLE,
				is_main_window:1}));
			if(UI.Platform.ARCH!="mac"&&UI.Platform.ARCH!="ios"){
				W.Hotkey("",{key:"ALT+F4",action:function(){UI.DestroyWindow(UI.top.app)}});
			}
			W.DockingLayout("dockbar",{anchor:UI.context_parent,anchor_align:"fill",anchor_valign:"fill",layout:g_layout})
		UI.End();
	UI.End();
};

UI.Run()
