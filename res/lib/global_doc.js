var UI=require("gui2d/ui");

//////////////////////////
var g_regexp_chopdir=new RegExp("(.*)[/\\\\]([^/\\\\]*)");
var g_regexp_chopext=new RegExp("(.*)\\.([^./\\\\]*)");
var g_style_core_properties=["name","font_face","font_size","font_embolden","flags","color","relative_line_space","relative_paragraph_space"];

UI.RemovePath=function(fname){
	var ret=fname.match(g_regexp_chopdir);
	var main_name=null;
	if(!ret){
		main_name=fname;
	}else{
		main_name=ret[2];
	}
	return main_name;
}

UI.GetPathFromFilename=function(fname){
	var ret=fname.match(g_regexp_chopdir);
	var main_name=null;
	if(!ret){
		main_name=".";
	}else{
		main_name=ret[1];
	}
	return main_name;
}

UI.GetMainFileName=function(fname){
	var ret=fname.match(g_regexp_chopdir);
	var main_name=null;
	if(!ret){
		main_name=fname;
	}else{
		main_name=ret[2];
	}
	ret=main_name.match(g_regexp_chopext);
	if(ret&&ret[1]){
		main_name=ret[1];
	}
	return main_name;
}

UI.GetFileNameExtension=function(fname){
	var ret=fname.match(g_regexp_chopext);
	if(ret){
		return ret[2];
	}else{
		return "";
	}
}

UI.RemoveExtension=function(fname){
	var ret=fname.match(g_regexp_chopext);
	if(ret){
		return ret[1];
	}else{
		return "";
	}
}

////////////////////////////////////
UI.m_ui_metadata={};
(function(){
	var s_json=IO.ReadAll(IO.GetStoragePath()+("/metadata.json"))
	if(s_json){
		try{
			UI.m_ui_metadata=JSON.parse(s_json);
		}catch(e){
			//ignore invalid json
			UI.m_ui_metadata={};
		}
	}
})();
UI.SafeSave=function(fn,data){
	//use EDSaver_Open to avoid dataloss on bad shutdown
	var ed=UI.CreateEditor({font:UI.Font(UI.font_name,20,0)});
	ed.Edit([0,0,data]);
	var ctx=UI.EDSaver_Open(ed,fn)
	for(;;){
		var ret=UI.EDSaver_Write(ctx,ed)
		if(ret=="done"){
			break;
		}else if(ret=="continue"){
			//do nothing
		}else{
			//error saving metadata
			ctx.discard();
			return 0;
		}
	}
	return 1;
};
UI.m_need_metadata_save=0;
UI.m_metadata_corrupted=0;
UI.ReallySaveMetaData=function(){
	if(UI.enable_timing){
		UI.TimingEvent('ReallySaveMetaData');
	}
	if(!UI.m_metadata_corrupted){
		UI.SafeSave(IO.GetStoragePath()+("/metadata.json"),JSON.stringify(UI.m_ui_metadata));
	}
};
UI.SaveMetaData=function(){
	if(UI.enable_timing){
		UI.TimingEvent('SaveMetaData');
		UI.DumpCallStack();
	}
	UI.m_need_metadata_save=1;
}

UI.TestOption=function(stable_name,default_value){
	var options=(UI.m_ui_metadata["<options>"]||{});
	var is_enabled=options[stable_name];
	if(is_enabled==undefined){is_enabled=(default_value==undefined?1:default_value);options[stable_name]=is_enabled;}
	return is_enabled;
}

UI.GetOption=function(stable_name,default_value){
	var options=(UI.m_ui_metadata["<options>"]||{});
	var ret=options[stable_name];
	if(ret==undefined){ret=default_value;}
	return ret;
}

//UI.NewFromTemplate=function(fn_template,fn_real){
//	var ret=UI.OpenFile(IO.GetExecutablePath()+"/"+fn_template)
//	if(!ret){
//		throw new Error("invalid template "+fn_template)
//	}
//	ret.m_file_name=(fn_real||IO.GetNewDocumentName("doc","mo","document"));
//	return ret;
//}

////////////////////////////////////
UI.g_current_z_value=0;
UI.g_tick_program_opened=Duktape.__ui_get_tick();
UI.SaveWorkspace=function(){
	//compact z values
	var z_values=[];
	var n=UI.g_all_document_windows.length;
	for(var i=0;i<UI.g_all_document_windows.length;i++){
		var wnd=UI.g_all_document_windows[i]
		z_values.push((wnd.z_order||0)*n+i);
	}
	z_values.sort(function(a,b){return a-b});
	UI.g_current_z_value=0;
	var ztran={};
	for(var i=0;i<z_values.length;i++){
		if(!i||z_values[i]!=z_values[i-1]){
			ztran[z_values[i]]=UI.g_current_z_value;
			UI.g_current_z_value++;
		}
	}
	for(var i=0;i<UI.g_all_document_windows.length;i++){
		var wnd=UI.g_all_document_windows[i];
		wnd.z_order=ztran[(wnd.z_order||0)*n+i];
	}
	//save workspace
	var workspace=[];
	var t_this_run=Duktape.__ui_seconds_between_ticks(UI.g_tick_program_opened,Duktape.__ui_get_tick());
	for(var i=0;i<UI.g_all_document_windows.length;i++){
		var wnd=UI.g_all_document_windows[i]
		if(wnd.util_type){
			workspace.push({util_type:wnd.util_type,z_order:(wnd.z_order||0),area_name:wnd.area_name})
			continue;
		}
		if(wnd.main_widget&&wnd.main_widget.m_is_special_document){continue;}
		if((wnd.main_widget&&wnd.main_widget.file_name||wnd.file_name).indexOf('<')>=0){continue;}
		workspace.push({
			file_name:wnd.file_name,document_type:wnd.document_type,
			z_order:(wnd.z_order||0),area_name:wnd.area_name,
			stale_time:wnd.main_widget?0:(wnd.stale_time||0)+t_this_run
		})
	}
	UI.m_ui_metadata["<workspace_v2>"]=workspace
	var obj_current_tab=UI.g_all_document_windows[UI.top.app.document_area.current_tab_id]
	if(obj_current_tab){
		var fn_current_tab=obj_current_tab.file_name
		UI.m_ui_metadata["<current_tab>"]=fn_current_tab
	}
}

UI.BumpHistory=function(file_name){
	if(!file_name){return;}
	var hist=UI.m_ui_metadata["<history>"]
	if(!hist){
		hist=[]
		UI.m_ui_metadata["<history>"]=hist;
	}
	for(var i=0;i<hist.length;i++){
		if(hist[i]==file_name){
			for(var j=i;j<hist.length;j++){
				hist[j]=hist[j+1];
			}
			hist[hist.length-1]=file_name
			UI.SaveMetaData();
			return;
		}
	}
	hist.push(file_name)
	UI.g_all_paths_ever_mentioned=undefined;
	UI.SaveMetaData();
}

UI.ComputeRelativePath=function(fn_from,fn_to){
	var paths_from=fn_from.split('/');
	var paths_to=fn_to.split('/');
	var psame=0;
	for(var i=0;i<paths_from.length-1;i++){
		if(paths_from[i]!=paths_to[i]){
			break;
		}
		psame=i+1;
	}
	if(!psame){return fn_to;}
	var paths_final=[];
	for(var i=psame;i<paths_from.length-1;i++){
		paths_final.push('..');
	}
	for(var i=psame;i<paths_to.length;i++){
		paths_final.push(paths_to[i]);
	}
	return paths_final.join('/');
};

////////////////////////////////////
IO.RunTool=function(args,work_dir, sregex,fparse,ffinalize){
	//segment by line, then test regexp
	var proc={};
	proc.sregex=new RegExp(sregex,"");
	proc.buf="";
	if(!IO.RunToolRedirected(args,work_dir,0,function(s){
		var lines=(proc.buf+s).split("\n");
		for(var j=0;j<lines.length-1;j++){
			var match_j=lines[j].match(proc.sregex);
			if(match_j){
				fparse(match_j);
			}
		}
		proc.buf=lines[lines.length-1];
	},ffinalize)){
		//we should make sure ffinalize always gets called
		ffinalize();
		return 0;
	}
	return 1;
};
