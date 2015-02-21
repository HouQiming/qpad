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
