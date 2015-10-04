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

UI.m_ext_loaders={};
UI.RegisterLoaderForExtension=function(ext,f){
	UI.m_ext_loaders[ext]=f;
}
UI.m_zip_loaders={};
UI.RegisterZipLoader=function(name,f){
	UI.m_zip_loaders[name]=f;
}
var LoadZipObject=function(doc,zip_info){
	var sdata=zip_info.data
	var sformat=zip_info.ext
	if(!sformat){
		return sdata;
	}
	//var p_newline=sdata.indexOf("\n");
	//var sformat=sdata.substr(0,p_newline)
	var parser=UI.m_zip_loaders[sformat];
	if(!parser){
		throw new Error("invalid document format '@1'".replace("@1",sformat))
	}
	return parser(doc,sdata)
}

UI.LoadZipDocument=function(fname){
	var ret=UI._LoadZipDocument(fname)
	if(!ret){return ret}
	var doc=new UI.NewGlobalDoc(fname);
	doc.m_loaded_file=ret
	var n=doc.m_loaded_file.n
	for(var i=0;i<n;i++){
		doc.m_objects[i]=undefined
	}
	var loaded_metadata=UI.m_ui_metadata[fname]
	if(loaded_metadata){
		var json_ret=JSON.parse(loaded_metadata)
		if(json_ret.timestamp!=IO.GetFileTimestamp(fname)){
			json_ret=undefined;
		}
		doc.m_metadata=(json_ret&&json_ret.a||{})
	}else{
		for(var i=0;i<n;i++){
			doc.m_metadata[i]={}
		}
	}
	if(!doc.GetObject(0)){return undefined;}
	if(!doc.GetObject(1)){return undefined;}
	doc.GetObject(1).OpenAsTab()
	return doc
}

UI.OpenFile=function(fname){
	//todo: consult history for loader preference
	var ext=UI.GetFileNameExtension(fname).toLowerCase()
	var parser=(UI.m_ext_loaders[ext]||UI.m_ext_loaders["*"])
	return parser(fname)
}

UI.RegisterLoaderForExtension("mo",function(fname){return UI.LoadZipDocument(fname)})

//////////////////////////
UI.internal_clipboard={}
UI.NewGlobalDoc=function(fname){
	this.m_objects=[]
	this.m_metadata=[]
	this.m_undo_ids=[]
	this.m_redo_ids=[]
	//////////////////
	//the style sheet document
	var obj_styles=Object.create(UI.JSONObject_prototype)
	obj_styles.Init()
	obj_styles.m_data.styles=[];
	this.AddObject(obj_styles)
	this.m_file_name=fname
}
UI.CloneStyle=function(params){
	var ret={};
	for(var i=0;i<g_style_core_properties.length;i++){
		var id=g_style_core_properties[i];
		ret[id]=params[id];
	}
	return ret;
}
UI.GetMetaData=function(obj){
	return obj.m_global_document.m_metadata[obj.m_sub_document_id]
}
UI.NewGlobalDoc.prototype={
	//documents should insert creation functions here
	AddObject:function(obj){
		var ret=this.m_objects.length;
		this.m_objects.push(obj)
		this.m_metadata.push({})
		obj.m_global_document=this
		obj.m_sub_document_id=ret
		return ret;
	},
	BeforeEdit:function(id){
		this.m_redo_ids=[]
		this.m_undo_ids.push(id)
	},
	OnObjectChange:function(id){
		//the change should be reported AFTER edit... and at undos
		if(!id){
			var objs=this.m_objects;
			for(var i=0;i<objs.length;i++){
				var obj_i=objs[i]
				if(obj_i.OnStyleChange){
					obj_i.OnStyleChange()
				}
			}
		}
	},
	Undo:function(){
		if(!this.m_undo_ids.length){return;}
		var id=this.m_undo_ids.pop();
		this.m_objects[id].Undo()
		this.m_redo_ids.push(id)
		this.OnObjectChange(id)
	},
	Redo:function(){
		var id=this.m_redo_ids.pop();
		this.m_objects[id].Redo()
		this.m_undo_ids.push(id)
		this.OnObjectChange(id)
	},
	//////////////////////////////////////
	GetObject:function(id){
		var ret=this.m_objects[id]
		if(!ret){
			if(this.m_loaded_file){
				var zip_info=this.m_loaded_file.ReadObject(id)
				ret=LoadZipObject(this,zip_info)
				ret.m_global_document=this
				ret.m_sub_document_id=id
				this.m_objects[id]=ret;
			}
		}
		return ret
	},
	Save:function(){
		//JS-side object GC:
		//root=1, style always needed
		if(this.m_loaded_file){
			//load everything before saving
			var n=this.m_loaded_file.n
			for(var i=0;i<n;i++){
				this.GetObject(i);
			}
			this.m_loaded_file=undefined;
		}
		var objs=m_objects
		var n=0,mapping=[];
		for(var i=0;i<objs.length;i++){
			var obj_i=objs[i];
			obj_i.__unique_id=-1
			mapping[i]=-1;
		}
		objs[0].__unique_id=n++
		var dfs=function(id){
			var obj=m_objects[id]
			if(obj.__unique_id>=0){return;}
			obj.__unique_id=n++
			var refs=obj.GetReferences();
			if(refs){
				for(var i=0;i<refs.length;i++){
					var id_i=refs[i]
					dfs(id_i)
				}
			}
		}
		dfs(1)
		var new_objs=[];
		for(var i=0;i<objs.length;i++){
			var obj_i=objs[i];
			if(obj_i.__unique_id<0){
				//nothing
			}else{
				mapping[i]=new_objs.length
				new_objs.push(obj_i)
			}
		}
		for(var i=0;i<new_objs.length;i++){
			new_objs[i].SetReferences(mapping)
		}
		this.m_objects=new_objs
		//////////////////////////////////
		UI.SaveZipDocument(this.m_file_name,new_objs)
		//save a document timestamp to detect corrupted metadata
		this.SaveMetaData()
		UI.SaveMetaData()
	},
	SaveMetaData:function(){
		UI.m_ui_metadata[this.m_file_name]=JSON.stringify({a:this.m_metadata,timestamp:UI.GetFileTimestamp(this.m_file_name)})
	},
	/////////////////////
	BeginContinuousUndo:function(){
		this.m_contundo_point=this.m_undo_ids.length;
	},
	PerformContinuousUndo:function(){
		while(this.m_undo_ids.length>this.m_contundo_point){
			this.Undo()
		}
	},
	EndContinuousUndo:function(){
		this.m_contundo_point=undefined
	},
	/////////////////////////////////////////
	SetStyleEditorPropertySheet:function(){
		var sheet=UI.document_property_sheet;
		var style_id=sheet["style"][0]
		//style editor
		var obj_the_style=this.GetObject(0);
		var cur_state=obj_the_style.m_data.styles[style_id];
		sheet["font_face"]=[cur_state.font_face,function(value){
			obj_the_style.BeforeEdit();
			cur_state.font_face=value;
			obj_the_style.AfterEdit();
		}]
		sheet["font_size"]=[cur_state.font_size,function(value){
			obj_the_style.BeforeEdit();
			cur_state.font_size=Math.max(parseInt(value),4);
			obj_the_style.AfterEdit();
		}]
		sheet["font_embolden"]=[cur_state.font_size,function(value){
			obj_the_style.BeforeEdit();
			cur_state.font_embolden=parseInt(value);
			obj_the_style.AfterEdit();
		}]
		sheet["underlined"]=[!!(cur_state.flags&UI.STYLE_UNDERLINED),function(value){obj_the_style.BeforeEdit();cur_state.flags=((cur_state.flags&~UI.STYLE_UNDERLINED)|(value?UI.STYLE_UNDERLINED:0));obj_the_style.AfterEdit();}]
		//sheet["strike_out"]=[!!(cur_state.flags&UI.STYLE_STRIKE_OUT),function(value){obj_the_style.BeforeEdit();cur_state.flags=((cur_state.flags&~UI.STYLE_STRIKE_OUT)|(value?UI.STYLE_STRIKE_OUT:0));obj_the_style.AfterEdit();}]
		sheet["superscript"]=[!!(cur_state.flags&UI.STYLE_SUPERSCRIPT),function(value){obj_the_style.BeforeEdit();cur_state.flags=((cur_state.flags&~(UI.STYLE_SUPERSCRIPT|UI.STYLE_SUBSCRIPT))|(value?UI.STYLE_SUPERSCRIPT:0));obj_the_style.AfterEdit();}]
		sheet["subscript"]=[!!(cur_state.flags&UI.STYLE_SUBSCRIPT),function(value){obj_the_style.BeforeEdit();cur_state.flags=((cur_state.flags&~(UI.STYLE_SUPERSCRIPT|UI.STYLE_SUBSCRIPT))|(value?UI.STYLE_SUBSCRIPT:0));obj_the_style.AfterEdit();}]
		sheet["italic"]=[!!(cur_state.flags&UI.STYLE_FONT_ITALIC),function(value){obj_the_style.BeforeEdit();cur_state.flags=((cur_state.flags&~UI.STYLE_FONT_ITALIC)|(value?UI.STYLE_FONT_ITALIC:0));obj_the_style.AfterEdit();}]
		sheet["bold"]=[!!(cur_state.flags&UI.STYLE_FONT_BOLD),function(value){obj_the_style.BeforeEdit();cur_state.flags=((cur_state.flags&~UI.STYLE_FONT_BOLD)|(value?UI.STYLE_FONT_BOLD:0));obj_the_style.AfterEdit();}]
		//////
		var gdoc=this
		sheet["text_color"]=[
			cur_state.color,
			function(value,is_continuous){
				if(is_continuous){
					gdoc.PerformContinuousUndo()
				}
				var cur_state=obj_the_style.m_data.styles[style_id];
				//cur_state has changed after undo
				obj_the_style.BeforeEdit();
				cur_state.color=value;
				obj_the_style.AfterEdit();
			},
			function(){gdoc.BeginContinuousUndo();},
			function(){gdoc.EndContinuousUndo();}]
	},
	/////////////////////
	BeginCopy:function(stext){
		var ret={};
		ret.m_objects={};
		ret.m_objects[0]={styles:{}};
		ret.owner=this;
		UI.internal_clipboard={data:ret,key:stext}
		UI.SDL_SetClipboardText(stext)
		return ret
	},
	CopyObject:function(cobj,id){
		if(!id||cobj.m_objects[id]){return;}
		var obj_i=this.m_objects[id];
		cobj.m_objects[id]=[obj_i.default_extension,obj_i.Save()]//(obj_i.share_across_docs?obj_i:obj_i.Save())
	},
	CopyStyle:function(cobj,id){
		cobj.m_objects[0].styles[id]=UI.CloneStyle(this.GetObject(0).styles[id])
	},
	BeginPaste:function(){
		var pmystyles=this.GetObject(0).m_data.styles
		this.m_style_map={}
		for(var i=0;i<pmystyles.length;i++){
			var style_i=pmystyles[i]
			this.m_style_map[style_i.name]=i
		}
		var stext=UI.SDL_GetClipboardText().toString();
		if(UI.internal_clipboard.key==stext){
			return UI.internal_clipboard.data
		}
		return stext;
	},
	PasteObject:function(cobj,id){
		if(!id||cobj.owner==this){
			return id;
		}
		var obj=cobj.m_objects[id];
		//share_across_docs doesn't hold: have to clone it
		if(typeof obj!='number'){
			var parser=UI.m_zip_loaders[obj[0]];
			obj=parser(doc,obj[1])
			obj=this.AddObject(obj)
			cobj.m_objects[id]=obj
		}
		return obj//an id here
	},
	PasteStyle:function(cobj,id){
		//search by name, populate m_style_map
		var pstyles=cobj.m_objects[0].styles;
		var style_obj=pstyles[id]
		var pmystyles=this.GetObject(0).m_data.styles
		var ret=this.m_style_map[style_obj.name]
		if(ret==undefined){
			ret=pmystyles.length
			pmystyles.push(UI.CloneStyle(style_obj))
			this.m_style_map[style_obj.name]=ret;
		}
		return ret;
	},
};

UI.GlobalDoc_prototype=UI.NewGlobalDoc.prototype

UI.JSONObject_prototype={
	//coulddo: string diff
	Init:function(){
		this.m_data={}
		this.m_undo_queue=[]
		this.m_redo_queue=[]
	},
	BeforeEdit:function(){
		this.m_redo_queue=[]
		this.m_undo_queue.push(JSON.stringify(this.m_data))
		this.m_global_document.BeforeEdit(this.m_sub_document_id)
	},
	AfterEdit:function(){
		this.m_global_document.OnObjectChange(this.m_sub_document_id)
	},
	Undo:function(){
		this.m_redo_queue.push(JSON.stringify(this.m_data))
		this.m_data=JSON.parse(this.m_undo_queue.pop())
	},
	Redo:function(){
		this.m_undo_queue.push(JSON.stringify(this.m_data))
		this.m_data=JSON.parse(this.m_redo_queue.pop())
	},
	Save:function(){
		return JSON.stringify(this.m_data)
	}
};

UI.CreateJSONObjectClass=function(proto){
	Object.setPrototypeOf(proto,UI.JSONObject_prototype);
	UI.RegisterZipLoader(proto.default_extension,function(gdoc,sdata){
		var ret=Object.create(proto)
		ret.Init()
		ret.m_data=JSON.parse(sdata);
		return ret;
	})
	return proto
}

UI.RegisterZipLoader("json",function(gdoc,sdata){
	var ret=Object.create(UI.JSONObject_prototype)
	ret.Init()
	ret.m_data=JSON.parse(sdata);
	return ret;
})

////////////////////////////////////
UI.m_ui_metadata={};
(function(){
	var s_json=IO.ReadAll(IO.GetStoragePath()+"/metadata.json")
	if(s_json){
		UI.m_ui_metadata=JSON.parse(s_json)
	}
})();
UI.SaveMetaData=function(){
	IO.CreateFile(IO.GetStoragePath()+"/metadata.json",JSON.stringify(UI.m_ui_metadata))
}

UI.NewFromTemplate=function(fn_template,fn_real){
	var ret=UI.OpenFile(IO.GetExecutablePath()+"/"+fn_template)
	if(!ret){
		throw new Error("invalid template "+fn_template)
	}
	ret.m_file_name=(fn_real||IO.GetNewDocumentName("doc","mo","document"));
	return ret;
}

////////////////////////////////////
UI.SaveWorkspace=function(){
	//workspace
	var workspace=[]
	for(var i=0;i<UI.g_all_document_windows.length;i++){
		var wnd=UI.g_all_document_windows[i]
		if(wnd.doc&&wnd.doc.m_is_brand_new){continue;}
		workspace.push(wnd.file_name)
	}
	UI.m_ui_metadata["<workspace>"]=workspace
	var fn_current_tab=UI.g_all_document_windows[UI.top.app.document_area.current_tab_id].file_name
	UI.m_ui_metadata["<current_tab>"]=fn_current_tab
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
		UI.setTimeout(freadOnTimer,100)
	}
};
IO.RunTool=function(args,work_dir, sregex,fparse,ffinalize, t_timeout){
	//segment by line, then test regexp
	var proc=IO.RunToolRedirected(args,work_dir,0)
	if(!proc){
		return 0;
	}
	if(!g_utility_procs.length){
		UI.setTimeout(freadOnTimer,100)
	}
	proc.sregex=new RegExp(sregex,"");
	proc.fparse=fparse;
	proc.ffinalize=ffinalize;
	proc.t_timeout=t_timeout;
	proc.tick0=Duktape.__ui_get_tick();
	proc.buf="";
	g_utility_procs.push(proc)
	return 1;
};

