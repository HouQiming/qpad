var UI=require("gui2d/ui");
var W=require("gui2d/widgets");
var Language=require("res/lib/langdef");
require("res/lib/global_doc");
require("res/lib/code_editor");

var fsearchImage=function(fn){
	//todo
	return fn;
}

W.HelpPage=function(id,attrs){
	var obj=UI.StdWidget(id,attrs,"help_page");
	UI.Begin(obj)
	UI.RoundRect(obj)
	//todo: open a fixed file first
	if(!obj.text){
		obj.text=IO.ReadAll("c:/tp/pure/mo/doc/test.md")
	}
	var w_main_area=obj.w-obj.padding*2-obj.w_scroll_bar;
	var h_main_area=obj.h
	if(!obj.help_ctx||obj.help_ctx.w_precomputed_for!=w_main_area){
		obj.help_ctx=UI.ED_ProcessHelp(obj.text,obj.styles,fsearchImage,w_main_area);
		obj.help_ctx.prt=UI.ED_FormatRichText(
			Language.GetHyphenator(UI.m_ui_language),
			obj.help_ctx.m_text,4,w_main_area,obj.styles,obj.help_ctx.m_objs);
		obj.help_ctx.w_precomputed_for=w_main_area
	}
	var ytot=obj.help_ctx.prt.m_h_text+obj.padding*2;
	var scroll_y=(obj.scroll_y||0);obj.scroll_y=scroll_y;
	var anim=W.AnimationNode("scrolling_animation",{
		transition_dt:obj.scroll_transition_dt,
		scroll_y:scroll_y})
	if(h_main_area<ytot){
		var sbar_value=Math.max(Math.min(scroll_y/(ytot-h_main_area),1),0);
		W.ScrollBar("sbar",{
			x:obj.x+obj.w-obj.w_scroll_bar, y:obj.y, w:obj.w_scroll_bar, h:obj.h, dimension:'y',
			page_size:h_main_area, total_size:ytot, value:sbar_value,
			OnChange:function(value){
				obj.scrolling_animation=undefined;
				obj.scroll_y=value*(this.total_size-this.page_size)
				UI.Refresh()
			},
		})
	}
	UI.PushCliprect(obj.x+obj.padding,obj.y,w_main_area+obj.padding,obj.h)
	UI.ED_RenderRichText(obj.help_ctx.prt,obj.help_ctx.m_text,obj.x+obj.padding,obj.y-obj.scroll_y,obj.help_ctx.m_objs)
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
	//todo: dropshadow?
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
