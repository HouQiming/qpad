// need_save|=65536: a superfluous change that should be saved automatically without even showing '*'
var UI=require("gui2d/ui");
var W=require("gui2d/widgets");
var Language=require("res/lib/langdef");
require("res/lib/global_doc");
require("res/lib/code_editor");

var MeasureEditorSize=function(doc,w_content){
	var ed=doc.ed;
	var ccnt_tot=ed.GetTextSize();
	var hc=ed.GetCharacterHeightAt(ccnt_tot);
	var ytot=ed.XYFromCcnt(ccnt_tot).y+hc;
	if(doc.NeedXScrollAtWidth(w_content)){
		ytot+=UI.default_styles.code_editor.w_scroll_bar;
	}
	return ytot;
};

var g_re_errors=new RegExp("^error_.*$")
var g_re_cancel_note=new RegExp("^cancel_notification$");
UI.RegisterEditorPlugin(function(){
	if(this.plugin_class!="code_editor"||!this.m_is_main_editor){return;}
	//do not reload errors
	//this.AddEventHandler('load',function(){})
	this.m_error_overlays=[]
	this.AddEventHandler('save',function(){
		for(var i=0;i<this.m_error_overlays.length;i++){
			var err=this.m_error_overlays[i];
			if(!err.is_in_active_doc){continue;}
			err.ccnt0=err.sel_ccnt0.ccnt;
			err.ccnt1=err.sel_ccnt1.ccnt;
		}
	})
	this.AddEventHandler('close',function(){
		for(var i=0;i<this.m_error_overlays.length;i++){
			var err=this.m_error_overlays[i];
			if(!err.is_in_active_doc){continue;}
			err.is_in_active_doc=0;
			err.sel_ccnt0=undefined;
			err.sel_ccnt1=undefined;
			err.highlight=undefined;
		}
	})
	this.AddEventHandler('selectionChange',function(){
		if(this.owner){
			this.owner.DismissNotificationsByRegexp(g_re_errors);
		}
	})
	this.AddEventHandler('menu',function(){
		var ed=this.ed;
		var sel=this.GetSelection()
		if(sel[0]==sel[1]){
			var error_overlays=this.m_error_overlays
			if(error_overlays&&error_overlays.length){
				var ccnt=sel[0]
				var error_overlays_new=[];
				for(var i=0;i<error_overlays.length;i++){
					var err=error_overlays[i]
					if(!err.is_in_active_doc){continue;}
					if(ccnt>=err.sel_ccnt0.ccnt&&ccnt<=err.sel_ccnt1.ccnt){
						var color=(err.color||this.color_tilde_compiler_error)
						this.owner.CreateNotification({
							id:"error_"+err.id.toString(),icon:'警',
							text:err.message,
							icon_color:color,
							//text_color:color,
							color:UI.lerp_rgba(color,UI.default_styles.code_editor_notification.color,UI.TestOption("use_light_theme")?0.95:0.75),
						},"quiet")
					}
					error_overlays_new.push(err);
				}
				this.m_error_overlays=error_overlays_new;
			}
		}
		return 0;
	})
});//.prototype.desc={category:"Tools",name:"Error overlays",stable_name:"error_overlay"};

var AddErrorToEditor=function(doc,err){
	if(err.is_in_active_doc){return;}
	if(err.is_quiet){return;}
	var hl_items=doc.CreateTransientHighlight({
		'depth':1,
		'color':err.color||doc.color_tilde_compiler_error,
		'display_mode':UI.HL_DISPLAY_MODE_TILDE,
		'invertible':0,
	});
	hl_items[0].ccnt=err.ccnt0;err.sel_ccnt0=hl_items[0];hl_items[0].undo_tracked=1
	hl_items[1].ccnt=err.ccnt1;err.sel_ccnt1=hl_items[1];hl_items[1].undo_tracked=1
	err.highlight=hl_items[2];
	err.id=doc.m_error_overlays.length
	err.is_in_active_doc=1
	////////////
	doc.m_error_overlays.push(err)
}

var JsifyBuffer=function(a){
	var ret=[];
	for(var i=0;i<a.length;i++){
		ret[i]=a[i];
	}
	return ret;
};

//output parser system
var g_output_parsers=[];
var g_processed_output_parser=undefined;
UI.RegisterOutputParser=function(s_regex_string,n_brackets,fmatch_to_err){
	g_output_parsers.push({s:s_regex_string,n:n_brackets,f:fmatch_to_err});
	g_processed_output_parser=undefined;
};

var MAX_PARSABLE_LINE=1024;
var ParseOutput=function(sline){
	if(Duktape.__byte_length(sline)>MAX_PARSABLE_LINE){return undefined;}
	if(!g_processed_output_parser){
		//create the grand regexp
		var regex=new RegExp(["^(",g_output_parsers.map(function(a){return a.s}).join(")|("),")\r?\n"].join(""))
		var match_places=[];
		var cur_id=1;
		for(var i=0;i<g_output_parsers.length;i++){
			match_places.push(cur_id);
			cur_id++;
			cur_id+=g_output_parsers[i].n;
			match_places.push(cur_id);
		}
		g_processed_output_parser={
			m_big_regex:regex,
			m_match_places:match_places
		};
	}
	//var tick0=Duktape.__ui_get_tick();
	var big_match=undefined;
	try{
		big_match=sline.match(g_processed_output_parser.m_big_regex);
	}catch(err){
		//we may exceed the regexp step limit
	}
	//print(Duktape.__ui_seconds_between_ticks(tick0,Duktape.__ui_get_tick()),sline)
	if(!big_match){return undefined;}
	var match_places=g_processed_output_parser.m_match_places;
	for(var i=0;i<match_places.length;i+=2){
		var p_tester=match_places[i];
		if(big_match[p_tester]){
			return g_output_parsers[i>>1].f(big_match.slice(match_places[i],match_places[i+1]))
		}
	}
	return undefined;
}

UI.RegisterCodeEditorPersistentMember("m_compiler_name");
UI.RegisterBuildEnv=function(s_lang_name,obj){
	var desc=Language.GetDescObjectByName(s_lang_name);
	if(!desc.m_buildenvs){
		desc.m_buildenvs=[];
		desc.m_buildenv_by_name={};
		desc.m_buildenv_default_default=obj.name;
	}
	desc.m_buildenvs.push(obj);
	desc.m_buildenv_by_name[obj.name]=obj;
};
UI.GetDefaultBuildEnv=function(s_lang){
	var s_name_default=undefined;
	var compiler_assoc=UI.m_ui_metadata["<compiler_assoc>"];
	if(!compiler_assoc){
		compiler_assoc={};
		UI.m_ui_metadata["<compiler_assoc>"]=compiler_assoc;
	}
	s_name_default=compiler_assoc[s_lang];
	if(!s_name_default){
		var desc=Language.GetDescObjectByName(s_lang);
		s_name_default=desc.m_buildenv_default_default;
	}
	return s_name_default;
}

W.cell_caption_prototype={
	OnMouseDown:function(event){
		if(event.clicks>=2){
			UI.SetFocus(this.owner.cell_list);
			this.owner.cell_list.OnChange(this.m_cell_id);
			this.OnMouseUp(event);
			this.OnDblClick(event);
			return;
		}
		if(event.button==UI.SDL_BUTTON_MIDDLE){
			this.owner.DeleteCell(this.m_cell_id);
			this.owner.m_set_focus_cell_list=1;
			return;
		}
		if(this.owner.cell_list){
			UI.SetFocus(this.owner.cell_list);
			this.owner.cell_list.OnChange(this.m_cell_id);
		}else{
			this.owner.m_last_focus_cell_id=this.m_cell_id*2;
		}
		this.owner.need_save|=65536;
		this.m_drag_ctx={
			cells0:this.owner.m_cells,
			dragging_cell_id:this.m_cell_id,
			dragging_dy:this.y+this.h*0.5-event.y,
			rendering_dy:this.y-event.y,
		};
		this.owner.m_sel_rendering_y=this.y;
		for(var i=0;i<this.owner.m_cells.length;i++){
			this.owner.m_cells[i].m_temp_unique_name='$temp_'+i.toString();
			if(this.owner.cell_list){
				this.owner.cell_list[this.owner.m_cells[i].m_temp_unique_name]=this.owner.cell_list['$'+i.toString()];
			}
		}
		UI.CaptureMouse(this);
	},
	OnMouseMove:function(event){
		var ctx=this.m_drag_ctx;
		if(!ctx){return;}
		var cell_list=this.owner.cell_list;
		if(!cell_list){UI.Refresh();return;}
		this.owner.m_sel_rendering_y=ctx.rendering_dy+event.y;
		UI.SetFocus(cell_list);
		var cells1=[];
		var did=0;
		var is_invalid=0;
		for(var i=0;i<ctx.cells0.length;i++){
			if(i==ctx.dragging_cell_id){continue;}
			var obj_caption_i=cell_list[ctx.cells0[i].m_temp_unique_name];
			if(!obj_caption_i){
				is_invalid=1;
				break;
			}
			if(!did&&obj_caption_i.y+obj_caption_i.h*0.5>event.y+ctx.dragging_dy){
				if(cells1.length!=ctx.dragging_cell_id){
					ctx.m_dragged=1;
				}
				this.owner.m_last_focus_cell_id=cells1.length*2;
				cells1.push(ctx.cells0[ctx.dragging_cell_id]);
				did=1;
			}
			cells1.push(ctx.cells0[i]);
		}
		if(!is_invalid&&!did){
			if(cells1.length!=ctx.dragging_cell_id){
				ctx.m_dragged=1;
			}
			this.owner.m_last_focus_cell_id=cells1.length*2;
			cells1.push(ctx.cells0[ctx.dragging_cell_id]);
			did=1;
		}
		if(!is_invalid&&ctx.m_dragged){
			this.owner.m_cells=cells1;
		}
		UI.Refresh();
	},
	OnMouseUp:function(event){
		this.OnMouseMove(event);
		if(this.m_drag_ctx&&this.m_drag_ctx.m_dragged){
			this.owner.InvalidateCellList();
			this.owner.m_set_focus_cell_list=1;
			this.owner.need_save|=2;
		}
		UI.ReleaseMouse(this);
		this.m_drag_ctx=undefined;
		this.owner.m_sel_rendering_y=undefined;
		for(var i=0;i<this.owner.m_cells.length;i++){
			if(this.owner.cell_list&&this.owner.m_cells[i].m_temp_unique_name){
				this.owner.cell_list['$'+i.toString()]=this.owner.cell_list[this.owner.m_cells[i].m_temp_unique_name];
			}
			this.owner.m_cells[i].m_temp_unique_name=undefined;
		}
		UI.Refresh();
	},
	OnDblClick:function(){
		this.owner.RunCell(this.m_cell_id);
	},
	OnKeyDown:function(event){
		if(UI.IsHotkey(event,"DELETE")){
			this.owner.DeleteCell(this.m_cell_id);
			this.owner.m_set_focus_cell_list=1;
		}else if(UI.IsHotkey(event,"CTRL+D")){
			var obj=this.owner;
			obj.DupCell();
		}
	},
	OnMouseWheel:function(event){
		if(this.owner.cell_list){
			this.owner.cell_list.OnMouseWheel(event);
		}
	},
};
W.CellCaption=function(id,attrs){
	var obj=UI.StdWidget(id,attrs,"notebook_cell_caption",W.cell_caption_prototype);
	UI.Begin(obj)
		//var bky=obj.y;
		if(obj.owner.m_sel_rendering_y!=undefined&&obj.selected){
			obj.y=obj.owner.m_sel_rendering_y;
		}
		W.PureRegion(id,obj)
		//var sel_bgcolor=obj.owner.activated?obj.mystyle.sel_bgcolor:obj.mystyle.sel_bgcolor_deactivated;
		//if(obj.selected){
		//	UI.RoundRect({
		//		x:obj.x+4,y:obj.y+4,w:obj.w-8,h:obj.h-8,
		//		color:sel_bgcolor})
		//}
		var panel_style=UI.default_styles.notebook_view_v2.panel_style;
		var sel_bgcolor=(UI.nd_focus==obj.owner.cell_list)?obj.mystyle.sel_bgcolor:obj.mystyle.sel_bgcolor_deactivated;
		if(obj.special=='add'){
			W.Button("add_button",{
				x:obj.x,y:obj.y,w:obj.w,h:obj.h-4,
				text:UI._('Add cell'),
				style:obj.button_style,
				OnClick:function(){
					obj.owner.NewCell();
					UI.Refresh();
				}
			})
			UI.End();
			return obj;
		}
		if(obj.selected){
			var shadow_size=panel_style.button_area_shadow_size;
			UI.TopMostWidget(function(obj_y){
				UI.PushCliprect(obj.x,obj.owner.y,obj.w,obj.owner.h);
				UI.RoundRect({
					x:obj.x-shadow_size,y:obj_y-shadow_size,w:obj.w+shadow_size*2,h:obj.h+shadow_size*2,
					color:panel_style.button_area_shadow_color,
					round:shadow_size,border_width:-shadow_size})
				UI.RoundRect({
					x:obj.x,y:obj_y,w:obj.w,h:obj.h,
					color:panel_style.cell_list_bgcolor})
				UI.RoundRect({
					x:obj.x,y:obj_y,w:4,h:obj.h,
					color:sel_bgcolor})
				UI.PopCliprect();
			}.bind(null,obj.y));
			//UI.RoundRect({
			//	x:obj.x+obj.w,y:obj.y,w:16,h:obj.h,
			//	color:[
			//		{x:0,y:0,color:panel_style.cell_list_bgcolor},
			//		{x:1,y:0,color:panel_style.cell_list_bgcolor&0x00ffffff},
			//	]})
		}
		var name_color=(obj.text[0]=='\u2022'?obj.mystyle.dumb_name_color:obj.mystyle.name_color);
		var font=obj.mystyle.font;
		var dims=UI.MeasureText(font,obj.text);
		var frender=function(){
			W.Text("",{
				x:obj.x+8,y:obj.y+(obj.h-dims.h)*0.5-2,
				font:font,text:obj.text,color:name_color,
			});
			if(obj.progress>0){
				var y_progress_bar=obj.y+(obj.h-dims.h)*0.5+dims.h-1;
				var w_bar=(obj.w-16);
				if(obj.progress_mode=='normal'){
					UI.RoundRect({
						x:obj.x+8,y:y_progress_bar,
						w:w_bar*obj.progress,h:3,
						color:sel_bgcolor,
						round:1.5,
					});
				}else{//'unknown'
					var p0=Math.max(obj.progress-panel_style.unknown_progress_bar_length,0);
					UI.RoundRect({
						x:obj.x+8+w_bar*p0,y:y_progress_bar,
						w:w_bar*(Math.min(obj.progress,1)-p0),h:3,
						color:sel_bgcolor,
						round:1.5,
					});
					var p1=Math.max(obj.progress-1,0)
					if(p1>0){
						p0=Math.max(p1-panel_style.unknown_progress_bar_length,0);
						UI.RoundRect({
							x:obj.x+8+w_bar*p0,y:y_progress_bar,
							w:w_bar*(p1-p0),h:3,
							color:sel_bgcolor,
							round:1.5,
						});
					}
				}
			}
		}
		if(obj.selected){
			UI.TopMostWidget(frender);
		}else{
			frender();
		}
		//obj.y=bky;
	UI.End()
	return obj
};

var g_regexp_abspath=new RegExp("^(([a-zA-Z]:/)|(/)|[~])");
W.notebook_prototype={
	Save:function(){
		var docs=[];
		var procs=[];
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
			procs[i]=cell_i.m_proc;cell_i.m_proc=undefined;
		}
		var s=JSON.stringify({cells:this.m_cells,m_last_focus_cell_id:this.m_last_focus_cell_id},null,1)
		var save_ret=UI.SafeSave(this.file_name,s);
		//var sz_std=Duktape.__byte_length(s);
		//var sz_written=IO.CreateFile(this.file_name,s);
		this.m_loaded_time=IO.GetFileTimestamp(this.file_name);
		for(var i=0;i<this.m_cells.length;i++){
			var cell_i=this.m_cells[i];
			cell_i.m_text_in=docs[i*2+0];
			cell_i.m_text_out=docs[i*2+1];
			cell_i.m_proc=procs[i];
		}
		//if(!(sz_written>=sz_std)){
		//	return 0;
		//}
		if(!save_ret){
			return 0;
		}
		this.need_save=0;
		UI.RefreshAllTabs()
		return 1;
	},
	SaveMetaData:function(){
		//for now, we do not save editor metadata on notebooks...
	},
	m_cell_plugins:[function(){
		this.m_clickable_ranges=[];
		this.disable_line_numbers=1;
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
			//this.AddEventHandler('selectionChange',function(){fselchange.call(this,0);})
			this.AddEventHandler('doubleClick',function(){
				if(fselchange.call(this,1)){
					this.is_dragging=0;
					UI.ReleaseMouse(this);
				}
			})
			this.ClearClickableRanges=function(){
				for(var i=0;i<this.m_clickable_ranges.length;i++){
					var crange=this.m_clickable_ranges[i];
					crange.loc0.discard()
					crange.loc1.discard()
					crange.hlobj.discard()
					var err=crange.err;
					if(err.is_in_active_doc){
						//print("cleared error: ",i,err.message)
						err.is_in_active_doc=0;
						err.sel_ccnt0.discard()
						err.sel_ccnt1.discard()
						err.highlight.discard()
					}
					err.is_in_active_doc=undefined;
				}
				this.m_clickable_ranges=[]
			}
		}
		this.AddEventHandler('UP',function(){
			var sel=this.GetSelection();
			if(sel[0]!=sel[1]){return 1;}
			var y=this.ed.XYFromCcnt(sel[1]).y;
			if(y>0){return 1;}
			var sub_cell_id=this.sub_cell_id;
			if(sub_cell_id>0){
				var tar_id=sub_cell_id-1;
				while(tar_id>=0){
					if(this.notebook_owner.GotoSubCell(tar_id,1)){
						break;
					}
					tar_id--;
				}
				return 0;
			}
			return 1;
		})
		this.AddEventHandler('DOWN',function(){
			var sel=this.GetSelection();
			var size=this.ed.GetTextSize();
			if(sel[0]!=sel[1]){return 1;}
			var y=this.ed.XYFromCcnt(sel[1]).y;
			if(y<this.ed.XYFromCcnt(size).y){return 1;}
			var sub_cell_id=this.sub_cell_id;
			if(sub_cell_id<this.notebook_owner.m_cells.length*2-1){
				var tar_id=sub_cell_id+1;
				while(tar_id<this.notebook_owner.m_cells.length*2){
					if(this.notebook_owner.GotoSubCell(tar_id,0)){
						break;
					}
					tar_id++;
				}
				return 0;
			}
			return 1;
		})
		this.AddEventHandler('selectionChange',function(){
			UI.Refresh();
		})
		if(!this.read_only){
			//interpreter selection
			this.AddEventHandler('menu',function(){
				var desc=this.plugin_language_desc;
				if(desc.m_buildenvs&&desc.m_buildenvs.length>1){
					var menu_run=UI.BigMenu("&Run");
					var obj_notebook=this.notebook_owner;
					var cell_id=this.m_cell_id;
					var cur_compiler_name=(obj_notebook.m_cells[cell_id].m_compiler_name||UI.GetDefaultBuildEnv(obj_notebook.m_cells[cell_id].m_language));
					for(var i=0;i<desc.m_buildenvs.length;i++){
						var s_name_i=desc.m_buildenvs[i].name;
						menu_run.AddNormalItem({
							text:s_name_i,
							icon:(cur_compiler_name==s_name_i)?"对":undefined,
							action:function(name){
								this.m_compiler_name=name;
								UI.Refresh();
							}.bind(obj_notebook.m_cells[cell_id],s_name_i)})
					}
					menu_run=undefined;
				}
			})
			//button list update
			this.AddEventHandler('change',function(){
				var s_check=this.ed.GetText(0,Math.min(this.ed.GetTextSize(),4096));
				var obj_notebook=this.notebook_owner;
				var cell_id=this.m_cell_id;
				if(obj_notebook.m_cells[cell_id]){
					var match=s_check.match(/\[button: (.+)\]/);
					if(match){
						obj_notebook.m_cells[cell_id].m_button_name=match[1];
					}else{
						match=s_check.match(/build script for '(.+)'/);
						if(match){
							obj_notebook.m_cells[cell_id].m_button_name="\u2022 "+match[1];
						}else{
							match=s_check.match(/^#[ \t]*(.+)\n/);
							if(match){
								obj_notebook.m_cells[cell_id].m_button_name=match[1];
							}else if(s_check=='Search result'){
								obj_notebook.m_cells[cell_id].m_button_name="\u2022 Search result";
							}else{
								obj_notebook.m_cells[cell_id].m_button_name=undefined;
							}
						}
					}
				}
				//obj_notebook.m_buttons=undefined;
				UI.Refresh();
			})
		}
	}],
	ProcessCell:function(cell_i){
		//////
		var doc_in=UI.CreateEmptyCodeEditor(cell_i.m_language);
		doc_in.plugins=this.m_cell_plugins;
		doc_in.wrap_width=0;
		doc_in.m_enable_wrapping=0;
		doc_in.m_current_wrap_width=512;
		doc_in.notebook_owner=this;
		doc_in.disable_x_scroll=1;
		doc_in.Init();
		doc_in.scroll_x=0;doc_in.scroll_y=0;
		if(cell_i.m_text_in){doc_in.ed.Edit([0,0,cell_i.m_text_in],1);}
		doc_in.saved_point=doc_in.ed.GetUndoQueueLength();
		cell_i.m_text_in=doc_in;
		//////
		var doc_out=UI.CreateEmptyCodeEditor();
		doc_out.plugins=this.m_cell_plugins;
		doc_out.wrap_width=0;
		doc_out.m_enable_wrapping=0;
		doc_out.m_current_wrap_width=512;
		doc_out.notebook_owner=this;
		doc_out.read_only=1;
		doc_out.Init();
		doc_out.scroll_x=0;doc_out.scroll_y=0;
		if(cell_i.m_text_out){doc_out.ed.Edit([0,0,cell_i.m_text_out],1);}
		cell_i.m_text_out=doc_out;
	},
	Load:function(){
		var fn_notes=this.file_name;
		this.m_cells=[];
		if(fn_notes){
			this.m_loaded_time=IO.GetFileTimestamp(fn_notes);
			try{
				var json_obj=JSON.parse(IO.ReadAll(fn_notes));
				this.m_cells=json_obj.cells;
				this.m_last_focus_cell_id=(json_obj.m_last_focus_cell_id||0);
			}catch(err){
				this.m_cells=[];
				this.m_last_focus_cell_id=0;
			}
		}
		//create the initial data thisects
		for(var i=0;i<this.m_cells.length;i++){
			var cell_i=this.m_cells[i];
			this.ProcessCell(cell_i);
			cell_i.m_text_in.m_cell_id=i;
			cell_i.m_text_in.CallOnChange();
		}
		//if(!this.m_cells.length){
		//	this.NewCell();
		//}
	},
	Reload:function(){
		for(var i=0;i<this.m_cells.length;i++){
			this.ClearCellOutput(i)
			var doc_in=this.m_cells[i].m_text_in;
			var doc_out=this.m_cells[i].m_text_out;
			doc_in.OnDestroy();
			doc_out.OnDestroy();
			this["doc_in_"+i.toString()]=undefined;
			this["doc_out_"+i.toString()]=undefined;
		}
		this.m_cells=undefined;
		this.Load()
	},
	NewCell:function(template,id_add_after,is_quiet){
		var cell_i=(template||{});
		if(cell_i.m_language==undefined){
			cell_i.m_language=(UI.Platform.ARCH=="win32"||UI.Platform.ARCH=="win64")?"Windows BAT":'Unix Shell Script';
		}
		this.ProcessCell(cell_i)
		if(id_add_after==undefined){
			this.m_cells.push(cell_i);
		}else{
			var ret=[];
			for(var i=0;i<this.m_cells.length;i++){
				ret.push(this.m_cells[i]);
				if(i==id_add_after){
					ret.push(cell_i);
				}
			}
			this.m_cells=ret;
		}
		for(var i=0;i<this.m_cells.length;i++){
			this.m_cells[i].m_cell_id=i;
		}
		this.need_save|=2;
		///////////
		cell_i.m_text_in.saved_point=-1;
		if(this.cell_list&&UI.nd_focus==this.cell_list){
			this.m_set_focus_cell_list=1;
		}
		if(is_quiet){
			this.m_last_focus_cell_id=cell_i.m_cell_id*2;
		}else{
			this.GotoSubCell(cell_i.m_cell_id*2);
		}
		this.InvalidateCellList();
		UI.Refresh();
	},
	DupCell:function(){
		var cell_i=undefined;
		if(this.m_last_focus_cell_id!=undefined){
			cell_i=this.m_cells[this.m_last_focus_cell_id>>1];
		}
		if(cell_i){
			var bk_proc=cell_i.m_proc;
			cell_i.m_proc=undefined;
			this.NewCell(JSON.parse(JSON.stringify(cell_i)),this.m_last_focus_cell_id>>1);
			cell_i.m_proc=bk_proc;
		}
	},
	SwapCells:function(id0,id1){
		var tmp=undefined;
		var s0="doc_in_"+id0.toString();
		var s1="doc_in_"+id1.toString();
		tmp=this[s0];this[s0]=this[s1];this[s1]=tmp;
		s0="doc_out_"+id0.toString();
		s1="doc_out_"+id1.toString();
		tmp=this[s0];this[s0]=this[s1];this[s1]=tmp;
		tmp=this.m_cells[id0];this.m_cells[id0]=this.m_cells[id1];this.m_cells[id1]=tmp;
		UI.Refresh()
	},
	GetSpecificCell:function(s_mark,s_language,create_if_not_found){
		//cell name? no need, could put "@echo off" in the mark if needed
		var lg=Duktape.__byte_length(s_mark);
		for(var i=0;i<this.m_cells.length;i++){
			var cell_i=this.m_cells[i];
			var doc_in=cell_i.m_text_in;
			if(doc_in.ed.GetTextSize()>=lg&&doc_in.ed.GetText(0,lg)==s_mark){
				return i;
			}
		}
		if(!create_if_not_found){return -1;}
		var id=this.m_cells.length;
		this.NewCell({m_language:s_language,m_text_in:s_mark},undefined,"quiet")
		return id;
	},
	DeleteCell:function(id){
		var ret=[];
		for(var i=0;i<this.m_cells.length;i++){
			if(i==id){
				var proc_desc=this.m_cells[i].m_proc;
				if(proc_desc){
					proc_desc.proc.Terminate()
					UI.Refresh()
					return;
				}
				this.ClearCellOutput(i)
				continue;
			}
			ret.push(this.m_cells[i]);
		}
		this.m_cells=ret;
		for(var i=0;i<this.m_cells.length;i++){
			this.m_cells[i].m_cell_id=i;
		}
		this.need_save|=2;
		this.InvalidateCellList();
		this.m_last_focus_cell_id=Math.max(Math.min(this.m_last_focus_cell_id,(this.m_cells.length-1)*2),0);
		UI.Refresh()
	},
	GetSubCell:function(sub_cell_id){
		var cur_cell=this.m_cells[sub_cell_id>>1];
		if(cur_cell){
			return ((sub_cell_id&1)?cur_cell.m_text_out:cur_cell.m_text_in);
		}
		return undefined;
	},
	GotoSubCell:function(sub_cell_id,sel_side){
		var doc=this.GetSubCell(sub_cell_id);
		if(!doc){
			return 0;
		}
		if((sub_cell_id&1)&&!(doc.ed.GetTextSize()>0)){
			return 0;
		}
		this.m_last_focus_cell_id=sub_cell_id;
		this.need_save|=65536;
		if(this.cell_list){
			this.cell_list.value=(sub_cell_id>>1);
			this.cell_list.AutoScroll();
			//console.log(this.cell_list.value,this.cell_list.position);
		}
		UI.SetFocus(doc)
		if(sel_side!=undefined){
			var ccnt=0;
			if(sel_side>0){
				ccnt=doc.ed.GetTextSize()
			}
			doc.SetSelection(ccnt,ccnt)
		}
		UI.Refresh()
		return 1;
	},
	CreateCompilerError:function(id,err,ccnt_lh,ccnt_next){
		//we could afford to discard dangling highlights - give discard responsibility to the cell
		var cell_i=this.m_cells[id];
		var edstyle=UI.default_styles.code_editor.editor_style;
		err.is_in_active_doc=0;//the callback may end up getting called later than error clearing
		err.color=((err.category||'error')=='error'?edstyle.color_tilde_compiler_error:edstyle.color_tilde_compiler_warning);
		err.cell_id=id;
		var fn_raw=err.file_name;
		if(cell_i.m_current_path&&!(err.file_name.search(g_regexp_abspath)>=0)&&!IO.FileExists(err.file_name)){
			err.file_name=cell_i.m_current_path+'/'+err.file_name;
		}
		err.file_name=IO.NormalizeFileName(err.file_name);
		//coulddo: UI.ED_SearchIncludeFile, but shouldn't need it
		if(!err.is_quiet&&IO.FileExists(err.file_name)){
			UI.OpenEditorWindow(err.file_name,function(){
				var go_prev_line=0
				if(err.is_in_active_doc==undefined){return;}
				if(err.line1==undefined){
					err.line1=err.line0
				}
				if(err.col0==undefined){
					err.col0=0;
					err.col1=0;
					if(err.line0==err.line1){
						err.line1++
						go_prev_line=1
					}
				}else if(err.col1==undefined){
					err.col1=1e9;
				}
				//if(err.col0==err.col1&&err.line0==err.line1){
				//	err.col1++;
				//}
				//for(var shit in this){
				//	print(shit,this[shit])
				//}
				err.ccnt0=this.SeekLC(err.line0,err.col0)
				err.ccnt1=this.SeekLC(err.line1,err.col1)
				if(!(err.ccnt1>err.ccnt0)){err.ccnt1=err.ccnt0+1;}
				if(go_prev_line&&err.ccnt1>err.ccnt0){err.ccnt1--}
				/////////////////
				AddErrorToEditor(this,err)
			},"quiet")
		}
		var fclick_callback=function(do_onfocus,raw_edit_ccnt0,raw_edit_ccnt1){
			if(!err.is_in_active_doc){
				UI.OpenEditorWindow(err.file_name,function(){
					this.SetSelection(err.ccnt0,err.ccnt0)
					this.CallOnSelectionChange();
					if(do_onfocus){
						UI.SetFocus(this)
					}
					AddErrorToEditor(this,err)
				})
			}else{
				UI.OpenEditorWindow(err.file_name,function(){
					this.SetSelection(err.sel_ccnt0.ccnt,err.sel_ccnt0.ccnt)
					this.CallOnSelectionChange();
					if(do_onfocus){
						UI.SetFocus(this)
					}
				})
			}
			this.SetSelection(ccnt_lh,ccnt_next)
		}
		var doc=cell_i.m_text_out;
		cell_i.m_has_any_error=1;
		var loc0=doc.ed.CreateLocator(ccnt_lh,1)
		var loc1=doc.ed.CreateLocator(ccnt_next,-1)
		var hlobj=doc.ed.CreateHighlight(loc0,loc1,-1)
		hlobj.color=doc.color;
		hlobj.display_mode=UI.HL_DISPLAY_MODE_EMBOLDEN
		hlobj.invertible=0;
		doc.m_clickable_ranges.push({
			loc0:loc0,
			loc1:loc1,
			hlobj:hlobj,
			err:err,
			f:fclick_callback})
		doc=undefined;
		UI.RefreshAllTabs()
	},
	WriteCellOutput:function(id,s){
		var cell_i=this.m_cells[id];
		var doc=cell_i.m_text_out;
		var ed=doc.ed;
		var ccnt=ed.GetTextSize();
		var sel=doc.GetSelection();
		ed.Edit([ccnt,0,s],1);
		//try to advance the selection
		var is_end=0;
		if(sel[0]==sel[1]&&sel[1]==ccnt){
			var ccnt_end=doc.ed.GetTextSize()
			sel[0]=ccnt_end;
			sel[1]=ccnt_end;
			doc.SetSelection(ccnt_end,ccnt_end)
			is_end=1;
		}
		//if(UI.g_output_parsers){
		var line=doc.GetLC(ccnt)[0]
		var ccnt_lh=doc.SeekLC(line,0)
		var ccnt_tot=doc.ed.GetTextSize()
		cell_i.m_progress=undefined;
		for(;;){
			var ccnt_next=doc.SeekLineBelowKnownPosition(ccnt_lh,line,line+1)
			var need_break=0;
			if(!(ccnt_next<ccnt_tot)){
				if(!(doc.GetLC(ccnt_next)[0]>line)){
					if(ccnt_next-ccnt_lh>=MAX_PARSABLE_LINE){
						break;
					}
					need_break=1;
				}
			}
			var sline=doc.ed.GetText(ccnt_lh,ccnt_next-ccnt_lh);
			var lg=Duktape.__byte_length(sline);
			if(lg<MAX_PARSABLE_LINE){
				//chop line feeds
				var lf_groups=sline.split('\r');
				if(lf_groups.length>1&&!(lf_groups.length==2&&lf_groups[lf_groups.length-1]=='\n')){
					var need_newline=0;
					if(lf_groups[lf_groups.length-1]=='\n'){
						lf_groups.pop();
						need_newline=1;
					}
					while(lf_groups.length>0&&!lf_groups[lf_groups.length-1]){
						lf_groups.pop();
					}
					if(lf_groups.length>0){
						s_new=lf_groups.pop();
					}else{
						s_new='';
					}
					if(need_newline){
						s_new=s_new+'\n';
					}
					if(need_break){
						var match_progress=s_new.match(/([0-9]+(.[0-9]*)?)[%]/);
						if(match_progress){
							cell_i.m_progress=match_progress[1];
						}
					}
					ed.Edit([ccnt_lh,lg,s_new],0);
					ccnt_tot=doc.ed.GetTextSize();
					ccnt_next=ccnt_lh+Duktape.__byte_length(s_new);
					sline=s_new;
				}
				///////////////
				if(need_break){
					break;
				}
				var err=ParseOutput(sline)
				if(err){this.CreateCompilerError(id,err,ccnt_lh,ccnt_next);}
			}
			if(need_break){
				break;
			}
			ccnt_lh=ccnt_next;
			line++;
		}
		//}
		if(is_end){
			var ccnt_end=ed.GetTextSize()
			doc.SetSelection(ccnt_end,ccnt_end)
		}
		UI.Refresh()
	},
	ClearCellOutput:function(id){
		var cell_i=this.m_cells[id];
		var doc=cell_i.m_text_out;
		var ed_out=cell_i.m_text_out.ed;
		if(ed_out.GetTextSize()){
			doc.scroll_x=0;
			doc.scroll_y=0;
			doc.sel0.ccnt=0;
			doc.sel1.ccnt=0;
			ed_out.Edit([0,ed_out.GetTextSize(),undefined]);
			doc.ResetSaveDiff()
		}
		cell_i.m_has_any_error=0;;
		cell_i.m_progress=undefined;
		doc.ClearClickableRanges();
		this.need_save|=65536;
	},
	RunCell:function(id){
		var cell_i=this.m_cells[id];
		var doc=cell_i.m_text_in;
		if(cell_i.m_proc){
			if(doc&&doc.owner){
				var noti_new={
					id:"cancel_notification",icon:'警',
					text:'This cell is already running. Repeat your action to cancel it and re-run.',
				};
				var noti_created=doc.owner.CreateNotification(noti_new);
				if(noti_new!=noti_created){
					//we already have that notification
					doc.owner.DismissNotificationsByRegexp(g_re_cancel_note);
					this.KillCell(id)
					cell_i.m_proc.is_terminated="forced";
					//continue execution!
				}else{
					UI.SetFocus(doc);
					return "focus";
				}
			}else{
				return;
			}
		}
		var ed_out=cell_i.m_text_out.ed;
		this.ClearCellOutput(id)
		var desc=Language.GetDescObjectByName(cell_i.m_language);
		if(!desc.m_buildenv_by_name){return;}
		var obj_buildenv=desc.m_buildenv_by_name[cell_i.m_compiler_name||UI.GetDefaultBuildEnv(cell_i.m_language)];
		if(!obj_buildenv||!obj_buildenv.CreateInterpreterCall){return;}
		//direct execution for _nix, %COMSPEC% for Windows
		//coulddo: manual interpreter setup
		var sext=(desc&&desc.extensions&&desc.extensions[0]||(cell_i.m_language=='Unix Shell Script'?"sh":"bat"));
		var fn_script=IO.GetNewDocumentName("qnb",sext,"temp")
		var s_code=cell_i.m_text_in.ed.GetText();
		IO.CreateFile(fn_script,s_code)
		var args=obj_buildenv.CreateInterpreterCall(fn_script,undefined);
		if(typeof(args)=='string'){
			//qpad js
			try{
				eval(s_code);
			}catch(e){
				this.WriteCellOutput(id,e.stack);
			}
			this.need_save|=65536;
			UI.Refresh()
			return;
		}
		var spath=UI.GetPathFromFilename(this.file_name);
		//var s_prj_mark="build script for '"
		//var p_prj_fn=s_code.indexOf(s_prj_mark);
		//if(p_prj_fn>=0){
		//	var s_file_name=s_code.substr(p_prj_fn+s_prj_mark.length);
		//	var p_other_quote=s_file_name.indexOf("'")
		//	if(p_other_quote>=0){
		//		s_file_name=s_file_name.substr(0,p_other_quote);
		//		if(IO.FileExists(s_file_name)){
		//			spath=UI.GetPathFromFilename(s_file_name)
		//		}
		//	}
		//}
		if(s_code.indexOf('[new window]')>=0){
			//new window
			IO.RunProcess(args,spath,1);
			UI.Refresh();
			return;
		}
		var proc=IO.RunToolRedirected(args,spath,0)
		var idle_wait=100;
		for(var i=0;i<this.m_cells.length;i++){
			this.m_cells[i].m_cell_id=i;
		}
		var proc_desc={proc:proc,fn_script:fn_script};
		if(proc){
			var fpoll=(function(cell_i,proc_desc){
				this.need_save|=65536;
				var s=proc.Read(65536)
				//print('fpoll',s,JSON.stringify(args),proc.IsRunning())
				if(s){
					if(proc_desc.is_terminated!="forced"){
						this.WriteCellOutput(cell_i.m_cell_id,s)
					}
					idle_wait=100;
					UI.NextTick(fpoll)
				}else if(proc.IsRunning()){
					idle_wait=Math.min(idle_wait*2,1000);
					UI.setTimeout(fpoll,idle_wait);
					//UI.Refresh();
				}else{
					if(cell_i.m_proc==proc_desc&&proc_desc.is_terminated!="forced"){
						var code=proc.GetExitCode()
						if(code!=0&&!cell_i.m_has_any_error){
							this.WriteCellOutput(cell_i.m_cell_id,this.file_name+":1:1: fatal error: the script has returned an error "+code+"\n")
						}
						cell_i.m_proc=undefined;
						cell_i.m_progress=undefined;
						cell_i.m_completion_time=JsifyBuffer(IO.WallClockTime());
					}
					IO.DeleteFile(fn_script)
					UI.OnApplicationSwitch()
					UI.Refresh();
					//completion notification
					if(UI.TestOption("completion_notification")&&UI.ShowCompletionNotification){
						UI.ShowCompletionNotification();
					}
				}
			}).bind(this,cell_i,proc_desc)
			UI.NextTick(fpoll)
		}else{
			this.WriteCellOutput(id,this.file_name+":1:1: fatal error: failed to execute the script\n")
			IO.DeleteFile(fn_script)
		}
		this.need_save|=65536;
		cell_i.m_proc=proc_desc;
		cell_i.m_unknown_progress=0;
		cell_i.m_t_unknown_progress=UI.m_frame_tick;
		cell_i.m_current_path=spath;
		this.m_last_focus_cell_id=id*2+1;
		UI.Refresh()
	},
	KillCell:function(id){
		var cell_i=this.m_cells[id];
		if(cell_i.m_proc&&!cell_i.m_proc.is_terminated){
			this.WriteCellOutput(cell_i.m_cell_id,"Stopped...\n")
			cell_i.m_proc.is_terminated=1;
			cell_i.m_proc.proc.Terminate()
			UI.Refresh()
		}
	},
	OnDestroy:function(){
		for(var i=0;i<this.m_cells.length;i++){
			this.ClearCellOutput(i)
			var proc_desc=this.m_cells[i].m_proc;
			if(proc_desc){
				proc_desc.proc.Terminate()
			}
		}
	},
	UpdateLanguage:function(id,name){
		var cell_i=this.m_cells[id];
		cell_i.m_language=name;
		var doc_in=cell_i.m_text_in;
		var s_text=doc_in.ed.GetText();
		var sel0=doc_in.sel0.ccnt;
		var sel1=doc_in.sel1.ccnt;
		var need_save=(doc_in.saved_point!=doc_in.ed.GetUndoQueueLength());
		doc_in.OnDestroy()
		/////////
		doc_in=UI.CreateEmptyCodeEditor(cell_i.m_language);
		doc_in.plugins=this.m_cell_plugins;
		doc_in.wrap_width=0;
		doc_in.m_enable_wrapping=0;
		doc_in.m_current_wrap_width=512;
		doc_in.notebook_owner=this;
		doc_in.disable_x_scroll=1;
		doc_in.Init();
		doc_in.scroll_x=0;doc_in.scroll_y=0;
		if(s_text){doc_in.ed.Edit([0,0,s_text],1);}
		doc_in.saved_point=(need_save?-1:doc_in.ed.GetUndoQueueLength());
		cell_i.m_text_in=doc_in;
		this.need_save|=65536;
		UI.SetFocus(doc_in)
		UI.Refresh()
	},
	InvalidateCellList:function(){
		this.m_cell_list_old_position=(this.cell_list&&this.cell_list.position);
		this.cell_list=undefined;
	},
};
W.NotebookView=function(id,attrs){
	if(UI.enable_timing){
		UI.TimingEvent("entering NotebookView");
	}
	var obj=UI.StdWidget(id,attrs,"notebook_view_v2",W.notebook_prototype);
	UI.Begin(obj)
	UI.RoundRect({
		x:obj.x,y:obj.y,w:obj.w,h:obj.h,
		color:obj.panel_style.cell_list_bgcolor,
	})
	W.PureRegion(id,obj)
	//if(!obj.m_buttons){
	//	obj.m_buttons=buttons;
	//}
	//buttons=obj.m_buttons;
	if(!obj.m_cells){
		obj.Load();
	}
	var buttons=[];
	if(obj.m_cells){
		for(var i=0;i<obj.m_cells.length;i++){
			var cell_i=obj.m_cells[i];
			var s_btn_name=(cell_i.m_button_name||"\u2022 untitled")
			var progress=undefined;
			var progress_mode=undefined;
			if(cell_i.m_proc){
				progress=(cell_i&&(parseFloat(cell_i.m_progress)/100));
				progress_mode='normal';
				if((cell_i&&cell_i.m_progress)==undefined){
					progress=cell_i.m_unknown_progress;
					var dt=Duktape.__ui_seconds_between_ticks(cell_i.m_t_unknown_progress,UI.m_frame_tick);
					cell_i.m_t_unknown_progress=UI.m_frame_tick;
					progress_mode='unknown';
					cell_i.m_unknown_progress+=dt/obj.panel_style.unknown_progress_period;
					if(cell_i.m_unknown_progress>1+obj.panel_style.unknown_progress_bar_length){
						cell_i.m_unknown_progress=obj.panel_style.unknown_progress_bar_length;
					}
					UI.AutoRefresh();
				}
			}
			var doc_in=(cell_i&&cell_i.m_text_in);
			if(!obj.is_default&&doc_in){
				if((doc_in.saved_point||0)!=doc_in.ed.GetUndoQueueLength()){
					s_btn_name=s_btn_name+'*';
				}
			}
			buttons.push({id:cell_i.m_temp_unique_name,m_cell_id:i,text:s_btn_name,h:obj.panel_style.h_button,progress:progress,progress_mode:progress_mode});
		}
	}
	var w_buttons=96;
	for(var i=0;i<buttons.length;i++){
		var w_button_i=32+UI.MeasureText(UI.default_styles.button.font,buttons[i].text).w;
		w_buttons=Math.max(w_buttons,w_button_i);
	}
	w_buttons=Math.min(w_buttons,obj.w*obj.panel_style.max_button_width_ratio);
	for(var i=0;i<buttons.length;i++){
		buttons[i].w=w_buttons-16;
	}
	UI.PushSubWindow(obj.x+w_buttons,obj.y,obj.w-w_buttons,obj.h,obj.panel_style.scale)
	var bk_dims=[obj.x,obj.y,obj.w,obj.h];
	obj.x=0;obj.y=0;obj.w=(obj.w-w_buttons)/obj.panel_style.scale;obj.h/=obj.panel_style.scale;
	var n0_topmost=UI.RecordTopMostContext()
	if(obj.m_last_focus_cell_id==undefined){
		obj.m_last_focus_cell_id=0;
	}
	//update need_save... a bit messy here
	obj.need_save&=~1;
	for(var i=0;i<obj.m_cells.length;i++){
		var cell_i=obj.m_cells[i];
		var doc_in=(cell_i&&cell_i.m_text_in);
		if(doc_in){
			if((doc_in.saved_point||0)!=doc_in.ed.GetUndoQueueLength()){
				obj.need_save|=1;
				break;
			}
		}
	}
	//note: the *docs* have to exist even when they're not focused - they may have unsaved changes
	var focus_cell_id=obj.m_last_focus_cell_id;
	var cur_cell=obj.m_cells[focus_cell_id>>1];
	for(var i=0;i<obj.m_cells.length;i++){
		obj.m_cells[i].m_cell_id=i;
	}
	if(cur_cell){
		if(UI.nd_focus==cur_cell.m_text_in){
			focus_cell_id&=-2;
			obj.m_last_focus_cell_id=focus_cell_id;
		}
		if(UI.nd_focus==cur_cell.m_text_out){
			focus_cell_id=(focus_cell_id&-2)+1;
			obj.m_last_focus_cell_id=focus_cell_id;
		}
		//////
		var h_in=0,h_out=0;
		if(cur_cell.m_text_in){
			cur_cell.m_text_in.sub_cell_id=(focus_cell_id&-2)+0;
			cur_cell.m_text_in.m_cell_id=(focus_cell_id>>1);
			h_in=MeasureEditorSize(cur_cell.m_text_in,obj.w);
		}
		if(cur_cell.m_text_out){
			cur_cell.m_text_out.sub_cell_id=(focus_cell_id&-2)+1;
			cur_cell.m_text_out.m_cell_id=(focus_cell_id>>1);
			h_out=MeasureEditorSize(cur_cell.m_text_out,obj.w);
		}
		var doc=((focus_cell_id&1)?cur_cell.m_text_out:cur_cell.m_text_in);
		var has_both=(cur_cell.m_text_in&&cur_cell.m_text_out&&(cur_cell.m_text_out.ed.GetTextSize()>0||(focus_cell_id&1)))
		if(has_both){
			//allocate a larger budget on the focused side
			var h_in_budget=0,h_out_budget=0;
			var h_available=obj.h;
			var in_budget_ratio=cur_cell.m_in_budget_ratio;
			if(in_budget_ratio==undefined){
				in_budget_ratio=0.5;
			}
			in_budget_ratio=Math.min(Math.max(0.125,in_budget_ratio),0.875);
			//var met_budget_flags=0;
			h_in_budget=h_available*in_budget_ratio;
			h_out_budget=h_available-h_in_budget;
			if(h_out<h_out_budget){
				h_out_budget=h_out;
				h_in_budget=h_available-h_out_budget;
			}else{
				//met_budget_flags|=1;
			}
			if(h_in<h_in_budget){
				h_in_budget=h_in;
				h_out_budget=h_available-h_in_budget;
			}else{
				//met_budget_flags|=2;
			}
			var obj_widget_in=W.CodeEditor("cell_"+(focus_cell_id&-2).toString(),{
				disable_minimap:1,
				doc:cur_cell.m_text_in,
				read_only:cur_cell.m_text_in.read_only,
				x:obj.x,y:obj.y,w:obj.w,h:h_in_budget,
			});
			var obj_widget_out=W.CodeEditor("cell_"+((focus_cell_id&-2)+1).toString(),{
				disable_minimap:1,
				doc:cur_cell.m_text_out,
				read_only:cur_cell.m_text_out.read_only,
				x:obj.x,y:obj.y+h_in_budget,w:obj.w,h:h_out_budget,
			});
			//var w_line_numbers=Math.min(obj_widget_in.doc.m_rendering_w_line_numbers,obj_widget_out.doc.m_rendering_w_line_numbers);
			//w_line_numbers=(w_line_numbers||0);
			////shadow the other end
			//if(focus_cell_id&1){
			//	UI.PushCliprect(obj.x+w_line_numbers,obj.y+h_in_budget-obj.panel_style.shadow_size,obj.w-w_line_numbers,obj.panel_style.shadow_size);
			//}else{
			//	UI.PushCliprect(obj.x+w_line_numbers,obj.y+h_in_budget,obj.w-w_line_numbers,obj.panel_style.shadow_size);
			//}
			//UI.RoundRect({
			//	x:obj.x+w_line_numbers-obj.panel_style.shadow_size,y:obj.y+h_in_budget-obj.panel_style.shadow_size,
			//	w:obj.w-w_line_numbers+obj.panel_style.shadow_size*2,h:obj.panel_style.shadow_size*2,
			//	round:obj.panel_style.shadow_size,border_width:-obj.panel_style.shadow_size,
			//	color:obj.panel_style.shadow_color
			//})
			//UI.PopCliprect();
			//draggable for in_budget_ratio
			W.Region("budget_adjuster_"+(focus_cell_id&-2).toString(),{
				x:obj.x,y:obj.y+h_in_budget-obj.panel_style.separator_bar_region_size*0.5,w:obj.w,h:obj.panel_style.separator_bar_region_size,
				cell:cur_cell,
				obj_h:obj.h,
				mouse_cursor:'sizens',
				OnMouseDown:function(event){
					this.m_drag_ctx={
						dy:h_in_budget-event.y,
						h:this.obj_h,
					};
					UI.CaptureMouse(this);
				},
				OnMouseMove:function(event){
					var ctx=this.m_drag_ctx;
					if(!ctx){return;}
					this.cell.m_in_budget_ratio=Math.min(Math.max(0.125,(ctx.dy+event.y)/ctx.h),0.875);
					obj.need_save|=65536;
					UI.Refresh();
				},
				OnMouseUp:function(event){
					this.OnMouseMove(event);
					UI.ReleaseMouse(this);
					this.m_drag_ctx=undefined;
				},
			})
		}else if(doc){
			var h_doc=Math.min(MeasureEditorSize(doc,obj.w),obj.h);
			W.CodeEditor("cell_"+focus_cell_id.toString(),{
				disable_minimap:1,
				doc:doc,
				read_only:doc.read_only,
				x:obj.x,y:obj.y,w:obj.w,h:obj.h,
			});
			//UI.PushCliprect(obj.x,obj.y+h_doc,obj.w,obj.panel_style.shadow_size);
			//UI.RoundRect({
			//	x:obj.x-obj.panel_style.shadow_size,y:obj.y+h_doc-obj.panel_style.shadow_size,
			//	w:obj.w+obj.panel_style.shadow_size*2,h:obj.panel_style.shadow_size*2,
			//	round:obj.panel_style.shadow_size,border_width:-obj.panel_style.shadow_size,
			//	color:obj.panel_style.shadow_color
			//})
			//UI.PopCliprect();
		}
		//dismiss the run-twice notification
		if(!cur_cell.m_proc){
			var obj_widget=obj["cell_"+(focus_cell_id&-2).toString()];
			if(obj_widget){
				obj_widget.DismissNotificationsByRegexp(g_re_cancel_note);
			}
		}
	}
	//coulddo: tool bar
	var menu_notebook=undefined;
	menu_notebook=UI.BigMenu("Note&book");
	menu_notebook.AddNormalItem({
		text:"&New cell",
		icon:'新',enable_hotkey:1,key:"CTRL+M",action:obj.NewCell.bind(obj)})
	if(cur_cell&&!obj.m_cells[focus_cell_id>>1].m_proc&&!(focus_cell_id&1)){
		menu_notebook.AddNormalItem({
			text:"&Run cell",
			enable_hotkey:1,key:"CTRL+RETURN",action:(function(){
				this.RunCell(focus_cell_id>>1)
			}).bind(obj)})
	}
	if(cur_cell){
		obj.m_last_focus_cell_id=focus_cell_id;
		menu_notebook.AddNormalItem({
			text:"&Delete cell",
			enable_hotkey:1,key:"SHIFT+CTRL+X",
			action:obj.DeleteCell.bind(obj,focus_cell_id>>1)})
		menu_notebook.AddNormalItem({
			text:"&Clone cell",
			action:obj.DupCell.bind(obj)});
		if(cur_cell.m_text_out&&cur_cell.m_text_out.ed.GetTextSize()){
			menu_notebook.AddNormalItem({
				text:"Clear &output",
				enable_hotkey:1,key:"SHIFT+CTRL+C",
				action:obj.ClearCellOutput.bind(obj,focus_cell_id>>1)})
		}
	}
	menu_notebook=undefined;
	UI.FlushTopMostContext(n0_topmost)
	UI.PopSubWindow()
	obj.x=bk_dims[0];obj.y=bk_dims[1];obj.w=bk_dims[2];obj.h=bk_dims[3];
	//buttons
	var shadow_size=obj.panel_style.button_area_shadow_size;
	UI.PushCliprect(obj.x,obj.y,w_buttons,obj.h);
	UI.RoundRect({
		x:obj.x+w_buttons-shadow_size,y:obj.y-shadow_size,w:shadow_size*2,h:obj.h+shadow_size*2,
		color:obj.panel_style.button_area_shadow_color,border_width:-shadow_size,round:shadow_size,
	})
	UI.PopCliprect();
	buttons.push({id:"$add",no_click_selection:1,special:'add',h:obj.panel_style.h_button});
	var had_cell_list=!!obj.cell_list;
	var cell_list_attrs={
		x:obj.x,y:obj.y,w:w_buttons,h:obj.h,
		dimension:'y',no_listview_region:0,no_region:1,//no_clipping:1,
		has_scroll_bar:0,
		mouse_wheel_speed:80,
		value:obj.m_last_focus_cell_id>>1,
		OnChange:function(value){
			value=Math.min(value,obj.m_cells.length-1);
			W.ListView_prototype.OnChange.call(this,value);
			obj.m_last_focus_cell_id=value*2;
			UI.Refresh();
		},
		item_template:{
			object_type:W.CellCaption,
			owner:obj,
		},items:buttons};
	if(!had_cell_list){
		cell_list_attrs.position=obj.m_cell_list_old_position;
	}
	W.ListView('cell_list',cell_list_attrs);
	obj.m_cell_list_old_position=undefined;
	if(obj.m_sel_rendering_y!=undefined||!had_cell_list){
		var pos0=obj.cell_list.position;
		obj.cell_list.AutoScroll();
		if(pos0!=obj.cell_list.position){
			if(!had_cell_list){
				UI.InvalidateCurrentFrame();
			}
			UI.Refresh();
		}
	}
	if(!had_cell_list){
		if(obj.m_set_focus_cell_list){
			UI.SetFocus(obj.cell_list);
			obj.m_set_focus_cell_list=0;
			UI.InvalidateCurrentFrame();
			UI.Refresh();
		}
	}
	UI.End()
	if(UI.enable_timing){
		UI.TimingEvent("leaving NotebookView");
	}
	//CellCaption
	return obj
}

UI.BringUpNotebookTab=function(file_name,mode){
	//var file_name=fname0||IO.GetNewDocumentName("new","txt","document")
	file_name=IO.NormalizeFileName(file_name);
	for(var i=0;i<UI.g_all_document_windows.length;i++){
		var obj_tab_i=UI.g_all_document_windows[i];
		if(obj_tab_i.file_name==file_name&&obj_tab_i.document_type=="notebook"){
			if(mode=="focus"){
				UI.top.app.document_area.SetTab(i)
			}else if(mode=="bringup"){
				UI.top.app.document_area.BringUpTab(i)
			}else{
				//nothing
			}
			return obj_tab_i;
		}
	}
	return null;
};
UI.OpenNoteBookTab=function(file_name,is_quiet){
	var layout=UI.m_ui_metadata["<layout>"];
	layout.m_is_maximized=0;
	file_name=IO.NormalizeFileName(file_name);
	var obj_ret=UI.BringUpNotebookTab(file_name,is_quiet?"none":"focus");
	if(obj_ret){return obj_ret;}
	var spath=UI.GetPathFromFilename(file_name);
	var is_default=(spath==IO.NormalizeFileName(IO.GetStoragePath()));
	UI.top.app.quit_on_zero_tab=0;
	var bk_current_tab_id=undefined;
	if(is_quiet){
		bk_current_tab_id=UI.top.app.document_area.current_tab_id;
	}
	var ret=UI.NewTab({
		file_name:file_name,
		is_default:is_default,
		title:is_default?UI._("Default Notebook"):UI.Format("@1 - Notebook",UI.GetMainFileName(UI.GetPathFromFilename(file_name)),"Notebook"),
		tooltip:file_name,
		document_type:"notebook",
		area_name:"v_tools",
		NeedRendering:function(){
			if(!this.main_widget){return 1;}
			if(this==UI.top.app.document_area.active_tab){return 1;}
			var body=this.main_widget;
			for(var i=0;i<body.m_cells.length;i++){
				if(body.m_cells[i].m_proc){
					return 1;
				}
				var obj0=body["doc_in_"+i.toString()];
				var obj1=body["doc_out_"+i.toString()];
				if(obj0&&!obj0.m_is_rendering_good){return 1;}
				if(obj1&&!obj1.m_is_rendering_good){return 1;}
			}
			return 0;
		},
		UpdateTitle:function(){
			if(this.main_widget){
				var body=this.main_widget;
				var s_name=this.is_default?UI._("Default Notebook"):UI.GetMainFileName(UI.GetPathFromFilename(this.file_name));
				var is_running=0;
				var s_progress=undefined;
				for(var i=0;i<body.m_cells.length;i++){
					if(body.m_cells[i].m_proc){
						is_running=1;
						if(s_progress==undefined){
							s_progress=body.m_cells[i].m_progress;
						}
					}
				}
				if(is_running){
					if(UI.top.app.progress==undefined&&s_progress!=undefined){
						UI.top.app.progress=parseFloat(s_progress)/100;
					}
					if(s_progress!=undefined){
						this.title=UI.Format("@1 (@2%)",s_name,s_progress)+((this.need_save&3)?'*':'');
					}else{
						this.title=UI.Format("@1 (running)",s_name)+((this.need_save&3)?'*':'');
					}
				}else{
					this.title=(this.is_default?UI._("Default Notebook"):UI.Format("@1 - Notebook",s_name))+((this.need_save&3)?'*':'');
				}
				this.tooltip=this.file_name;
			}
		},
		body:function(){
			//use styling for editor themes
			UI.context_parent.body=this.main_widget;
			if(this.main_widget){this.file_name=this.main_widget.file_name}
			var attrs={
				'anchor':'parent','anchor_align':"fill",'anchor_valign':"fill",
				'x':0,'y':0,
				'file_name':this.file_name,
				'is_default':this.is_default,
				'activated':this==UI.top.app.document_area.active_tab,
			};
			var body=W.NotebookView("body",attrs)
			if(!this.main_widget){
				this.main_widget=body;
			}
			this.need_save=this.main_widget.need_save;
			if(this.is_default&&this.need_save){
				this.need_save=65536;
			}
			this.UpdateTitle();
			//var s_name=UI.GetMainFileName(UI.GetPathFromFilename(this.file_name));
			//var is_running=0;
			//for(var i=0;i<body.m_cells.length;i++){
			//	if(body.m_cells[i].m_proc){
			//		is_running=1;
			//		break
			//	}
			//}
			//if(is_running){
			//	body.title=UI.Format("@1 (running)",s_name)+(this.need_save?'*':'');
			//}else{
			//	body.title=UI.Format("@1 - Notebook",s_name)+(this.need_save?'*':'');
			//}
			//body.tooltip=this.file_name;
			return body;
		},
		NeedMainWidget:function(){
			if(!this.main_widget){
				this.main_widget=Object.create(W.notebook_prototype);
				this.main_widget.file_name=this.file_name;
			}
			if(!this.main_widget.m_cells){
				this.main_widget.Load();
			}
		},
		Save:function(){
			if(!this.main_widget){return;}
			if(this.main_widget.file_name&&this.main_widget.file_name.indexOf('<')>=0){
				this.SaveAs()
				return
			}
			this.main_widget.Save();
			this.need_save=this.main_widget.need_save;
			if(this.is_default&&this.need_save){
				this.need_save=65536;
			}
		},
		SaveAs:function(){
			if(!this.main_widget){return;}
			var fn=IO.DoFileDialog(1,"json",
				this.main_widget.file_name.indexOf('<')>=0?
					UI.m_new_document_search_path:
					UI.GetPathFromFilename(this.main_widget.file_name));
			if(!fn){return;}
			this.file_name=fn
			this.main_widget.file_name=fn
			this.Save()
		},
		SaveMetaData:function(){
			if(this.main_widget){this.main_widget.SaveMetaData();}
		},
		OnDestroy:function(){
			if(this.main_widget){this.main_widget.OnDestroy();}
		},
		Reload:function(){
			if(this.main_widget){this.main_widget.Reload();}
		},
		OnTabClose:function(){
			if(this.main_widget){
				var body=this.main_widget;
				var is_running=0;
				for(var i=0;i<body.m_cells.length;i++){
					if(body.m_cells[i].m_proc){
						is_running=1;
						break;
					}
				}
				if(is_running){
					this.in_save_dialog=1;
					this.save_dialog_desc={
						text:UI._("It's still running..."),
						buttons:[{
							text:UI._("Stop it"),is_good:1,
							hotkeys:["K","Y","RETURN","SPACE"],
							std_action:"close",
							OnClick:function(){
								for(var j=0;j<body.m_cells.length;j++){
									body.KillCell(j);
								}
							},
						},{
							text:UI._("Cancel"),
							hotkeys:["N","C","ESC"],
							std_action:"cancel",
						}]};
					return 0;
				}
			}
			return 1;
		},
	})
	if(is_quiet){
		UI.top.app.document_area.current_tab_id=bk_current_tab_id;
	}
	return ret;
};
