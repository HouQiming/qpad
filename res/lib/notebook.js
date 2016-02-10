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
	m_configuration:{},
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
	m_cell_plugins:[function(){
		this.m_clickable_ranges=[];
		if(this.read_only){
			//output-only plugins
			var fselchange=function(do_onfocus){
				var sel=this.GetSelection()
				var l=0;
				var r=this.m_clickable_ranges.length-1;
				while(l<=r){
					var m=(l+r)>>1;
					if(this.m_clickable_ranges[m].loc0.ccnt<=sel[0]){
						l=m+1
					}else{
						r=m-1
					}
				}
				if(r>=0&&this.m_clickable_ranges[r].loc0.ccnt<=sel[0]&&sel[1]<=this.m_clickable_ranges[r].loc1.ccnt){
					//yes, it's clickable
					var crange=this.m_clickable_ranges[r]
					crange.f.call(this,do_onfocus,crange.loc0.ccnt,crange.loc1.ccnt)
					return 1
				}
				return 0
			};
			this.AddEventHandler('selectionChange',function(){fselchange.call(this,0);})
			this.AddEventHandler('doubleClick',function(){
				fselchange.call(this,1);
			})
			this.ClearClickableRanges=function(){
				//todo: m_error_overlays ~ highlights
				for(var i=0;i<this.m_clickable_ranges.length;i++){
					var crange=this.m_clickable_ranges[i];
					crange.loc0.discard()
					crange.loc1.discard()
					crange.hlobj.discard()
				}
				this.m_clickable_ranges=[]
			}
		}
		this.AddEventHandler('UP',function(){
			var sel=this.GetSelection();
			if(sel[0]>0||sel[1]>0){return 1;}
			var sub_cell_id=this.sub_cell_id;
			if(sub_cell_id>0){
				this.notebook_owner.GotoSubCell(sub_cell_id-1);
				return 0;
			}
			return 1;
		})
		this.AddEventHandler('DOWN',function(){
			var sel=this.GetSelection();
			var size=this.ed.GetTextSize();
			if(sel[0]<size||sel[1]<size){return 1;}
			var sub_cell_id=this.sub_cell_id;
			if(sub_cell_id<this.notebook_owner.m_cells.length*2-1){
				this.notebook_owner.GotoSubCell(sub_cell_id+1);
				return 0;
			}
			return 1;
		})
	}],
	ProcessCell:function(cell_i){
		//////
		var doc_in=UI.CreateEmptyCodeEditor(cell_i.m_language);
		doc_in.plugins=this.m_cell_plugins;
		doc_in.notebook_owner=this;
		doc_in.Init();
		doc_in.scroll_x=0;doc_in.scroll_y=0;
		if(cell_i.m_text_in){doc_in.ed.Edit([0,0,cell_i.m_text_in],1);}
		cell_i.m_text_in=doc_in;
		//////
		var doc_out=UI.CreateEmptyCodeEditor();
		doc_out.plugins=this.m_cell_plugins;
		doc_out.notebook_owner=this;
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
	GotoSubCell:function(sub_cell_id){
		var obj_cell=this[((sub_cell_id&1)?"doc_out_":"doc_in_")+(sub_cell_id>>1).toString()];
		if(obj_cell&&obj_cell.doc){
			UI.SetFocus(obj_cell.doc)
			UI.Refresh()
		}
	},
	WriteCellOutput:function(id,s){
		//todo: error parser
		var cell_i=this.m_cells[id];
		var ed_out=cell_i.m_text_out.ed;
		var ccnt_tot=ed_out.GetTextSize();
		ed_out.Edit([ccnt_tot,0,s],1);
		UI.Refresh()
	},
	RunCell:function(id){
		var cell_i=this.m_cells[id];
		var ed_out=cell_i.m_text_out.ed;
		if(ed_out.GetTextSize()){
			cell_i.m_text_out.ClearClickableRanges()
			ed_out.Edit([0,ed_out.GetTextSize(),undefined]);
			cell_i.m_text_out.ResetSaveDiff()
		}
		if(id==0&&cell_i.m_language=='Javascript'){
			//run cell 0 as qpad js to update the configuration
			var s_cell_i=cell_i.doc_in.ed.GetText();
			var cfg_eval=undefined;
			var err="";
			try{
				cfg_eval=JSON.parse(Duktape.__eval_expr_sandbox(s_cell_i))
				if(typeof(cfg_eval)!='object'){
					cfg_eval=undefined;
				}
			}catch(e){
				err=e.message;
				cfg_eval=undefined;
			}
			if(cfg_eval!=undefined){
				this.m_configuration=cfg_eval;
				err=JSON.stringify(cfg_eval);
			}
			this.WriteCellOutput(id,err);
			return;
		}
		//direct execution for _nix, %COMSPEC% for Windows
		//coulddo: manual interpreter setup
		var args=[];
		if(this.m_configuration.interpreter){
			args.push(this.m_configuration.m_interpreter)
		}else if(UI.Platform.ARCH=="win32"||UI.Platform.ARCH=="win64"){
			if(cell_i.m_language=='Unix Shell Script'){
				args.push(IO.ProcessUnixFileName("sh.exe"))
			}else{
				args.push(IO.ProcessUnixFileName("%COMSPEC%"))
				args.push("/c")
			}
		}
		var desc=Language.GetDescObjectByName(cell_i.m_language);
		var sext=(desc&&desc.extensions&&desc.extensions[0]||(cell_i.m_language=='Unix Shell Script'?"sh":"bat"));
		var fn_script=IO.GetNewDocumentName("qnb",sext,"temp")
		IO.CreateFile(fn_script,cell_i.m_text_in.ed.GetText())
		args.push(fn_script)
		var proc=IO.RunToolRedirected(args,this.m_configuration.path||UI.GetPathFromFilename(this.file_name),0)
		if(proc){
			var fpoll=(function(){
				var s=proc.Read(65536)
				//print('fpoll',s,JSON.stringify(args),proc.IsRunning())
				if(s){
					this.WriteCellOutput(id,s)
					UI.NextTick(fpoll)
				}else if(proc.IsRunning()){
					UI.setTimeout(fpoll,100)
				}else{
					var code=proc.GetExitCode()
					if(code!=0){
						this.WriteCellOutput(id,this.file_name+":1:1: fatal error: the script has returned an error\n")
					}
					IO.DeleteFile(fn_script)
				}
			}).bind(this)
			UI.NextTick(fpoll)
		}else{
			this.WriteCellOutput(id,this.file_name+":1:1: fatal error: failed to execute the script\n")
		}
		UI.Refresh()
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
	//todo: manually-culling, global scroll bar
	//todo: time / running status in caption
	var scroll_y=(obj.scroll_y||0);
	var current_y=-scroll_y;
	var widget_style=UI.default_styles.code_editor;
	var edstyle=widget_style.editor_style;
	var hc=UI.GetCharacterHeight(edstyle.font);
	for(var i=0;i<obj.m_cells.length;i++){
		var cell_i=obj.m_cells[i];
		var doc_in=cell_i.m_text_in;
		var doc_out=cell_i.m_text_out;
		var h_in=MeasureEditorSize(doc_in,0);
		var h_out=MeasureEditorSize(doc_out,0);
		current_y+=obj.padding;
		UI.RoundRect({
			x:obj.x+obj.padding-obj.shadow_size,y:obj.y+current_y-obj.shadow_size,
			w:obj.w-obj.padding*2+obj.shadow_size*2,h:h_in+obj.h_caption*2+h_out+obj.shadow_size*2,
			round:obj.shadow_size,
			border_width:-obj.shadow_size,
			color:obj.shadow_color,
		})
		var is_focused=(UI.nd_focus&&UI.nd_focus==doc_in);
		UI.RoundRect({
			x:obj.x+obj.padding,y:obj.y+current_y,
			w:obj.w-obj.padding*2,h:obj.h_caption,
			color:is_focused?obj.caption_color:widget_style.line_number_bgcolor,
		})
		W.Text("",{
			x:obj.x+obj.padding+obj.caption_padding,y:obj.y+current_y,
			font:obj.caption_font,text:cell_i.m_language,
			color:is_focused?obj.caption_text_color:widget_style.line_number_color,
		})
		current_y+=obj.h_caption;
		W.CodeEditor("doc_in_"+i.toString(),{
			doc:doc_in,
			x:obj.x+obj.padding,y:obj.y+current_y,w:obj.w-obj.padding*2,h:h_in+hc,
		})
		doc_in.sub_cell_id=i*2+0;
		//var w_line_numbers=doc_in.m_rendering_w_line_numbers+UI.default_styles.code_editor.padding;
		//doc_in.RenderWithLineNumbers(
		//	doc_in.scroll_x||0,doc_in.scroll_y||0,
		//	obj.x,obj.y+current_y,obj.w,h_in,
		//	"doc_in_"+i.toString())
		current_y+=h_in;
		is_focused=(UI.nd_focus&&UI.nd_focus==doc_out);
		UI.RoundRect({
			x:obj.x+obj.padding,y:obj.y+current_y,
			w:obj.w-obj.padding*2,h:obj.h_caption,
			color:is_focused?obj.caption_color:widget_style.line_number_bgcolor,
		})
		W.Text("",{
			x:obj.x+obj.padding+obj.caption_padding,y:obj.y+current_y,
			font:obj.caption_font,text:"Output",
			color:is_focused?obj.caption_text_color:widget_style.line_number_color,
		})
		current_y+=obj.h_caption;
		//UI.RoundRect({
		//	x:obj.x+obj.padding,y:obj.y+current_y,w:obj.w-obj.padding*2,h:h_out,
		//	color:UI.default_styles.code_editor.bgcolor,
		//})
		//doc_out.RenderAsWidget("doc_out_"+i.toString(),
		//	obj.x+obj.padding+w_line_numbers,obj.y+current_y,obj.w-w_line_numbers,h_out);
		W.CodeEditor("doc_out_"+i.toString(),{
			doc:doc_out,
			read_only:doc_out.read_only,
			//x:obj.x+obj.padding,y:obj.y+current_y,w:obj.w-obj.padding*2,h:h_in+hc,
			x:obj.x+obj.padding,y:obj.y+current_y,w:obj.w-obj.padding*2,h:h_out,
		})
		doc_out.sub_cell_id=i*2+1;
		//doc_out.RenderWithLineNumbers(
		//	doc_out.scroll_x||0,doc_out.scroll_y||0,
		//	obj.x,obj.y+current_y,obj.w,h_out,
		//	"doc_out_"+i.toString())
		current_y+=h_out;
		current_y+=obj.padding;
		current_y+=obj.h_separation;
	}
	//todo: tool bar
	var menu_notebook=UI.BigMenu("Note&book")
	menu_notebook.AddNormalItem({
		text:"&New cell",
		icon:'新',enable_hotkey:1,key:"CTRL+M",action:obj.NewCell.bind(obj)})
	var focus_cell_id=undefined;
	for(var i=0;i<obj.m_cells.length;i++){
		var cell_i=obj.m_cells[i];
		var doc_in=cell_i.m_text_in;
		if(doc_in==UI.nd_focus){
			focus_cell_id=i;
			break;
		}
	}
	if(focus_cell_id!=undefined){
		menu_notebook.AddNormalItem({
			text:"&Run cell",
			enable_hotkey:1,key:"CTRL+RETURN",action:(function(){
				this.RunCell(focus_cell_id)
			}).bind(obj)})
	}
	menu_notebook=undefined;
	UI.End()
	return obj
}

UI.NewNoteBookTab=function(title,file_name){
	//var file_name=fname0||IO.GetNewDocumentName("new","txt","document")
	file_name=IO.NormalizeFileName(file_name);
	UI.top.app.quit_on_zero_tab=0;
	return UI.NewTab({
		file_name:file_name,
		title:title,
		tooltip:file_name,
		document_type:"notebook",
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
