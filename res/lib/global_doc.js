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
	if(ret){
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

////////////////////////////////////
UI.m_ui_metadata={};
(function(){
	var s_json=IO.ReadAll(IO.GetStoragePath()+("/metadata.json"))
	if(s_json){
		UI.m_ui_metadata=JSON.parse(s_json)
	}
})();
UI.SaveMetaData=function(){
	IO.CreateFile(IO.GetStoragePath()+("/metadata.json"),JSON.stringify(UI.m_ui_metadata))
}

UI.TestOption=function(stable_name){
	var options=(UI.m_ui_metadata["<options>"]||{});
	var is_enabled=options[stable_name];
	if(is_enabled==undefined){is_enabled=1;}
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
			z_order:(wnd.z_order||0),area_name:wnd.area_name})
	}
	UI.m_ui_metadata["<workspace_v2>"]=workspace
	var obj_current_tab=UI.g_all_document_windows[UI.top.app.document_area.current_tab_id]
	if(obj_current_tab){
		var fn_current_tab=obj_current_tab.file_name
		UI.m_ui_metadata["<current_tab>"]=fn_current_tab
	}
}

UI.BumpHistory=function(file_name){
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
	UI.SaveMetaData();
}

////////////////////////////////////
var g_utility_procs=[];
var freadOnTimer=function(){
	var new_procs=[]
	var tick_now=Duktape.__ui_get_tick();
	for(var i=0;i<g_utility_procs.length;i++){
		var proc_i=g_utility_procs[i]
		if(Duktape.__ui_seconds_between_ticks(proc_i.tick0,tick_now)>proc_i.t_timeout){
			//it timed out, kill and abandon
			proc_i.Terminate()
			proc_i.ffinalize()
			continue
		}
		var s=proc_i.Read(65536)
		if(s&&s.length>0){
			var lines=(proc_i.buf+s).split("\n")
			for(var j=0;j<lines.length-1;j++){
				var match_j=lines[j].match(proc_i.sregex)
				if(match_j){
					proc_i.fparse(match_j);
				}
			}
			proc_i.buf=lines[lines.length-1]
			new_procs.push(proc_i)
		}else{
			if(proc_i.IsRunning()){
				new_procs.push(proc_i)
			}else{
				proc_i.ffinalize()
			}
		}
	}
	g_utility_procs=new_procs;
	if(g_utility_procs.length>0){
		//UI.setTimeout(freadOnTimer,50)
		UI.NextTick(freadOnTimer)
	}
};
IO.RunTool=function(args,work_dir, sregex,fparse,ffinalize, t_timeout){
	//segment by line, then test regexp
	var proc=IO.RunToolRedirected(args,work_dir,0)
	if(!proc){
		return 0;
	}
	proc.sregex=new RegExp(sregex,"");
	proc.fparse=fparse;
	proc.ffinalize=ffinalize;
	proc.t_timeout=t_timeout;
	proc.tick0=Duktape.__ui_get_tick();
	proc.buf="";
	g_utility_procs.push(proc)
	if(g_utility_procs.length==1){
		//UI.setTimeout(freadOnTimer,50)
		UI.NextTick(freadOnTimer)
	}
	return 1;
};
