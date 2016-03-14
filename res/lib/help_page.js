var UI=require("gui2d/ui");
var W=require("gui2d/widgets");
var Language=require("res/lib/langdef");
require("res/lib/global_doc");
require("res/lib/code_editor");

W.HelpPage_prototype={
	SetSelection:function(id){
		this.cur_op=id;
		var op_active=this.help_ctx.m_ops[id];
		this.scroll_y=Math.min(Math.max(this.scroll_y,op_active.y1-this.h),op_active.y0);
		this.ValidateScroll()
		UI.Refresh();
	},
	RunOp:function(id){
		var op_active=this.help_ctx.m_ops[id];
		if(op_active.action=="run"){
			var doc=op_active.obj_code.doc;
			if(!doc){return;}
			var lname=Language.GetNameByExt(op_active.obj_code.m_language.toLowerCase());
			var ldesc=Language.GetDescObjectByName(lname);
			if(!ldesc.m_buildenv_by_name){return;}
			var obj_buildenv=ldesc.m_buildenv_by_name[UI.GetDefaultBuildEnv(lname)];
			if(!obj_buildenv||!obj_buildenv.CreateInterpreterCall){return;}
			var sext=(ldesc&&ldesc.extensions&&ldesc.extensions[0]||op_active.obj_code.m_language);
			var fn_script=IO.GetNewDocumentName("qnb",sext,"temp")
			var s_code=doc.ed.GetText();
			IO.CreateFile(fn_script,s_code)
			var args=obj_buildenv.CreateInterpreterCall(fn_script,undefined);
			if(typeof(args)=='string'){return;}
			var spath=UI.GetPathFromFilename(this.m_file_name);
			if(!IO.RunProcess(args,spath,1)){
				IO.DeleteFile(fn_script);
				print("error running the file",args,spath)//todo
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
		var h_main_area=this.h;
		this.scroll_y=Math.max(Math.min(this.scroll_y,ytot-h_main_area),0);
	},
	OnMouseWheel:function(event){
		var hc=UI.GetCharacterHeight(this.styles[0].font);
		var scroll_y0=this.scroll_y;
		var h_scrolling_area=this.h;
		this.scroll_y+=-hc*this.mouse_wheel_speed*event.y;
		this.ValidateScroll();
		if(this.scroll_y!=scroll_y0){
			UI.Refresh();
		}
	},
};
W.HelpPage=function(id,attrs){
	var obj=UI.StdWidget(id,attrs,"help_page",W.HelpPage_prototype);
	UI.Begin(obj)
	UI.RoundRect(obj)
	W.PureRegion(id,obj)
	//todo: open a fixed file first
	if(!obj.text){
		obj.m_file_name="c:/tp/pure/mo/doc/test.md";
		obj.text=IO.ReadAll(obj.m_file_name)
	}
	var w_main_area=obj.w-obj.padding*2-obj.w_scroll_bar;
	var h_main_area=obj.h
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
			x:obj.x+obj.w-obj.w_scroll_bar, y:obj.y, w:obj.w_scroll_bar, h:obj.h, dimension:'y',
			page_size:h_main_area, total_size:ytot, value:sbar_value,
			OnMouseWheel:obj.OnMouseWheel.bind(obj),
			OnChange:function(value){
				obj.scrolling_animation=undefined;
				obj.scroll_y=value*(this.total_size-this.page_size)
				UI.Refresh()
			},
		})
	}
	UI.PushCliprect(obj.x,obj.y,obj.w,obj.h)
	//the ops
	var cur_op=(obj.cur_op||0);
	for(var i=0;i<obj.help_ctx.m_ops.length;i++){
		//highlight it
		var op_i=obj.help_ctx.m_ops[i];
		//print(op_i.y0,op_i.y1)
		UI.RoundRect({
			x:obj.x+obj.padding,
			y:obj.y-obj.scroll_y+op_i.y0,
			w:w_main_area,
			h:op_i.y1-op_i.y0,
			color:i==cur_op?obj.ophl.focus_color:obj.ophl.color,
			round:obj.ophl.blur,
			border_width:-obj.ophl.blur,
		})
		W.Region("rgn_op_"+i.toString(),{
			x:obj.x+obj.padding,
			y:obj.y-obj.scroll_y+op_i.y0,
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
	//todo: tab activation
	//todo: hotkey: ctrl+e?
	//coulddo: pre-format the code to a predefined style - after beautifier
	//the main part
	UI.ED_RenderRichText(obj.help_ctx.prt,obj.help_ctx.m_text,obj.x+obj.padding,obj.y-obj.scroll_y,obj.help_ctx.m_objs)
	if(obj.scroll_y>0){
		UI.RoundRect({
			x:obj.x-obj.top_hint_shadow_size, y:obj.y-obj.top_hint_shadow_size, 
			w:obj.w+2*obj.top_hint_shadow_size, h:obj.top_hint_shadow_size*2,
			round:obj.top_hint_shadow_size,
			border_width:-obj.top_hint_shadow_size,
			color:obj.top_hint_shadow_color})
	}
	UI.PopCliprect()
	UI.End()
	return obj
};

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
