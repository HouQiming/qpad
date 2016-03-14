var UI=require("gui2d/ui");
var W=require("gui2d/widgets");
var Language=require("res/lib/langdef");
require("res/lib/global_doc");
require("res/lib/code_editor");

W.HelpPage_prototype={
	InvalidateContent:function(){
		this.m_file_name=undefined
		this.text=undefined;
		this.help_ctx=undefined;
		this.found_items=undefined;
		UI.Refresh();
	},
	OpenFile:function(fn){
		this.m_file_name=fn;
		this.text=IO.ReadAll(fn)
		UI.Refresh();
	},
	SetSelection:function(id){
		this.cur_op=id;
		var op_active=this.help_ctx.m_ops[id];
		this.scroll_y=Math.min(Math.max(this.scroll_y,op_active.y1-this.h_main_area),op_active.y0);
		this.ValidateScroll()
		UI.Refresh();
	},
	RunOp:function(id){
		var op_active=this.help_ctx.m_ops[id];
		if(op_active.action=="run"){
			var doc=op_active.obj_code.doc;
			if(!doc){return;}
			if(op_active.machine=="<editor>"){
				var s_code=doc.ed.GetText();
				try{
					eval("(function(){"+s_code+"})()");
				}catch(e){
					//todo: some form of failure notification
					print(e.stack)
				}
				return;
			}
			var lname=Language.GetNameByExt(op_active.obj_code.m_language.toLowerCase());
			var ldesc=Language.GetDescObjectByName(lname);
			if(!ldesc.m_buildenv_by_name){return;}
			var obj_buildenv=ldesc.m_buildenv_by_name[UI.GetDefaultBuildEnv(lname)];
			if(!obj_buildenv||!obj_buildenv.CreateInterpreterCall){return;}
			var sext=(ldesc&&ldesc.extensions&&ldesc.extensions[0]||op_active.obj_code.m_language);
			//todo: op_active.machine
			var fn_script=IO.GetNewDocumentName("qnb",sext,"temp")
			var s_code=doc.ed.GetText();
			IO.CreateFile(fn_script,s_code)
			var args=obj_buildenv.CreateInterpreterCall(fn_script,undefined);
			if(typeof(args)=='string'){return;}
			var spath=UI.GetPathFromFilename(this.m_file_name);
			if(!IO.RunProcess(args,spath,1)){
				//todo: some form of failure notification
				IO.DeleteFile(fn_script);
			}
		}else if(op_active.action=="code"){
			var doc=op_active.obj_code.doc;
			if(!doc){return;}
			//copy-paste, it's useful to leave the stuff in clipboard
			doc.SetSelection(0,doc.ed.GetTextSize())
			doc.Copy()
			if(this.editor_widget){
				this.editor_widget.doc.SmartPaste()
			}
		}else if(op_active.action=="check"){
			//do nothing, it's a manual step
		}
	},
	ValidateScroll:function(){
		var ytot=this.help_ctx.prt.m_h_text+this.padding;
		var h_main_area=this.h_main_area;
		this.scroll_y=Math.max(Math.min(this.scroll_y,ytot-h_main_area),0);
	},
	OnMouseWheel:function(event){
		if(!this.help_ctx){return;}
		var hc=UI.GetCharacterHeight(this.styles[0].font);
		var scroll_y0=this.scroll_y;
		var h_scrolling_area=this.h_main_area;
		this.scroll_y+=-hc*this.mouse_wheel_speed*event.y;
		this.ValidateScroll();
		if(this.scroll_y!=scroll_y0){
			UI.Refresh();
		}
	},
};

var fhelppage_findbar_plugin=function(){
	this.AddEventHandler('ESC',function(){
		var obj=this.owner
		var tab_frontmost=UI.GetFrontMostEditorTab();
		if(tab_frontmost){
			UI.top.app.document_area.SetTab(tab_frontmost.__global_tab_id)
		}
		UI.Refresh()
	})
	this.OnMouseWheel=function(event){
		var obj=this.owner
		obj.OnMouseWheel(event)
	}
	this.AddEventHandler('change',function(){
		//close the current file
		var obj=this.owner
		obj.InvalidateContent()
		UI.Refresh()
	})
	var fpassthrough=function(key,event){
		var obj=this.owner
		if(obj.help_list){
			obj.help_list.OnKeyDown(event)
		}
	}
	this.AddEventHandler('RETURN RETURN2',fpassthrough)
	this.AddEventHandler('UP',fpassthrough)
	this.AddEventHandler('DOWN',fpassthrough)
	this.AddEventHandler('PGUP',fpassthrough)
	this.AddEventHandler('PGDN',fpassthrough)
}

W.HelpPage=function(id,attrs){
	var obj=UI.StdWidget(id,attrs,"help_page",W.HelpPage_prototype);
	UI.Begin(obj)
	UI.RoundRect(obj)
	W.PureRegion(id,obj)
	//top bar for searching - repo.m_helps
	//coulddo: show current project
	var w_buttons=0;
	var rect_bar=UI.RoundRect({
		x:obj.x+obj.find_bar_padding,y:obj.y+obj.find_bar_padding,
		w:obj.w-w_buttons-obj.find_bar_padding*2,h:obj.h_find_bar-obj.find_bar_padding*2,
		color:obj.find_bar_color,
		round:obj.find_bar_round})
	UI.DrawChar(UI.icon_font_20,obj.x+obj.find_bar_padding*2,obj.y+(obj.h_find_bar-UI.GetCharacterHeight(UI.icon_font_20))*0.5,
		obj.find_bar_hint_color,'s'.charCodeAt(0))
	var x_find_edit=obj.x+obj.find_bar_padding*3+UI.GetCharacterAdvance(UI.icon_font_20,'s'.charCodeAt(0));
	var w_find_edit=rect_bar.x+rect_bar.w-obj.find_bar_padding-x_find_edit;
	W.Edit("find_bar_edit",{
		style:obj.find_bar_editor_style,
		x:x_find_edit,w:w_find_edit,y:rect_bar.y,h:rect_bar.h,
		owner:obj,
		precise_ctrl_lr_stop:UI.TestOption("precise_ctrl_lr_stop"),
		same_line_only_left_right:!UI.TestOption("left_right_line_wrap"),
		plugins:[fhelppage_findbar_plugin],
		default_focus:2,
		tab_width:UI.GetOption("tab_width",4),
	});
	if(!obj.find_bar_edit.ed.GetTextSize()&&!obj.find_bar_edit.ed.m_IME_overlay){
		W.Text("",{x:x_find_edit+2,w:w_find_edit,y:rect_bar.y,h:rect_bar.h,
			font:obj.find_bar_hint_font,color:obj.find_bar_hint_color,
			text:UI._("Search")})
	}
	var spath_repo="<none>";
	if(obj.editor_widget){
		spath_repo=UI.GetEditorProject(obj.editor_widget.file_name);
	}
	if(spath_repo!=obj.current_repo){
		//repo changed, invalidate all
		obj.InvalidateContent()
		obj.current_repo=spath_repo;
	}
	if(!obj.text){
		if(!obj.found_items){
			var repo=UI.GetRepoByPath(spath_repo);
			var items=[];
			obj.found_items=items;
			if(repo&&repo.m_helps){
				var s_searches=obj.find_bar_edit.ed.GetText().toLowerCase().split(' ');
				for(var i=0;i<repo.m_helps.length;i++){
					var help_item_i=repo.m_helps[i];
					var s_i=help_item_i.title_search;
					var is_bad=0;
					var hl_ranges=[];
					for(var j=0;j<s_searches.length;j++){
						var p=s_i.indexOf(s_searches[j]);
						if(p<0){
							is_bad=1;
							break
						}
						hl_ranges.push(p,p+s_searches[j].length);
					}
					if(!is_bad){
						items.push({title:help_item_i.title,file_name:help_item_i.file_name,hl_ranges:hl_ranges})
					}
				}
			}
		}
		//just show a list of candidates, with keyboard browsing -- listview
		UI.PushCliprect(obj.x,obj.y+obj.h_find_bar,obj.w,obj.h-obj.h_find_bar)
		W.ListView('help_list',{
			x:obj.x,y:obj.y+obj.h_find_bar,w:obj.w,h:obj.h-obj.h_find_bar,
			dimension:'y',layout_spacing:8,layout_align:'fill',
			no_clipping:1,
			items:obj.found_items,
			item_template:{
				object_type:W.HelpItem,
				owner:obj,
			}})
		UI.RoundRect({
			x:obj.x-obj.top_hint_shadow_size, y:obj.y+obj.h_find_bar-obj.top_hint_shadow_size, 
			w:obj.w+2*obj.top_hint_shadow_size, h:obj.top_hint_shadow_size*2,
			round:obj.top_hint_shadow_size,
			border_width:-obj.top_hint_shadow_size,
			color:obj.top_hint_shadow_color})
		UI.PopCliprect()
	}
	if(obj.text||!obj.found_items.length){
		if(!obj.found_items.length&&!obj.text){
			obj.text=IO.UIReadAll("res/misc/metahelp.md");
		}
		var w_main_area=obj.w-obj.padding*2-obj.w_scroll_bar;
		var h_main_area=obj.h-obj.h_find_bar
		obj.h_main_area=h_main_area;
		if(!obj.help_ctx||obj.help_ctx.w_precomputed_for!=w_main_area){
			var fsearchImage=function(fn){
				//todo
				return fn;
			}
			obj.help_ctx=UI.ED_ProcessHelp(obj.text,obj.styles,fsearchImage,w_main_area);
			obj.help_ctx.prt=UI.ED_FormatRichText(
				Language.GetHyphenator(UI.m_ui_language),
				obj.help_ctx.m_text,4,w_main_area,obj.styles,obj.help_ctx.m_objs);
			UI.ED_CreateOpHighlights(obj.help_ctx.m_ops,obj.help_ctx.prt,obj.help_ctx.m_text);
			obj.help_ctx.w_precomputed_for=w_main_area
		}
		var ytot=obj.help_ctx.prt.m_h_text+obj.padding;
		var scroll_y=(obj.scroll_y||0);obj.scroll_y=scroll_y;
		var anim=W.AnimationNode("scrolling_animation",{
			transition_dt:obj.scroll_transition_dt,
			scroll_y:scroll_y})
		//the scroll bar
		if(h_main_area<ytot){
			var sbar_value=Math.max(Math.min(scroll_y/(ytot-h_main_area),1),0);
			W.ScrollBar("sbar",{
				x:obj.x+obj.w-obj.w_scroll_bar, y:obj.y+obj.h_find_bar, w:obj.w_scroll_bar, h:obj.h-obj.h_find_bar, dimension:'y',
				page_size:h_main_area, total_size:ytot, value:sbar_value,
				OnMouseWheel:obj.OnMouseWheel.bind(obj),
				OnChange:function(value){
					obj.scrolling_animation=undefined;
					obj.scroll_y=value*(this.total_size-this.page_size)
					UI.Refresh()
				},
			})
		}
		UI.PushCliprect(obj.x,obj.y+obj.h_find_bar,obj.w,obj.h-obj.h_find_bar)
		//the ops
		var cur_op=(obj.cur_op||0);
		for(var i=0;i<obj.help_ctx.m_ops.length;i++){
			//highlight it
			var op_i=obj.help_ctx.m_ops[i];
			//print(op_i.y0,op_i.y1)
			UI.RoundRect({
				x:obj.x+obj.padding,
				y:obj.y+obj.h_find_bar-obj.scroll_y+op_i.y0,
				w:w_main_area,
				h:op_i.y1-op_i.y0,
				color:i==cur_op?obj.ophl.focus_color:obj.ophl.color,
				round:obj.ophl.blur,
				border_width:-obj.ophl.blur,
			})
			W.Region("rgn_op_"+i.toString(),{
				x:obj.x+obj.padding,
				y:obj.y+obj.h_find_bar-obj.scroll_y+op_i.y0,
				w:w_main_area,
				h:op_i.y1-op_i.y0,
				id:i,
				OnClick:function(event){
					obj.SetSelection(this.id)
					if(event.clicks>=2){
						obj.RunOp(this.id)
					}
				},
			})
		}
		//we don't have to activate the tab...
		if(cur_op<obj.help_ctx.m_ops.length){
			W.Hotkey("",{key:"CTRL+E",action:(function(){
				var cur_op=(this.cur_op||0);
				this.RunOp(cur_op);
				cur_op++;
				if(!(cur_op<this.help_ctx.m_ops.length)){
					cur_op=0;
				}
				this.SetSelection(cur_op);
				UI.Refresh();
			}).bind(obj)})
		}
		//coulddo: pre-format the code to a predefined style - after beautifier
		//the main part
		UI.ED_RenderRichText(obj.help_ctx.prt,obj.help_ctx.m_text,obj.x+obj.padding,obj.y+obj.h_find_bar-obj.scroll_y,obj.help_ctx.m_objs)
		//if(obj.scroll_y>0){
		UI.RoundRect({
			x:obj.x-obj.top_hint_shadow_size, y:obj.y+obj.h_find_bar-obj.top_hint_shadow_size, 
			w:obj.w+2*obj.top_hint_shadow_size, h:obj.top_hint_shadow_size*2,
			round:obj.top_hint_shadow_size,
			border_width:-obj.top_hint_shadow_size,
			color:obj.top_hint_shadow_color})
		//}
		UI.PopCliprect()
	}
	UI.End()
	return obj
};

W.HelpItem_prototype={
	OnDblClick:function(){
		this.owner.OpenFile(this.file_name);
	},
};
W.HelpItem=function(id,attrs){
	var obj=UI.StdWidget(id,attrs,"help_item",W.HelpItem_prototype);
	UI.Begin(obj)
		if(obj.selected){
			var sel_bgcolor=obj.owner.activated?obj.sel_bgcolor:obj.sel_bgcolor_deactivated;
			UI.RoundRect({
				x:obj.x,y:obj.y+2,w:obj.w-12,h:obj.h-4,
				color:sel_bgcolor})
		}
		var name_font=obj.name_font;
		var name_font_bold=obj.name_font_bold;
		W.Text("",{x:obj.x+4,y:obj.y+(obj.h-UI.GetFontHeight(name_font))*0.5-2,
			font:name_font,text:obj.title,
			color:obj.selected?obj.sel_name_color:obj.name_color})
		for(var i=0;i<obj.hl_ranges.length;i+=2){
			var p0=obj.hl_ranges[i+0];
			var p1=obj.hl_ranges[i+1];
			if(p0<p1){
				var x=obj.x+4+UI.MeasureText(name_font,obj.title.substr(0,p0)).w
				W.Text("",{x:x,y:obj.y+(obj.h-UI.GetFontHeight(name_font))*0.5-2,
					font:name_font_bold,text:obj.title.substr(p0,p1-p0),
					color:obj.selected?obj.sel_name_color:obj.name_color})
			}
		}
	UI.End()
	return obj
}

UI.RenderEmbededCodeBox=function(x,y,desc){
	var obj=UI.context_parent;
	if(!desc.doc){
		var doc=UI.CreateEmptyCodeEditor(Language.GetNameByExt(desc.m_language.toLowerCase()));
		var code_style=UI.default_styles.help_page.styles[3];
		//doc.plugins=this.m_cell_plugins;
		doc.wrap_width=0;
		doc.m_enable_wrapping=0;
		doc.m_current_wrap_width=512;
		doc.font=code_style.font;
		doc.font_emboldened=code_style.font_emboldened;
		doc.tex_font=code_style.font;
		doc.tex_font_emboldened=code_style.font_emboldened;
		doc.Init();
		doc.scroll_x=0;doc.scroll_y=0;
		if(desc.m_code){doc.ed.Edit([0,0,desc.m_code],1);}
		doc.saved_point=doc.ed.GetUndoQueueLength();
		desc.doc=doc;
	}
	var obj_widget=W.CodeEditor("embeded_code_"+desc.m_id.toString(),{
		doc:desc.doc,
		disable_minimap:1,
		x:x,y:y,w:desc.m_width,h:desc.m_height,
	})
};

UI.GetCurrentProjectPath=function(){
	var tab_frontmost=UI.GetFrontMostEditorTab();
	var obj=(tab_frontmost&&tab_frontmost.main_widget);
	return obj&&UI.GetEditorProject(obj.file_name);
};

UI.RegisterUtilType("help_page",function(){return UI.NewTab({
	title:"Help",
	area_name:"h_tools",
	body:function(){
		//frontmost doc
		UI.context_parent.body=this.util_widget;
		var tab_frontmost=UI.GetFrontMostEditorTab();
		var body=W.HelpPage('body',{
			'anchor':'parent','anchor_align':'fill','anchor_valign':'fill',
			'editor_widget':tab_frontmost&&tab_frontmost.main_widget,
			'activated':this==UI.top.app.document_area.active_tab,
			'x':0,'y':0});
		this.util_widget=body;
		return body;
	},
	Save:function(){},
	SaveMetaData:function(){},
	OnDestroy:function(){},
})});
