var UI=require("gui2d/ui");
var W=require("gui2d/widgets");
require("gui2d/dockbar");
require("res/lib/txtx_editor");
require("res/lib/code_editor");
require("res/lib/subwin");
require("res/lib/demo_doc");

UI.ChooseScalingFactor({designated_screen_size:1080})
UI.Theme_Minimalistic([0xffcc7733])
UI.SetFontSharpening(1.5)
UI.icon_font=UI.Font('res/fonts/iconfnt.ttf,!',24);
UI.SetRetardedWindingOrder(UI.core_font_cache['res/fonts/iconfnt.ttf'])
UI.font_name="res/fonts/opensans.ttf"

var g_all_document_windows=[];
UI.NewTab=function(tab){
	g_all_document_windows.push(tab)
	UI.Refresh()
	return tab;
}

UI.Application=function(id,attrs){
	attrs=UI.Keep(id,attrs);
	UI.Begin(attrs);
		///////////////////
		var app=UI.Begin(W.Window('app',{
				title:'UI Editor',w:1280,h:720,bgcolor:0xfff0f0f0,
				flags:UI.SDL_WINDOW_MAXIMIZED|UI.SDL_WINDOW_RESIZABLE,
				is_main_window:1}));
			if(UI.Platform.ARCH!="mac"&&UI.Platform.ARCH!="ios"){
				W.Hotkey("",{key:"ALT+F4",action:function(){UI.DestroyWindow(app)}});
			}
			var w_property_bar=320;
			//UI.Platform.ARCH=='android'?(app.w<app.h?'down':'left'):
			var obj_panel=W.AutoHidePanel("property_panel",{
				x:0,y:0,w:w_property_bar,h:w_property_bar,initial_position:w_property_bar,
				anchor_placement:(app.w<app.h?'down':'right'),
				knob_size:UI.IS_MOBILE?40:16,
			});
			var reg_panel=UI.context_regions.pop()
			var panel_placement=obj_panel.anchor_placement
			UI.document_property_sheet={};
			if(panel_placement=='down'){
				W.TabbedDocument("document_area",{
					'anchor':'parent','anchor_align':"fill",'anchor_valign':"up",
					'x':0,'y':0,'h':obj_panel.y,
					items:g_all_document_windows,
				})
			}else{
				W.TabbedDocument("document_area",{
					'anchor':'parent','anchor_align':"left",'anchor_valign':"fill",
					'x':0,'y':0,'w':obj_panel.x,
					items:g_all_document_windows,
				})
			}
			var property_windows=[]
			if(app.document_area.active_tab){
				property_windows=(app.document_area.active_tab.property_windows||property_windows);
			}
			UI.context_regions.push(reg_panel)
			//////////////////////////
			var w_shadow=6
			var w_bar=4;
			var shadow_color=0xaa000000
			if(panel_placement=='down'){
				UI.RoundRect({
					x:-w_shadow,y:obj_panel.y-w_bar-w_shadow,w:app.w+w_shadow*2,h:w_shadow*2,
					color:shadow_color,border_width:-w_shadow,round:w_shadow,
				})
				UI.RoundRect({
					x:0,y:obj_panel.y-w_bar,w:app.w,h:w_property_bar,
					color:0xfff0f0f0,border_width:0,
				})
				W.Group("property_bar",{
					'anchor':obj_panel,'anchor_align':"fill",'anchor_valign':"up",
					'x':0,'y':0,'h':w_property_bar,
					item_template:{'object_type':W.SubWindow},items:property_windows,
					///////////
					'layout_direction':'right','layout_spacing':0,'layout_align':'left','layout_valign':'fill',
					'property_sheet':UI.document_property_sheet,
				});
				W.RoundRect("",{
					'anchor':obj_panel,'anchor_align':"fill",'anchor_valign':"up",
					'x':0,'y':-w_bar,'h':w_bar,
					'color':UI.current_theme_color,
				})
			}else{
				UI.RoundRect({
					x:obj_panel.x-w_bar-w_shadow,y:-w_shadow,w:w_shadow*2,h:app.h+w_shadow*2,
					color:shadow_color,border_width:-w_shadow,round:w_shadow,
				})
				UI.RoundRect({
					x:obj_panel.x-w_bar,y:0,w:w_property_bar,h:app.h,
					color:0xfff0f0f0,border_width:0,
				})
				W.Group("property_bar",{
					'anchor':obj_panel,'anchor_align':"left",'anchor_valign':"fill",
					'x':0,'y':0,'w':w_property_bar,
					item_template:{'object_type':W.SubWindow},items:property_windows,
					///////////
					'layout_direction':'down','layout_spacing':0,'layout_align':'fill','layout_valign':'up',
					'property_sheet':UI.document_property_sheet,
				});
				W.RoundRect("",{
					'anchor':obj_panel,'anchor_align':"left",'anchor_valign':"fill",
					'x':-w_bar,'y':0,'w':w_bar,
					'color':UI.current_theme_color,
				})
			}
			//////////////////////////
			W.Hotkey("",{key:"CTRL+N",action:function(){
				//UI.NewUIEditorTab()
				//UI.NewDemoTab()
				UI.NewFromTemplate("templates/blank_demo.mo")//todo
				UI.Refresh()
			}});
			W.Hotkey("",{key:"CTRL+S",action:function(){
				var doc_area=app.document_area;
				var active_document=doc_area.active_tab_obj;
				if(active_document&&active_document.tab&&active_document.tab.gdoc.Save){
					active_document.tab.gdoc.Save()
				}
			}});
			//todo: drag-loading
			W.Hotkey("",{key:"CTRL+O",action:function(){
				var fn=IO.DoFileDialog(["Text documents (*.text)","*.text","All File","*.*"]);
				if(!fn){return;}
				UI.OpenFile(fn);
				UI.Refresh()
			}});
		UI.End();
	UI.End();
	//todo
	if(!g_all_document_windows.length){
		UI.NewUIEditorTab()
	}
};

UI.Run()
