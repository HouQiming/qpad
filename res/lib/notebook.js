var UI=require("gui2d/ui");
var W=require("gui2d/widgets");
require("res/lib/global_doc");
require("res/lib/code_editor");

var MeasureEditorSize=function(doc,dlines){
	var ed=doc.ed;
	var ccnt_tot=ed.GetTextSize();
	var hc=ed.GetCharacterHeightAt(ccnt_tot);
	var ytot=ed.XYFromCcnt(ccnt_tot).y+hc*(dlines+1);
	return Math.min(ytot,UI.default_styles.notebook_view.max_lines*hc);
};

W.notebook_prototype={
	Save:function(){
		var docs=[];
		for(var i=0;i<this.m_cells.length;i++){
			var cell_i=this.m_cells[i];
			var doc_in=cell_i.m_text_in;
			cell_i.m_text_in=doc_in.ed.GetText();
			docs[i*2+0]=doc_in;
			doc_in.saved_point=doc_in.ed.GetUndoQueueLength();
			doc_in.ResetSaveDiff();
			var doc_out=cell_i.m_text_out;
			cell_i.m_text_out=doc_out.ed.GetText();
			docs[i*2+1]=doc_out;
			//doc_out.saved_point=doc_out.ed.GetUndoQueueLength();
			//doc_out.ResetSaveDiff();
		}
		var s=JSON.stringify({cells:this.m_cells})
		var sz_std=Duktape.__byte_length(s);
		var sz_written=IO.CreateFile(this.file_name,s);
		for(var i=0;i<this.m_cells.length;i++){
			var cell_i=this.m_cells[i];
			cell_i.m_text_in=docs[i*2+0];
			cell_i.m_text_out=docs[i*2+1];
		}
		if(!(sz_written>=sz_std)){
			return 0;
		}
		this.need_save=0;
		return 1;
	},
	SaveMetaData:function(){
		//todo
	},
	ProcessCell:function(cell_i){
		//////
		var doc_in=UI.CreateEmptyCodeEditor(cell_i.m_language);
		doc_in.Init();
		doc_in.scroll_x=0;doc_in.scroll_y=0;
		if(cell_i.m_text_in){doc_in.ed.Edit([0,0,cell_i.m_text_in],1);}
		cell_i.m_text_in=doc_in;
		//////
		var doc_out=UI.CreateEmptyCodeEditor();
		doc_out.read_only=1;
		doc_out.Init();
		doc_out.scroll_x=0;doc_out.scroll_y=0;
		if(cell_i.m_text_out){doc_out.ed.Edit([0,0,cell_i.m_text_out],1);}
		cell_i.m_text_out=doc_out;
	},
	NewCell:function(){
		var cell_i={
			m_language:(UI.Platform.ARCH=="win32"||UI.Platform.ARCH=="win64")?"Windows BAT":'Unix Shell Script',
		};
		this.ProcessCell(cell_i)
		this.m_cells.push(cell_i)
	},
	RunCell:function(id){
		var cell_i=this.m_cells[id];
		if(id>0){
			var cell0=this.m_cells[0];
			//todo: run cell0 in qpad js for configurations
		}
		//direct execution for _nix, %COMSPEC% for Windows
		//coulddo: manual interpreter setup
		var args=[];
		if(UI.Platform.ARCH=="win32"||UI.Platform.ARCH=="win64"){
			if(cell_i.m_language=='Unix Shell Script'){
				args.push(IO.ProcessUnixFileName("sh.exe"))
			}else{
				args.push(IO.ProcessUnixFileName("%COMSPEC%"))
				args.push("/c")
			}
		}
		var desc=Language.GetDescObjectByName(cell_i.m_language);
		var sext=(dec&&desc.extensions&&desc.extensions[0]||(cell_i.m_language=='Unix Shell Script'?"sh":"bat"));
		var fn_script=IO.GetNewDocumentName("qnb",sext,"temp")
		IO.CreateFile(fn_script,cell_i.doc_in.ed.GetText())
		args.push(fn_script)
		//todo: current directory
		var proc=IO.RunToolRedirected(args,UI.GetPathFromFilename(doc.m_file_name),0)
		//todo
	},
};
W.NotebookView=function(id,attrs){
	var obj=UI.StdWidget(id,attrs,"notebook_view",W.notebook_prototype);
	UI.Begin(obj)
	UI.RoundRect(obj)
	if(!obj.m_cells){
		//we shouldn't make build output clog global metadata - a separate json file
		//just a flat list of cells
		//var notes=UI.m_ui_metadata["<notebooks>"];
		//if(!notes){notes={};UI.m_ui_metadata["<notebooks>"]=notes;}
		//notes[obj.file_name];
		var fn_notes=obj.file_name;
		obj.m_cells=[];
		if(fn_notes){
			try{
				obj.m_cells=JSON.parse(IO.ReadAll(fn_notes)).cells;
			}catch(err){
				obj.m_cells=[];
			}
		}
		//create the initial data objects
		for(var i=0;i<obj.m_cells.length;i++){
			var cell_i=obj.m_cells[i];
			obj.ProcessCell(cell_i);
		}
	}
	//todo: manually-clipped rendering, global scroll bar
	var scroll_y=(obj.scroll_y||0);
	var current_y=-scroll_y;
	var hc=UI.GetCharacterHeight(UI.default_styles.code_editor.editor_style.font);
	for(var i=0;i<obj.m_cells.length;i++){
		var cell_i=obj.m_cells[i];
		var doc_in=cell_i.m_text_in;
		var doc_out=cell_i.m_text_out;
		var h_in=MeasureEditorSize(doc_in,1);
		var h_out=MeasureEditorSize(doc_out,0);
		doc_in.RenderWithLineNumbers(
			doc_in.scroll_x||0,doc_in.scroll_y||0,
			obj.x,obj.y+current_y,obj.w,h_in,
			"doc_in_"+i.toString())
		current_y+=h_in;//+obj.h_gap*0.5
		doc_out.RenderAsWidget("doc_out_"+i.toString(),
			obj.x,obj.y+current_y,obj.w,h_out);
		//doc_out.RenderWithLineNumbers(
		//	doc_out.scroll_x||0,doc_out.scroll_y||0,
		//	obj.x,obj.y+current_y,obj.w,h_out,
		//	"doc_out_"+i.toString())
		current_y+=h_out+obj.h_gap;
	}
	//todo: ctrl+enter, output cell styling, shadows - closely tie together the input / output of the same cell
	//todo: should use full-fledged W.CodeEditor, find and stuff
	//todo: tool bar
	var menu_notebook=UI.BigMenu("Note&book")
	menu_notebook.AddNormalItem({
		text:"&New cell",
		icon:'新',enable_hotkey:1,key:"CTRL+M",action:obj.NewCell.bind(obj)})
	menu_notebook=undefined;
	UI.End()
	return obj
}

UI.NewNoteBookTab=function(title,file_name){
	//var file_name=fname0||IO.GetNewDocumentName("new","txt","document")
	UI.top.app.quit_on_zero_tab=0;
	return UI.NewTab({
		file_name:file_name,
		title:title,
		tooltip:file_name,
		body:function(){
			//use styling for editor themes
			UI.context_parent.body=this.main_widget;
			if(this.main_widget){this.file_name=this.main_widget.file_name}
			var attrs={
				'anchor':'parent','anchor_align':"fill",'anchor_valign':"fill",
				'x':0,'y':0,
				'file_name':this.file_name,
			};
			var body=W.NotebookView("body",attrs)
			if(!this.main_widget){
				this.main_widget=body;
			}
			this.need_save=this.main_widget.need_save;
			return body;
		},
		Save:function(){
			if(!this.main_widget){return;}
			this.main_widget.Save();
			this.need_save=this.main_widget.need_save;
		},
		SaveAs:function(){
			if(!this.main_widget){return;}
			var fn=IO.DoFileDialog(["All File","*.*"],
				this.main_widget.file_name.indexOf('<')>=0?
					UI.m_new_document_search_path+"/*":
					this.main_widget.file_name,
				"",1);
			if(!fn){return;}
			this.file_name=fn
			this.main_widget.file_name=fn
			this.Save()
		},
		SaveMetaData:function(){
			if(this.main_widget){this.main_widget.SaveMetaData();}
		},
		OnDestroy:function(){
			//if(this.main_widget){this.main_widget.OnDestroy();}
		},
		Reload:function(){
			//if(this.main_widget){this.main_widget.Reload();}
		},
		//color_theme:[UI.Platform.BUILD=="debug"?0xff1f1fb4:0xffb4771f],
	})
};
