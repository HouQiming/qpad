var UI=require("gui2d/ui");

if(UI.is_real){
	throw new Error("you're not in jail and there is no inmate");
}

UI.__init_widget_report=function(){
	UI.__reported_widgets=[];
	UI.g_widget_name=0;
};

UI.__report_widget=function(attrs){
	UI.__reported_widgets.push([UI.g_widget_name++,attrs]);
	return attrs;
};

UI.__get_widget_report=function(){
	var ret=[];
	for(var i=0;i<UI.__reported_widgets.length;i++){
		var wname=UI.__reported_widgets[i][0];
		var wi=UI.__reported_widgets[i][1];
		ret[i]={id:wname, x:wi.x, y:wi.y, w:wi.w||0, h:wi.h||0};
	}
	return ret;
};

//specifying editor dimensions
/*editor: UI.BeginVirtualWindow(id,{w:640,h:480,bgcolor:0xffffffff})//*/
/*editor: UI.EndVirtualWindow()//*/
UI.BeginVirtualWindow=function(id,attrs){
	UI.Begin(UI.Keep(id,attrs));
	UI.Begin(W.Window('app',{
		title:'',w:attrs.w,h:attrs.h,bgcolor:attrs.bgcolor,
		designated_screen_size:Math.min(w,h),flags:UI.SDL_WINDOW_MAXIMIZED,
		is_main_window:1}));
}

UI.EndVirtualWindow=function(){UI.End();UI.End();}
