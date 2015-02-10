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
var g_initial_code="\
/* Test comment string */\n\
UI.default_styles.button={\n\
	transition_dt:0.1,\n\
	round:24,border_width:3,padding:12,\n\
	$:{\n\
		out:{\n\
			border_color:0xffcc773f,color:0xffffffff,\n\
			icon_color:0xffcc773f,\n\
			text_color:0xffcc773f,\n\
		},\n\
		over:{\n\
			border_color:0xffcc773f,color:0xffcc773f,\n\
			icon_color:0xffffffff,\n\
			text_color:0xffffffff,\n\
		},\n\
		down:{\n\
			border_color:0xffaa5522,color:0xffaa5522,\n\
			icon_color:0xffffffff,\n\
			text_color:0xffffffff,\n\
		},\n\
	}\n\
};\n\
\n\
UI.Application=function(id,attrs){\n\
	attrs=UI.Keep(id,attrs);\n\
	UI.Begin(attrs);\n\
		var wnd=UI.Begin(W.Window('app',{\n\
						title:'Jacy test code',w:1280,h:720,bgcolor:0xffffffff,\n\
						designated_screen_size:1440,flags:UI.SDL_WINDOW_MAXIMIZED|UI.SDL_WINDOW_RESIZABLE,\n\
						is_main_window:1}));\n\
			/*widget一*/(W.Text('',{\n\
				'w':UI.context_parent.w-32,\n\
				'x':16,'y':16,\n\
				font:UI.Font('msyh',128,-100),text:'标题很细',\n\
				color:0xff000000,\n\
				}));\n\
			/*widget二*/(W.Button('ok',{\n\
				'x':400,'y':400,\n\
				font:UI.Font('ArialUni',48),text:'OK',\n\
				OnClick:function(){UI.DestroyWindow(wnd)}}));\n\
		UI.End();\n\
	UI.End();\n\
};\n\
";
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
	// instrument /*widget几*/
	var re_widget=new RegExp('/\\*widget(.)\\*/\\(',"g")
	var ftranslate_widget=function(smatch,sname){
		return "UI.__report_widget('"+sname+"',";
	};
	s_code=s_code.replace(re_widget,ftranslate_widget);
	try{
		g_sandbox.eval(ed.GetText());
		g_sandbox.eval("UI.Application=function(id,attrs){"+s_code+"};");
	}catch(err){
		ParseCodeError(err)
		code_box.has_errors=1;
	}
	UI.Refresh()
	return 1;
};

var DrawUserFrame=function(){
	var code_box=UI.top.app.code_box;
	var inner_widgets=[];
	if(!code_box.has_errors){
		try{
			g_sandbox.eval("UI.__reported_widgets=[];UI.DrawFrame();");
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
			var s_widget_key="/*widget"+obj.id.substr(1)+"*/(";
			var utf8_offset=s_code.indexOf(s_widget_key)
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
				designated_screen_size:1440,flags:UI.SDL_WINDOW_MAXIMIZED|UI.SDL_WINDOW_RESIZABLE,
				is_main_window:1}));
			if(UI.Platform.ARCH!="mac"&&UI.Platform.ARCH!="ios"){
				W.Hotkey("",{key:["ALT","F4"],action:function(){UI.DestroyWindow(wnd)}});
			}
			var ed_rect=W.RoundRect("",{
				color:0xffffffff,border_color:0xff444444,border_width:2,
				anchor:parent(),anchor_align:"right",anchor_valign:"center",
				x:16,y:0,w:wnd.w*0.3,h:wnd.h-32,
			});
			//var tick0=Duktape.__ui_get_tick();
			var code_box=W.Edit("code_box",{
				font:UI.Font("res/fonts/inconsolata.ttf",32),color:0xff000000,
				tab_width:4,
				text:g_initial_code,//todo
				anchor:ed_rect,anchor_align:"center",anchor_valign:"center",
				///////////////
				state_handlers:["renderer_programmer","colorer_programmer"],
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
				W.Group("controls",{
					layout_direction:'inside',layout_align:'left',layout_valign:'up',x:16,y:16,
					'item_object':W.BoxDocumentItem,'items':code_box.document_items})
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
