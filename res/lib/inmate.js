var UI=require("gui2d/ui");

if(UI.is_real){
	throw new Error("you're not in jail and there is no inmate");
}

UI.__init_widget_report=function(){
	UI.__reported_widgets=[];
	UI.g_widget_name=0;
};

UI.__report_widget=function(attrs){
	//UI.__reported_widgets.push([UI.g_widget_name++,attrs]);
	UI.__reported_widgets.push({
		id:UI.g_widget_name++, x:attrs.x, y:attrs.y, w:attrs.w||0, h:attrs.h||0, 
		inmate_placement:attrs.anchor_placement||(UI.context_parent&&UI.context_parent.layout_direction)||"inside",
		inmate_align:attrs.anchor_align||(UI.context_parent&&UI.context_parent.layout_align)||"left",
		inmate_valign:attrs.anchor_valign||(UI.context_parent&&UI.context_parent.layout_valign)}||"up")
	return attrs;
};

UI.__get_widget_report=function(){
	//var ret=[];
	//for(var i=0;i<UI.__reported_widgets.length;i++){
	//	var wname=UI.__reported_widgets[i][0];
	//	var wi=UI.__reported_widgets[i][1];
	//	ret[i]={id:wname, x:wi.x, y:wi.y, w:wi.w||0, h:wi.h||0};
	//}
	//return ret
	return UI.__reported_widgets;
};

//specifying editor dimensions
/*editor: UI.BeginVirtualWindow(id,{w:640,h:480,bgcolor:0xffffffff})//*/
/*editor: UI.EndVirtualWindow()//*/
UI.BeginVirtualWindow=function(id,attrs){
	UI.Begin(UI.Keep(id,attrs));
	UI.Begin(W.Window('app',{
		title:'',w:attrs.w,h:attrs.h,bgcolor:attrs.bgcolor,
		designated_screen_size:Math.min(attrs.w,attrs.h),flags:UI.SDL_WINDOW_MAXIMIZED,
		is_main_window:1}));
}

UI.EndVirtualWindow=function(){UI.End();UI.End();}
