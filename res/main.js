var UI=require("gui2d/ui");
var W=require("gui2d/widgets");
require("gui2d/dockbar");
require("res/lib/txtx_editor");

UI.SetFontSharpening(1.5)

//var g_doc=UI.CreateTxtxDocument({w:1200,h:1600});
//var g_layout={
//	direction:'tab',
//	items:[
//		{object_type:W.TxtxView,
//			id:"$test",
//			anchor_align:"fill",anchor_valign:"fill",
//			doc:g_doc,
//			scale:1,
//			///////////////
//			bgcolor:0xffffffff,
//		},
//	],
//};
UI.Application=function(id,attrs){
	attrs=UI.Keep(id,attrs);
	UI.Begin(attrs);
		///////////////////
		UI.Begin(W.Window('app',{
				title:'Mini-Office',w:1280,h:720,bgcolor:0xffbbbbbb,
				designated_screen_size:1080,flags:UI.SDL_WINDOW_MAXIMIZED|UI.SDL_WINDOW_RESIZABLE,
				is_main_window:1}));
			if(UI.Platform.ARCH!="mac"&&UI.Platform.ARCH!="ios"){
				W.Hotkey("",{key:"ALT+F4",action:function(){UI.DestroyWindow(UI.top.app)}});
			}
			//todo: device-dependent button dimensions
			//W.DockingLayout("dockbar",{anchor:UI.context_parent,anchor_align:"fill",anchor_valign:"fill",layout:g_layout})
			W.RoundRect("",{x:4,y:128, w:80+12,h:256+12,border_width:-6,round:20,color:0x80000000});
			W.RoundRect("",{x:4,y:128, w:80,h:256,round:16,color:[{x:0,y:0,color:0xffffffff},{x:1,y:0,color:0xffd0d0d0}]});
		UI.End();
	UI.End();
};

//UI.Run()
///////////////////////////////////////////////////
//todo

var UI=require("gui2d/ui");
var W=require("gui2d/widgets");
require("res/lib/boxdoc");
var Language=require("res/lib/langdef");

function parent(){return UI.context_parent;}

UI.SetFontSharpening(1.5)
var g_sandbox=UI.CreateSandbox();
g_sandbox.ReadBack=function(s){return JSON.parse(g_sandbox._ReadBack("JSON.stringify("+s+")"))}
g_sandbox.eval("var UI=require('gui2d/ui');var W=require('gui2d/widgets');require('res/lib/inmate');")
//todo: new project, adding widgets, widget type vs Application, parameter defaulting
//xywh: relative mode?
g_sandbox.m_relative_scaling=0.5;
var g_initial_code=IO.ReadAll("mo\\test\\uiediting.js");
var g_language_C=Language.Define(function(lang){
	var bid_comment=lang.ColoredDelimiter("key","/*","*/","color_comment");
	var bid_comment2=lang.ColoredDelimiter("key","//","\n","color_comment");
	var bid_string=lang.ColoredDelimiter("key",'"','"',"color_string");
	var bid_string2=lang.ColoredDelimiter("key","'","'","color_string");
	var bid_bracket=lang.DefineDelimiter("nested",['(','[','{'],['}',']',')']);
	lang.DefineToken("\\\\")
	lang.DefineToken("\\'")
	lang.DefineToken('\\"')
	lang.DefineToken('\\\n')
	return (function(lang){
		lang.SetExclusive([bid_comment,bid_comment2,bid_string,bid_string2]);
		if(lang.isInside(bid_comment)||lang.isInside(bid_comment2)||lang.isInside(bid_string)||lang.isInside(bid_string2)){
			lang.Disable(bid_bracket);
		}else{
			lang.Enable(bid_bracket);
		}
	});
});
//todo

var UpdateWorkingCode=function(){
	var code_box=UI.top.app.code_box;
	var ed=code_box.ed;
	var ccnt_sel=code_box.sel1.ccnt;
	var range_0=code_box.FindBracket(0,ccnt_sel,-1);
	var range_1=code_box.FindBracket(0,ccnt_sel,1);
	var working_range=code_box.working_range;
	if(!working_range){
		working_range={};
		code_box.working_range=working_range;
	}
	if(working_range.point0&&range_0==working_range.point0.ccnt&&range_1==working_range.point1.ccnt){
		return;
	}
	if(!(range_0>=18&&ed.GetText(range_0-18,18)=='function(id,attrs)')){
		//if it's not a valid control, leave it alone
		return;
	}
	if(!working_range.point0){
		working_range.point0=ed.CreateLocator(range_0,-1); working_range.point0.undo_tracked=1;
		working_range.point1=ed.CreateLocator(range_1,1); working_range.point1.undo_tracked=1;
	}
	working_range.point0.ccnt=range_0;
	working_range.point1.ccnt=range_1;
	code_box.document_items=[];
	code_box.need_to_rerun=1;
};

var ParseCodeError=function(err){
	//todo
	print(err.stack)
}

//todo: maintain global code (like styling) separately
var RerunUserCode=function(){
	var code_box=UI.top.app.code_box;
	var working_range=code_box.working_range;
	if(!working_range||!working_range.point0){return 0;}
	var range_0=working_range.point0.ccnt;
	var range_1=working_range.point1.ccnt;
	code_box.has_errors=0;
	var ed=code_box.ed;
	var s_code=ed.GetText(range_0,range_1-range_0);
	var re_widget=new RegExp('/\\*widget\\*/\\(',"g")
	var ftranslate_widget=function(smatch,sname){
		return "UI.__report_widget(";
	};
	s_code=s_code.replace(re_widget,ftranslate_widget);
	try{
		g_sandbox.eval(ed.GetText());
		g_sandbox.eval("UI.top={};UI.Application=function(id,attrs){"+s_code+"};");
	}catch(err){
		ParseCodeError(err)
		code_box.has_errors=1;
	}
	UI.Refresh()
	return 1;
};

var nthIndex=function(str,pat,n){
	var L=str.length,i=-1;
	while(n>=0&&i++<L){
		i=str.indexOf(pat,i);
		n--;
	}
	return i>=L?-1:i;
}

var DrawUserFrame=function(){
	var code_box=UI.top.app.code_box;
	var inner_widgets=[];
	if(!code_box.has_errors){
		try{
			g_sandbox.eval("UI.__init_widget_report();UI.DrawFrame();");
			inner_widgets=g_sandbox.ReadBack('UI.__get_widget_report()');
		}catch(err){
			ParseCodeError(err)
			code_box.has_errors=1;
		}
	}
	if(!code_box.has_errors){
		var inner_widget_map={};
		for(var i=0;i<inner_widgets.length;i++){
			var wi=inner_widgets[i];
			wi.id="$"+wi.id;
			wi.x*=g_sandbox.m_relative_scaling;
			wi.y*=g_sandbox.m_relative_scaling;
			wi.w*=g_sandbox.m_relative_scaling;
			wi.h*=g_sandbox.m_relative_scaling;
			inner_widget_map[wi.id]=wi;
		}
		var n2=0;
		var items=code_box.document_items;
		for(var i=0;i<items.length;i++){
			if(!inner_widget_map[items[i].id]){continue;}
			var attrs_old=items[i];
			var attrs_new=inner_widget_map[attrs_old.id];
			for(var s in attrs_new){
				attrs_old[s]=attrs_new[s];
			}
			inner_widget_map[attrs_old.id]=undefined;
			items[n2]=attrs_old;
			n2++;
		}
		items=items.slice(0,n2);
		for(var id in inner_widget_map){
			var attrs=inner_widget_map[id];
			if(attrs){
				items.push(attrs);
			}
		}
		var re_param_replacer=new RegExp("\\'([xywh])\\':([^,]+),","g");
		//set OnChange
		var fonstart=UI.HackCallback(function(obj){
			code_box.undo_needed=0;
		});
		var fonchange=UI.HackCallback(function(obj){
			//we only consider top level groups, so we ignore non-top-level anchoring
			//create a replacement object first
			var obj_replacement={x:obj.x/g_sandbox.m_relative_scaling,y:obj.y/g_sandbox.m_relative_scaling,w:obj.w/g_sandbox.m_relative_scaling,h:obj.h/g_sandbox.m_relative_scaling};
			//todo: snapping support in boxdoc
			//////////
			var ed=code_box.ed;
			if(code_box.undo_needed){ed.Undo();}
			var range_0=code_box.working_range.point0.ccnt;
			var range_1=code_box.working_range.point1.ccnt;
			code_box.has_errors=0;
			var s_code=ed.GetText(range_0,range_1-range_0);
			var s_widget_key="/*widget*/(";
			var utf8_offset=nthIndex(s_code,s_widget_key,parseInt(obj.id.substr(1)))
			if(utf8_offset<0){
				throw new Error("panic: UI->widget desync");
			}
			var byte_offset=ed.ConvertUTF8OffsetToBytesize(range_0,utf8_offset);
			var lg_key=Duktape.__byte_length(s_widget_key);
			//use JS search and convert back to ccnt...
			var byte_offset_widget_end=code_box.FindOuterBracket(byte_offset+lg_key,1);
			//do the replacement
			s_code=ed.GetText(byte_offset,byte_offset_widget_end-byte_offset);
			var freplace_params=UI.HackCallback(function(smatch,s_name){
				if(!obj_replacement[s_name]){return smatch;}
				var s_replacement="'"+s_name+"':"+obj_replacement[s_name].toString()+",";
				return s_replacement;
			});
			s_code=s_code.replace(re_param_replacer,freplace_params);
			ed.Edit([byte_offset,byte_offset_widget_end-byte_offset,s_code]);
			code_box.undo_needed=1;
			code_box.need_to_rerun=1;
		});
		var fonfinish=UI.HackCallback(function(obj){
			code_box.undo_needed=0;
		});
		for(var i=0;i<items.length;i++){
			var item_i=items[i];
			item_i.OnDragStart=fonstart;
			item_i.OnChange=fonchange;
			item_i.OnDragFinish=fonfinish;
			item_i.w_min=1;
			item_i.h_min=1;
			//item_i.old_values={x:item_i.x,y:item_i.y,w:item_i.w,h:item_i.h};
		}
		code_box.document_items=items;
	}
};

UI.Application=function(id,attrs){
	attrs=UI.Keep(id,attrs);
	UI.Begin(attrs);
		///////////////////
		var wnd=UI.Begin(W.Window('app',{
				title:'Jacy IDE',w:1280,h:720,bgcolor:0xffbbbbbb,
				designated_screen_size:1080,flags:UI.SDL_WINDOW_MAXIMIZED|UI.SDL_WINDOW_RESIZABLE,
				is_main_window:1}));
			if(UI.Platform.ARCH!="mac"&&UI.Platform.ARCH!="ios"){
				W.Hotkey("",{key:"ALT+F4",action:function(){UI.DestroyWindow(wnd)}});
			}
			var ed_rect=W.RoundRect("",{
				color:0xffffffff,border_color:0xff444444,border_width:2,
				anchor:parent(),anchor_align:"right",anchor_valign:"center",
				x:16,y:0,w:wnd.w*0.3,h:wnd.h-32,
			});
			//var tick0=Duktape.__ui_get_tick();
			var code_box=W.Edit("code_box",{
				font:UI.Font("res/fonts/inconsolata.ttf",24),color:0xff000000,
				tab_width:4,
				text:g_initial_code,//todo
				anchor:ed_rect,anchor_align:"center",anchor_valign:"center",
				///////////////
				state_handlers:["renderer_programmer","colorer_programmer","line_column_unicode"],
				language:g_language_C,
				color_string:0xff0055aa,
				color_comment:0xff008000,
				///////////////
				OnSelectionChange:function(){
					UpdateWorkingCode();
				},
				OnChange:function(){
					code_box.need_to_rerun=1;
				},
				///////////////
				x:0,y:0,w:ed_rect.w-8,h:ed_rect.h-8,
			});
			//print("code_box:",Duktape.__ui_seconds_between_ticks(tick0,Duktape.__ui_get_tick())*1000,"ms");
			//the sandbox is effectively a GLwidget
			//todo: clipping - use a transformation hack
			UI.GLWidget(function(){
				//var tick0=Duktape.__ui_get_tick();
				g_sandbox.DrawWindow(16,16);
				//print("g_sandbox.DrawWindow",Duktape.__ui_seconds_between_ticks(tick0,Duktape.__ui_get_tick())*1000,"ms");
			})
			//create the boxes
			if(code_box.document_items){
				var items=code_box.document_items;
				var snapping_coords={'x':[],'y':[],'tolerance':4,color:0xff0000ff}
				for(var i=0;i<items.length;i++){
					var item_i=items[i];
					if(wnd.controls&&wnd.controls[item_i.id]&&wnd.controls[item_i.id].is_dragging){
						//avoid self-snapping
						continue;
					}
					snapping_coords.x.push(item_i.x);snapping_coords.x.push(item_i.x+item_i.w);
					snapping_coords.y.push(item_i.y);snapping_coords.y.push(item_i.y+item_i.h);
				}
				var sandbox_main_window_w=g_sandbox.ReadBack('[UI.sandbox_main_window_w]')[0]*g_sandbox.m_relative_scaling
				var sandbox_main_window_h=g_sandbox.ReadBack('[UI.sandbox_main_window_h]')[0]*g_sandbox.m_relative_scaling
				if(wnd.controls&&wnd.controls.snapping_coords){
					snapping_coords.rect_x=wnd.controls.snapping_coords.rect_x;
					snapping_coords.rect_y=wnd.controls.snapping_coords.rect_y;
				}
				if(!(UI.IsPressed("LSHIFT")||UI.IsPressed("RSHIFT"))){
					if(snapping_coords.rect_x){UI.RoundRect(snapping_coords.rect_x);}
					if(snapping_coords.rect_y){UI.RoundRect(snapping_coords.rect_y);}
				}
				W.Group("controls",{
					layout_direction:'inside',layout_align:'left',layout_valign:'up',x:16,y:16,w:sandbox_main_window_w,h:sandbox_main_window_h,
					'snapping_coords':snapping_coords,
					'item_template':{object_type:W.BoxDocumentItem},'items':code_box.document_items})
			}
		UI.End();
		///////////////////
		//this calls BeginPaint which is not reentrant... consider it as a separate window
		//var s_code=ed_box.ed.GetText();
		//g_sandbox.eval("UI.Application=function(id,attrs){"+s_code+"};UI.DrawFrame();");
		//var tick0=Duktape.__ui_get_tick();
		if(code_box.need_to_rerun){
			code_box.need_to_rerun=0;
			RerunUserCode();
		}
		DrawUserFrame();
		//print("DrawUserFrame:",Duktape.__ui_seconds_between_ticks(tick0,Duktape.__ui_get_tick())*1000,"ms");
	UI.End();
};
UI.Run()
