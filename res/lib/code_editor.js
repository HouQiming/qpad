var UI=require("gui2d/ui");
var W=require("gui2d/widgets");
require("res/lib/boxdoc");
require("res/plugin/edbase");
var Language=require("res/lib/langdef");

function parent(){return UI.context_parent;}

var g_sandbox=UI.CreateSandbox();
g_sandbox.ReadBack=function(s){return JSON.parse(g_sandbox._ReadBack("JSON.stringify("+s+")"))}
g_sandbox.eval("var UI=require('gui2d/ui');var W=require('gui2d/widgets');require('res/lib/inmate');")
//xywh: relative mode?
g_sandbox.m_relative_scaling=1;//0.5;
var g_params={padding:12};
var g_initial_code=IO.ReadAll("mo\\test\\uiediting.js");
var g_language_C=Language.Define(function(lang){
	lang.DefineDefaultColor("color_symbol")
	var bid_comment=lang.ColoredDelimiter("key","/*","*/","color_comment");
	var bid_comment2=lang.ColoredDelimiter("key","//","\n","color_comment");
	var bid_string=lang.ColoredDelimiter("key",'"','"',"color_string");
	var bid_string2=lang.ColoredDelimiter("key","'","'","color_string");
	var bid_preprocessor=lang.ColoredDelimiter("key","#","\n","color_meta");
	var bid_bracket=lang.DefineDelimiter("nested",['(','[','{'],['}',']',')']);
	lang.DefineToken("\\\\")
	lang.DefineToken("\\'")
	lang.DefineToken('\\"')
	lang.DefineToken('\\\n')
	var kwset=lang.DefineKeywordSet("color_symbol");
	kwset.DefineKeywords("color_keyword",['__asm','__declspec','if','else','switch','case','default','break','continue','goto','return','for','while','do','const','static','try','catch','finally','throw','volatile','virtual','friend','public','private','protected','struct','union','class','sizeof','new','delete','import','export','typedef','inline','namespace','private','protected','public','operator','friend','mutable','enum','template','this','extern','__stdcall','__cdecl','__fastcall','__thiscall','true','false','using'])
	kwset.DefineKeywords("color_type",['void','char','short','int','long','auto','unsigned','signed','register','float','double','bool','const_cast','dynamic_cast','reinterpret_cast','typename','wchar_t'])
	kwset.DefineWordColor("color")
	kwset.DefineWordType("color_number","0-9")
	return (function(lang){
		lang.SetExclusive([bid_comment,bid_comment2,bid_string,bid_string2,bid_preprocessor]);
		if(lang.isInside(bid_comment)||lang.isInside(bid_comment2)||lang.isInside(bid_string)||lang.isInside(bid_string2)||lang.isInside(bid_preprocessor)){
			lang.Disable(bid_bracket);
		}else{
			lang.Enable(bid_bracket);
		}
	});
});

////////////////////////////////////////
//the UI editor
var ParseCodeError=function(err){
	//todo
	print(err.stack)
}

var RerunUserCode=function(code_box){
	var working_range=code_box.working_range;
	if(!working_range||!working_range.point0){return 0;}
	var range_0=working_range.point0.ccnt;
	var range_1=working_range.point1.ccnt;
	code_box.has_errors=0;
	var ed=code_box.ed;
	var s_code=ed.GetText(range_0,range_1-range_0);
	if(!s_code){return 0;}
	var re_widget=new RegExp('/\\*widget\\*/\\(',"g")
	var re_editor=new RegExp('/\\*editor: ',"g")
	var ftranslate_widget=function(smatch,sname){
		return "UI.__report_widget(";
	};
	s_code=s_code.replace(re_widget,ftranslate_widget).replace(re_editor,"");
	try{
		g_sandbox.eval(ed.GetText().replace(re_editor,""));
		g_sandbox.eval("UI.top={};UI.Application=function(id,attrs){"+s_code+"};");
	}catch(err){
		ParseCodeError(err)
		code_box.has_errors=1;
	}
	UI.Refresh()
	return 1;
};

//obj_replacement==undefined for getting original
//over-matching is fine
var re_param_replacer=new RegExp("\\'([xywh])\\':([^,]+),","g");
var transform_xywh=function(code_box,ord,obj_replacement){
	var obj_ret={};
	var ed=code_box.ed;
	var range_0=code_box.working_range.point0.ccnt;
	var range_1=code_box.working_range.point1.ccnt;
	code_box.has_errors=0;
	var s_code=ed.GetText(range_0,range_1-range_0);
	var s_widget_key="/*widget*/(";
	var utf8_offset=nthIndex(s_code,s_widget_key,ord)
	if(utf8_offset<0){
		throw new Error("panic: UI->widget desync");
	}
	var byte_offset=ed.ConvertUTF8OffsetToBytesize(range_0,utf8_offset);
	var lg_key=Duktape.__byte_length(s_widget_key);
	//use JS search and convert back to ccnt...
	var byte_offset_widget_end=code_box.FindOuterBracket(byte_offset+lg_key,1);
	//do the replacement
	s_code=ed.GetText(byte_offset,byte_offset_widget_end-byte_offset);
	var freplace_params=UI.HackCallback(function(smatch,s_name,s_value){
		if(!obj_replacement){
			obj_ret[s_name]=s_value;
			return smatch;
		}
		if(!obj_replacement[s_name]){return smatch;}
		var s_replacement="'"+s_name+"':"+obj_replacement[s_name].toString()+",";
		return s_replacement;
	});
	s_code=s_code.replace(re_param_replacer,freplace_params);
	if(obj_replacement){
		code_box.transform_ops.push(byte_offset)
		code_box.transform_ops.push(byte_offset_widget_end-byte_offset)
		code_box.transform_ops.push(s_code)
	}
	return obj_ret;
};
	
var DrawFrame=function(code_box){
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
		//set OnChange
		var fonstart=UI.HackCallback(function(){
			code_box.undo_needed=0;
			this.user_anchor_x=this.user_x;
			this.user_anchor_y=this.user_y;
			this.user_anchor_w=this.w;
			this.user_anchor_h=this.h;
			///////////////
			this.old_xywh=transform_xywh(code_box,parseInt(this.id.substr(1)))
		});
		var fonchange=UI.HackCallback(function(tr){
			//we only consider top level groups, so we ignore non-top-level anchoring
			//create a replacement object first
			//var obj_replacement={x:obj.x/g_sandbox.m_relative_scaling,y:obj.y/g_sandbox.m_relative_scaling,w:obj.w/g_sandbox.m_relative_scaling,h:obj.h/g_sandbox.m_relative_scaling};
			var obj_replacement={
				x:this.user_anchor_x,
				y:this.user_anchor_y,
				w:this.user_anchor_w,
				h:this.user_anchor_h};
			if(tr.scale){
				obj_replacement.x+=obj_replacement.w*tr.relative_anchor[0]
				obj_replacement.y+=obj_replacement.h*tr.relative_anchor[1]
				obj_replacement.w*=tr.scale[0]
				obj_replacement.h*=tr.scale[1]
				obj_replacement.x-=obj_replacement.w*tr.relative_anchor[0]
				obj_replacement.y-=obj_replacement.h*tr.relative_anchor[1]
			}
			if(tr.translation){
				obj_replacement.x+=tr.translation[0];
				obj_replacement.y+=tr.translation[1];
			}
			obj_replacement.x/=g_sandbox.m_relative_scaling
			obj_replacement.y/=g_sandbox.m_relative_scaling
			obj_replacement.w/=g_sandbox.m_relative_scaling
			obj_replacement.h/=g_sandbox.m_relative_scaling
			if(this.inmate_placement!="inside"||this.inmate_align!="left"||this.inmate_valign!="up"){
				var dx_source_code_space=obj_replacement.x-this.user_anchor_x/g_sandbox.m_relative_scaling
				var dy_source_code_space=obj_replacement.y-this.user_anchor_y/g_sandbox.m_relative_scaling
				if(this.inmate_placement=='left'||this.inmate_align=='right'){
					dx_source_code_space*=-1;
				}
				if(this.inmate_placement=='up'||this.inmate_align=='down'){
					dy_source_code_space*=-1;
				}
				obj_replacement.x=(parseFloat(this.old_xywh.x)||0)+dx_source_code_space
				obj_replacement.y=(parseFloat(this.old_xywh.y)||0)+dy_source_code_space
			}
			//////////
			transform_xywh(code_box,parseInt(this.id.substr(1)),obj_replacement)
			//ed.Edit([byte_offset,byte_offset_widget_end-byte_offset,s_code]);
			//print(byte_offset,byte_offset_widget_end-byte_offset)
		});
		var fonfinish=UI.HackCallback(function(){
			code_box.undo_needed=0;
		});
		for(var i=0;i<items.length;i++){
			var item_i=items[i];
			item_i.AnchorTransform=fonstart;
			item_i.SetTransform=fonchange;
			item_i.FinalizeTransform=fonfinish;
			item_i.w_min=1;
			item_i.h_min=1;
			item_i.user_x=item_i.x;
			item_i.user_y=item_i.y;
			//item_i.old_values={x:item_i.x,y:item_i.y,w:item_i.w,h:item_i.h};
		}
		code_box.document_items=items;
	}
}

var nthIndex=function(str,pat,n){
	var L=str.length,i=-1;
	while(n>=0&&i++<L){
		i=str.indexOf(pat,i);
		n--;
	}
	return i>=L?-1:i;
}

W.subwindow_ui_insertion_bar={
	'title':'Insert widgets',h:500,
	body:function(){
		var obj_temp=W.Text("-",{anchor:'parent',anchor_align:'left',anchor_valign:'up',x:8,y:32,
			font:UI.Font("res/fonts/opensans.ttf",24),color:0xff000000,text:"Zoom"})
		obj_temp=W.Slider("zoom",{anchor:obj_temp,anchor_placement:'right',anchor_valign:'center',x:8,y:0,w:180,h:24,h_slider:8,property_name:'scale'})
		W.Text("-",{anchor:obj_temp,anchor_placement:'right',anchor_valign:'center',x:8,y:0,
			font:UI.Font("res/fonts/opensans.ttf",24),color:0xff000000,
			text:(g_sandbox.m_relative_scaling*100).toFixed(0)+"%"})
		obj_temp=W.Text("-",{anchor:'parent',anchor_align:'left',anchor_valign:'up',x:8,y:64,
			font:UI.Font("res/fonts/opensans.ttf",24),color:0xff000000,text:"Padding"})
		W.EditBox("padding_editor",{anchor:obj_temp,anchor_placement:'right',anchor_valign:'center',x:8,y:0,w:64,h:28,
			property_name:'padding'})
		W.Group("layout",{
			anchor:'parent',anchor_align:'fill',anchor_valign:'up',
			x:8,y:96,h:400,
			layout_direction:"down",layout_spacing:12,
			item_template:{object_type:W.Button,padding:4},
			items:[
				{text:'Label',property_name:'Label'},
				{text:'Button',property_name:'Button'},
				{text:'EditBox',property_name:'EditBox'},
				{text:'Slider',property_name:'Slider'},
				{text:'Select',property_name:'Select'},
			],
		})
	}
};
var g_template_code=IO.UIReadAll("res/misc/ui_template.js")
UI.NewUIEditorTab=function(fname0){
	var file_name=fname0||IO.GetNewDocumentName("ui","js","document")
	return UI.NewTab({
		file_name:file_name,
		title:UI.GetMainFileName(file_name),
		doc:undefined,
		body:function(){
			//create and keep, or throw in and continue
			UI.context_parent.body=this.doc
			var body=W.UIEditor("body",{
				'anchor':'parent','anchor_align':"fill",'anchor_valign':"fill",
				'x':0,'y':0,
				'file_name':this.file_name,
				'bgcolor':0xfff0f0f0,
			})
			if(!this.doc){
				this.doc=body;
				var s_data=(IO.ReadAll(fname0)||g_template_code);
				if(s_data){
					var code_box=body.doc
					var ed=code_box.ed;
					ed.Edit([0,0,s_data],1)
					var s_code=ed.GetText();
					var s_widget_key="/*insert here*/";
					var utf8_offset=nthIndex(s_code,s_widget_key,0)
					if(utf8_offset>=0){
						var byte_offset=ed.ConvertUTF8OffsetToBytesize(0,utf8_offset);
						code_box.sel0.ccnt=byte_offset
						code_box.sel1.ccnt=byte_offset
						code_box.OnSelectionChange()
					}
					///////////
					s_data=undefined;
					UI.Refresh()
				}
			}
			return body;
		},
		property_windows:[
			W.subwindow_ui_insertion_bar
		],
		color_theme:[0xff9a3d6a],
	})
};
UI.RegisterLoaderForExtension("js",function(fn){return UI.NewUIEditorTab(fn)})
UI.RegisterLoaderForExtension("*",function(fn){return UI.NewCodeEditorTab(fn)})

W.UIEditor=function(id,attrs){
	var obj=UI.StdWidget(id,attrs,"ui_editor");
	UI.Begin(obj);
		///////////////////
		var ed_rect=W.RoundRect("",{
			color:0xffffffff,border_color:UI.current_theme_color,border_width:2,round:4,
			anchor:parent(),anchor_align:"right",anchor_valign:"center",
			x:8,y:0,w:obj.w*0.4,h:obj.h-16,
		});
		//var tick0=Duktape.__ui_get_tick();
		var code_box=W.Edit("doc",{
			font:UI.Font("res/fonts/inconsolata.ttf",24),color:0xff000000,
			tab_width:4,
			text:"",
			anchor:ed_rect,anchor_align:"center",anchor_valign:"center",
			///////////////
			state_handlers:["renderer_programmer","colorer_programmer","line_column_unicode"],
			language:g_language_C,
			color_string:0xff1c1aa3,
			color_number:0xff000080,
			color_comment:0xff2ca033,
			color_keyword:0xffb4771f,
			color_type:0xffbc470f,
			color_symbol:0xff7f7f7f,
			color_meta:0xff9a3d6a,
			///////////////
			OnSelectionChange:function(){
				var code_box=obj.doc;
				var ed=code_box.ed;
				var ccnt_sel=code_box.sel1.ccnt;
				var range_0=code_box.FindBracketSafe(0,ccnt_sel,-1);
				var range_1=code_box.FindBracketSafe(0,ccnt_sel,1);
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
			},
			OnChange:function(){
				code_box.need_to_rerun=1;
			},
			///////////////
			x:0,y:0,w:ed_rect.w-8,h:ed_rect.h-8,
		});
		var w_sandbox_area=obj.w-ed_rect.w-24
		//print("code_box:",Duktape.__ui_seconds_between_ticks(tick0,Duktape.__ui_get_tick())*1000,"ms");
		//the sandbox is effectively a GLwidget
		UI.GLWidget(function(){
			//var tick0=Duktape.__ui_get_tick();
			//todo: scrolling
			g_sandbox.DrawSandboxScreen(obj.x+8,obj.y+8,w_sandbox_area,obj.h-16,0,0);
			//print("g_sandbox.DrawWindow",Duktape.__ui_seconds_between_ticks(tick0,Duktape.__ui_get_tick())*1000,"ms");
		})
		//create the boxes
		if(code_box.document_items){
			var items=code_box.document_items;
			var snapping_coords={'x':[],'y':[],'tolerance':UI.IS_MOBILE?8:4}
			for(var i=0;i<items.length;i++){
				var item_i=items[i];
				if(obj.controls&&obj.controls.group.selection&&obj.controls.group.selection[item_i.id]){
					//avoid self-snapping
					continue;
				}
				snapping_coords.x.push(UI.SNAP_LEFT,item_i.x);
				snapping_coords.x.push(UI.SNAP_CENTER,item_i.x+item_i.w*0.5);
				snapping_coords.x.push(UI.SNAP_RIGHT,item_i.x+item_i.w);
				snapping_coords.y.push(UI.SNAP_LEFT,item_i.y);
				snapping_coords.y.push(UI.SNAP_CENTER,item_i.y+item_i.h*0.5);
				snapping_coords.y.push(UI.SNAP_RIGHT,item_i.y+item_i.h);
				///////////
				snapping_coords.x.push(UI.SNAP_RIGHT,item_i.x-g_params.padding);
				snapping_coords.x.push(UI.SNAP_LEFT,item_i.x+item_i.w+g_params.padding);
				snapping_coords.y.push(UI.SNAP_RIGHT,item_i.y-g_params.padding);
				snapping_coords.y.push(UI.SNAP_LEFT,item_i.y+item_i.h+g_params.padding);
			}
			var sandbox_main_window_w=g_sandbox.ReadBack('[UI.sandbox_main_window_w]')[0]*g_sandbox.m_relative_scaling
			var sandbox_main_window_h=g_sandbox.ReadBack('[UI.sandbox_main_window_h]')[0]*g_sandbox.m_relative_scaling
			W.BoxDocument("controls",{
				x:obj.x+8,y:obj.y+8,w:sandbox_main_window_w,h:sandbox_main_window_h,
				'border_color':UI.current_theme_color&0xccffffff,'border_width':2,
				'color':UI.current_theme_color&0x44ffffff,
				'snapping_coords':snapping_coords,
				'items':code_box.document_items,
				'BeginTransform':function(){
					var ed=code_box.ed;
					if(code_box.undo_needed){ed.Undo();}
					code_box.transform_ops=[];
				},
				'EndTransform':function(){
					code_box.HookedEdit(code_box.transform_ops);
					code_box.transform_ops=null;
					code_box.undo_needed=1;
					code_box.need_to_rerun=1;
				},
			})
		}
		///////////////////
		//this calls BeginPaint which is not reentrant... consider it as a separate window
		//var s_code=ed_box.ed.GetText();
		//g_sandbox.eval("UI.Application=function(id,obj){"+s_code+"};UI.DrawFrame();");
		//var tick0=Duktape.__ui_get_tick();
		UI.CallNextFrame(function(){
			if(code_box.need_to_rerun){
				code_box.need_to_rerun=0;
				RerunUserCode(code_box);
			}
			DrawFrame(code_box)
			return 0
		})
		obj.InsertCode=UI.HackCallback(function(placing_hint,s_insertion){
			if(!code_box.working_range||!code_box.working_range.point0){return;}
			var ed=code_box.ed;
			var range_0=code_box.working_range.point0.ccnt;
			var range_1=code_box.working_range.point1.ccnt;
			code_box.has_errors=0;
			var s_code=ed.GetText(range_0,range_1-range_0);
			var s_widget_key="/*insert here*/";
			var utf8_offset=nthIndex(s_code,s_widget_key,0)
			if(utf8_offset<0){
				print("please don't remove the '/*insert here*/' comment")//todo
				return;
			}
			var byte_offset=ed.ConvertUTF8OffsetToBytesize(range_0,utf8_offset);
			var y_bottom_top=0,y_bottom_bottom=0,x_rightmost=0,h_standard=32
			var x,y,w,h
			if(code_box.document_items){
				for(var i=0;i<code_box.document_items.length;i++){
					var box_i=code_box.document_items[i];
					if(y_bottom_top<box_i.y/g_sandbox.m_relative_scaling){
						y_bottom_top=box_i.y/g_sandbox.m_relative_scaling;
						if(h_standard){h_standard=box_i.h/g_sandbox.m_relative_scaling}
					}
					if(y_bottom_bottom<(box_i.y+box_i.h)/g_sandbox.m_relative_scaling){y_bottom_bottom=(box_i.y+box_i.h)/g_sandbox.m_relative_scaling;}
				}
			}else{
				y_bottom_top=g_params.padding;
			}
			if(placing_hint=="line"){
				x=x_rightmost+g_params.padding
				w=sandbox_main_window_w/g_sandbox.m_relative_scaling-g_params.padding-x
				y=y_bottom_bottom+g_params.padding
				h=h_standard
			}else{
				if(code_box.document_items){
					for(var i=0;i<code_box.document_items.length;i++){
						var box_i=code_box.document_items[i];
						if(y_bottom_top<(box_i.y+box_i.h)/g_sandbox.m_relative_scaling){
							y_bottom_top=box_i.y/g_sandbox.m_relative_scaling;
							if(x_rightmost<(box_i.x+box_i.w)/g_sandbox.m_relative_scaling){
								x_rightmost=(box_i.x+box_i.w)/g_sandbox.m_relative_scaling
							}
						}
					}
				}
				x=x_rightmost+g_params.padding
				w=sandbox_main_window_w/g_sandbox.m_relative_scaling-g_params.padding-x
				y=y_bottom_top
				h=h_standard
				if(w<=0){
					x_rightmost=0
					y=y_bottom_bottom+g_params.padding
					x=x_rightmost+g_params.padding
					w=sandbox_main_window_w/g_sandbox.m_relative_scaling-g_params.padding-x
				}
			}
			var pos_str=["'x':",x,",'y':",y,",'w':",w,",'h':",h].join("");
			if(s_insertion.indexOf('W.Label(')>=0){
				//Text objects are implicitly sized
				pos_str=["'x':",x,",'y':",y].join("");
			}
			var ops=[byte_offset,0,'/*widget*/('+s_insertion.replace(new RegExp('\\$id\\$','g'),byte_offset.toString()).replace('$pos$',pos_str)+');\n\t']
			code_box.HookedEdit(ops);
			code_box.sel0.ccnt=ops[0]
			code_box.sel1.ccnt=ops[0]+Duktape.__byte_length(ops[2])
			code_box.need_to_rerun=1;
			UI.Refresh()
		})
		////////////////////////
		UI.document_property_sheet={
			'Label':[0,function(){obj.InsertCode("line","W.Label('text_$id$',{$pos$,\n\t\ttext:'label'})")}],
			'Button':[0,function(){obj.InsertCode("line","W.Button('button_$id$',{$pos$,\n\t\tproperty_name:'button_$id$',\n\t\ttext:'Button'})")}],
			'EditBox':[0,function(){obj.InsertCode("value","W.EditBox('editbox_$id$',{$pos$,\n\t\tproperty_name:'editbox_$id$'})")}],
			'Slider':[0,function(){obj.InsertCode("value","W.Slider('slider_$id$',{$pos$,\n\t\tproperty_name:'slider_$id$'})")}],
			'Select':[0,function(){obj.InsertCode("value","W.Select('select_$id$',{$pos$,\n\t\tproperty_name:'select_$id$',\n\t\titems:[0,1]})")}],
			'scale':[
				(Math.log(g_sandbox.m_relative_scaling)+2)/3,
				function(value){
					g_sandbox.m_relative_scaling=Math.exp(value*3-2)
					if(Math.abs(g_sandbox.m_relative_scaling-1)<0.1){g_sandbox.m_relative_scaling=1;}
					code_box.need_to_rerun=1;
					UI.Refresh()
				}],
			'padding':[g_params.padding.toString(),function(value){g_params.padding=value;}],
		}
		////////////////////////
		obj.Save=UI.HackCallback(function(){
			IO.CreateFile(obj.file_name,this.doc.ed.GetText())
			obj.saved_point=this.doc.ed.GetUndoQueueLength();
			UI.Refresh()
		})
		obj.title=UI.GetMainFileName(obj.file_name)+((obj.saved_point||0)!=obj.doc.ed.GetUndoQueueLength()?" *":"")
	//print("DrawUserFrame:",Duktape.__ui_seconds_between_ticks(tick0,Duktape.__ui_get_tick())*1000,"ms");
	UI.End();
	return obj
};

///////////////////////////////////////////////////////
//the code editor
W.CodeEditor_prototype=UI.InheritClass(W.Edit_prototype,{
	tab_is_char:1,
	plugin_class:'code_editor',
	state_handlers:["renderer_programmer","colorer_programmer","line_column_unicode","seeker_indentation"],
	////////////////////
	//per-language portion
	language:g_language_C,
	Init:function(){
		W.Edit_prototype.Init.call(this);
		//these are locators when set
		this.m_bookmarks=[undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined];
		this.m_unkeyed_bookmarks=[];
	},
	FindNearestBookmark:function(ccnt,direction){
		//just do a sequential search
		var best=undefined,best_bm=undefined;
		for(var i=0;i<10;i++){
			var bm=this.m_bookmarks[i]
			if(!bm){continue;}
			var dist=(bm.ccnt-ccnt)*direction;
			if(dist>=0&&!(best<dist)){
				best=dist
				best_bm=bm;
			}
		}
		for(var i=0;i<this.m_unkeyed_bookmarks.length;i++){
			var bm=this.m_unkeyed_bookmarks[i];
			if(!bm){continue;}
			var dist=(bm.ccnt-ccnt)*direction;
			if(dist>=0&&!(best<dist)){
				best=dist
				best_bm=bm;
			}
		}
		return best_bm;
	},
	DeleteBookmark:function(bm){
		//just do a sequential search
		bm.discard()
		for(var i=0;i<10;i++){
			if(bm==this.m_bookmarks[i]){
				this.m_bookmarks[i]=undefined;
				return;
			}
		}
		for(var i=0;i<this.m_unkeyed_bookmarks.length;i++){
			if(bm==this.m_unkeyed_bookmarks[i]){
				this.m_unkeyed_bookmarks[i]=undefined;
				return;
			}
		}
	},
	////////////////////
	//overloaded methods
	StartLoading:function(fn){
		var ed=this.ed;
		ed.hfile_loading=UI.EDLoader_Open(ed,fn)
		var floadNext=(function(){
			ed.hfile_loading=UI.EDLoader_Read(ed,ed.hfile_loading)
			if(ed.hfile_loading){
				UI.NextTick(floadNext);
			}else{
				this.OnLoad()
			}
			UI.Refresh()
		}).bind(this)
		if(ed.hfile_loading){
			floadNext()
		}else{
			this.OnLoad()
		}
		UI.Refresh()
	},
	//always go left
	GetBracketLevel:function(ccnt){
		var ed=this.ed;
		return ed.GetStateAt(ed.m_handler_registration["colorer"],ccnt,"lll")[1];
	},
	FindBracket:function(n_brackets,ccnt,direction){
		var ed=this.ed;
		var ret=ed.FindNearest(ed.m_handler_registration["colorer"],[0,n_brackets],"ll",ccnt,direction);
		return ret;
	},
	FindBracketSafe:function(n_brackets,ccnt,direction){
		var ret=this.FindBracket(n_brackets,ccnt,direction)
		if(ret==-1){
			if(direction<0){
				return 0;
			}else{
				return ed.GetTextSize();
			}
		}
		return ret;
	},
	FindOuterBracket:function(ccnt,direction){
		return this.FindBracket(this.GetBracketLevel(ccnt)-1,ccnt,direction);
	},
	///////////////////////////////
	GetIndentLevel:function(ccnt){
		return this.GetLC(Math.min(this.GetEnhancedHome(ccnt),ccnt))[1];
	},
	FindOuterIndentation:function(ccnt){
		var ed=this.ed;
		var id_indent=ed.m_handler_registration["seeker_indentation"]
		var my_level=this.GetIndentLevel(ccnt);
		return ed.FindNearest(id_indent,[my_level-1],"l",ccnt,-1);
	},
	///////////////////////////////
	FindOuterLevel:function(ccnt){
		var ret=Math.max(this.FindOuterBracket(ccnt,-1),this.FindOuterIndentation(ccnt))
		if(ret>=ccnt){ret=-1;}
		return ret
	}
})

W.MinimapThingy_prototype={
	dimension:'y',
	OnMouseDown:function(event){
		this.anchored_value=this.value
		this.anchored_xy=event.y
		UI.CaptureMouse(this)
	},
	OnMouseUp:function(event){
		UI.ReleaseMouse(this)
		this.anchored_value=undefined
		UI.Refresh()
	},
	OnMouseMove:function(event){
		if(this.anchored_value==undefined){return;}
		this.OnChange(Math.min(Math.max(this.anchored_value+(event.y-this.anchored_xy)/this.factor,0),1))
	},
}

UI.SEARCH_FLAG_CASE_SENSITIVE=1
UI.SEARCH_FLAG_WHOLE_WORD=2
UI.SEARCH_FLAG_REGEXP=4
W.CodeEditorWidget_prototype={
	find_flags:0,
	OnLoad:function(){
		var loaded_metadata=(UI.m_ui_metadata[this.file_name]||{})
		var doc=this.doc
		if(loaded_metadata.m_bookmarks){
			for(var i=0;i<10;i++){
				if(loaded_metadata.m_bookmarks[i]!='n/a'&&!doc.m_bookmarks[i]){
					doc.m_bookmarks[i]=doc.ed.CreateLocator(Math.max(Math.min(loaded_metadata.m_bookmarks[i],doc.ed.GetTextSize()),0))
				}
			}
		}
		if(loaded_metadata.m_unkeyed_bookmarks){
			var bm=loaded_metadata.m_unkeyed_bookmarks
			for(var i=0;i<bm.length;i++){
				doc.m_unkeyed_bookmarks.push(doc.ed.CreateLocator(Math.max(Math.min(bm[i],doc.ed.GetTextSize()),0)))
			}
		}
		if(loaded_metadata.sel0){doc.sel0.ccnt=Math.max(Math.min(loaded_metadata.sel0,doc.ed.GetTextSize()),0);}
		if(loaded_metadata.sel1){doc.sel1.ccnt=Math.max(Math.min(loaded_metadata.sel1,doc.ed.GetTextSize()),0);}
		doc.AutoScroll("center")
		doc.scrolling_animation=undefined
		UI.Refresh()
	},
	SaveMetaData:function(){
		var new_metadata={m_bookmarks:[],m_unkeyed_bookmarks:[]}
		var doc=this.doc
		for(var i=0;i<10;i++){
			var bm=doc.m_bookmarks[i]
			new_metadata.m_bookmarks[i]=(bm?bm.ccnt:'n/a')
		}
		for(var i=0;i<doc.m_unkeyed_bookmarks.length;i++){
			var bm=doc.m_unkeyed_bookmarks[i]
			if(bm){
				new_metadata.m_unkeyed_bookmarks.push(bm.ccnt)
			}
		}
		new_metadata.sel0=doc.sel0.ccnt
		new_metadata.sel1=doc.sel1.ccnt
		UI.m_ui_metadata[this.file_name]=new_metadata
	},
	OnSave:function(){
		this.SaveMetaData();
		UI.SaveMetaData();
	},
	Save:function(){
		var doc=this.doc
		if(doc.ed.hfile_loading){
			//todo: error notification
			return
		}
		var ctx=UI.EDSaver_Open(doc.ed,this.file_name)
		if(!ctx){
			//todo: error notification
			return
		}
		doc.ed.saving_context=ctx
		var fsave=UI.HackCallback(function(){
			var ret=UI.EDSaver_Write(ctx)
			if(ret=="done"){
				doc.saved_point=doc.ed.GetUndoQueueLength()
				doc.ed.saving_context=undefined
				this.OnSave();
				UI.Refresh()
			}else if(ret=="continue"){
				UI.NextTick(fsave)
			}else{
				doc.ed.saving_context=undefined
				//todo: error notification
			}
		}).bind(this)
		fsave();
	},
	////////////////////////////////////
	//todo: GetFindResult, scroll_x
	//the virtual document doesn't include middle expansion
	//middle-expand with fixed additional size to make it possible
	ResetFindingContext:function(sneedle,flags, force_ccnt){
		var doc=this.doc
		var ccnt=(force_ccnt==undefined?doc.sel1.ccnt:force_ccnt)
		if(this.m_current_find_context){
			if(force_ccnt&&force_ccnt==this.m_current_find_context.m_starting_ccnt0){
				return;
			}
			this.m_current_find_context.Cancel()
			this.m_current_find_context=undefined
		}
		if(!sneedle.length){
			this.m_current_find_context=undefined
			this.m_current_needle=undefined
			return;
		}
		this.m_current_needle=sneedle
		var hc=UI.GetCharacterHeight(doc.font)
		var ccnt_tot=doc.ed.GetTextSize()
		var ytot=doc.ed.XYFromCcnt(ccnt_tot).y+doc.ed.GetCharacterHeightAt(ccnt_tot);
		var ctx={
			m_is_just_reset:1,
			m_forward_matches:[],
			m_forward_frontier:ccnt,
			m_backward_matches:[],
			m_backward_frontier:ccnt,
			m_highlight_ranges:[],
			m_locators:[],
			m_owner:this,
			m_starting_ccnt0:force_ccnt==undefined?doc.sel0.ccnt:ccnt,
			m_starting_ccnt1:force_ccnt==undefined?doc.sel1.ccnt:ccnt,
			m_current_point:0,
			m_needle:sneedle,
			m_flags:flags,
			m_find_scroll_visual_y:-(this.h/this.find_item_scale-this.find_item_expand_current*hc)*0.5,
			///////////////////////////////
			m_merged_y_windows_backward:[],
			m_merged_y_windows_forward:[],
			m_mergable_ccnt_backward:undefined,
			m_mergable_ccnt_forward:undefined,
			m_current_merged_item:0,
			m_y_extent_backward:0,
			m_y_extent_forward:0,
			CreateHighlight:function(ccnt0,ccnt1){
				var doc=this.m_owner.doc
				var locator_0=doc.ed.CreateLocator(ccnt0,-1);locator_0.undo_tracked=0;
				var locator_1=doc.ed.CreateLocator(ccnt1,-1);locator_1.undo_tracked=0;
				var hlobj=doc.ed.CreateHighlight(locator_0,locator_1,-1)
				hlobj.color=this.m_owner.find_item_highlight_color;
				hlobj.invertible=0;
				this.m_highlight_ranges.push(hlobj);
				this.m_locators.push(locator_0);
				this.m_locators.push(locator_1);
				UI.Refresh()
			},
			ReportMatchForward:function(ccnt0,ccnt1){
				this.m_forward_matches.push(ccnt0,ccnt1)
				this.CreateHighlight(ccnt0,ccnt1)
				return 1024
			},
			ReportMatchBackward:function(ccnt0,ccnt1){
				this.m_backward_matches.push(ccnt0,ccnt1)
				this.CreateHighlight(ccnt0,ccnt1)
				return 1024
			},
			Cancel:function(){
				for(var i=0;i<this.m_highlight_ranges.length;i++){
					this.m_highlight_ranges[i].discard()
				}
				for(var i=0;i<this.m_locators.length;i++){
					this.m_locators[i].discard()
				}
			},
		}
		this.m_current_find_context=ctx
		var y_id=doc.ed.XYFromCcnt(ccnt).y
		var y_id0=Math.max(y_id-hc,0),y_id1=Math.min(y_id+hc*2,ytot)
		//id, virtual_screen_y, scroll_y, h
		//the middle segment is duplicated for convenience
		ctx.m_merged_y_windows_backward.push(0,-hc,y_id0,y_id1-y_id0)
		ctx.m_merged_y_windows_forward.push(0,-hc,y_id0,y_id1-y_id0)
		ctx.m_mergable_ccnt_backward=doc.ed.SeekXY(0,y_id)
		ctx.m_mergable_ccnt_forward=doc.ed.SeekXY(1e17,y_id)
		ctx.m_y_extent_backward=-hc
		ctx.m_y_extent_forward=hc*2
		if(force_ccnt==undefined){
			this.AutoScrollFindItems();
			UI.InvalidateCurrentFrame();
		}
	},
	GetFindItem:function(id){
		var ctx=this.m_current_find_context
		var arr,ofs;
		if(id<0){
			ofs=-id
			arr=ctx.m_merged_y_windows_backward
		}else{
			ofs=id
			arr=ctx.m_merged_y_windows_forward
		}
		ofs<<=2
		return {id:arr[ofs+0],visual_y:arr[ofs+1],scroll_y:arr[ofs+2],shared_h:arr[ofs+3]}
	},
	BisectFindItems:function(y){
		var ctx=this.m_current_find_context
		var l0=-((ctx.m_merged_y_windows_backward.length>>2)-1);
		var l=l0;
		var r=(ctx.m_merged_y_windows_forward.length>>2)-1
		while(l<=r){
			var m=(l+r)>>1
			var fitem=this.GetFindItem(m)
			if(fitem.visual_y<=y){
				l=m+1;
			}else{
				r=m-1;
			}
		}
		return Math.max(r,l0);
	},
	GetMatchCcnt:function(id,side){
		var ctx=this.m_current_find_context
		if(id==0){
			return side==0?ctx.m_starting_ccnt0:ctx.m_starting_ccnt1;
		}else if(id<0){
			var ofs=(id+1)*(-2)+side
			if(ofs<ctx.m_backward_matches.length){
				return ctx.m_backward_matches[ofs]
			}
		}else{
			var ofs=(id-1)*2+side
			if(ofs<ctx.m_forward_matches.length){
				return ctx.m_forward_matches[ofs]
			}
		}
		return undefined
	},
	AutoScrollFindItems:function(){
		var doc=this.doc
		var ctx=this.m_current_find_context
		var l0=-((ctx.m_merged_y_windows_backward.length>>2)-1)
		var l=l0
		var r=(ctx.m_merged_y_windows_forward.length>>2)-1
		var id=ctx.m_current_point
		while(l<=r){
			var m=(l+r)>>1
			var fitem=this.GetFindItem(m)
			if(fitem.id<=id){
				l=m+1;
			}else{
				r=m-1;
			}
		}
		if(r<l0){r=l0;}
		var fitem_current=this.GetFindItem(r)
		ctx.m_current_merged_item=r
		ctx.m_current_visual_y=doc.ed.XYFromCcnt(this.GetMatchCcnt(id,0)).y-fitem_current.scroll_y+fitem_current.visual_y
		////////////////////
		var hc=UI.GetCharacterHeight(doc.font)
		var find_shared_h=(this.h-this.h_find_bar)/this.find_item_scale-this.find_item_expand_current*hc
		var h_bof_eof_message_with_sep=UI.GetCharacterHeight(this.find_message_font)+this.find_item_separation*2
		ctx.m_current_visual_h=find_shared_h
		doc.sel0.ccnt=this.GetMatchCcnt(id,0)
		doc.sel1.ccnt=this.GetMatchCcnt(id,1)
		doc.AutoScroll("show")
		ctx.m_find_scroll_visual_y=Math.min(Math.max(ctx.m_find_scroll_visual_y,fitem_current.visual_y+fitem_current.shared_h+h_bof_eof_message_with_sep-find_shared_h),fitem_current.visual_y-h_bof_eof_message_with_sep)
		ctx.m_find_scroll_visual_y=Math.max(Math.min(ctx.m_find_scroll_visual_y,ctx.m_y_extent_forward+h_bof_eof_message_with_sep-find_shared_h),ctx.m_y_extent_backward-h_bof_eof_message_with_sep)
	},
	//visual y -> bsearch -> scroll_y -> ccnt -> bsearch -> match id
	SeekFindItemByVisualY:function(visual_y,scroll_x){
		var ctx=this.m_current_find_context
		var doc=this.doc
		//visual y -> bsearch -> scroll_y
		var l0=-((ctx.m_merged_y_windows_backward.length>>2)-1);
		var l=l0;
		var r=(ctx.m_merged_y_windows_forward.length>>2)-1
		var id=ctx.m_current_point
		while(l<=r){
			var m=(l+r)>>1
			var fitem=this.GetFindItem(m)
			if(fitem.visual_y<=visual_y){
				l=m+1;
			}else{
				r=m-1;
			}
		}
		if(r<l0){r=l0;}
		//scroll_y -> ccnt
		var fitem=this.GetFindItem(r)
		var scroll_y=visual_y-fitem.visual_y+fitem.scroll_y
		var ccnt=doc.ed.SeekXY(scroll_x,scroll_y)
		//ccnt -> bsearch -> match id
		l0=-(ctx.m_backward_matches.length>>1)
		l=l0
		r=(ctx.m_forward_matches.length>>1)
		while(l<=r){
			var m=(l+r)>>1
			var ccnt_m=this.GetMatchCcnt(m,0)
			if(ccnt_m<=ccnt){
				l=m+1;
			}else{
				r=m-1;
			}
		}
		if(r<l0){r=l0;}
		ctx.m_current_point=r
	},
	RenderVisibleFindItems:function(w_line_numbers,w_find_items,h_find_items, DrawItem){
		this.AutoScrollFindItems()
		//do it here and now
		var ctx=this.m_current_find_context
		var doc=this.doc
		var hc=UI.GetCharacterHeight(doc.font)
		var h_bof_eof_message=UI.GetCharacterHeight(this.find_message_font)+this.find_item_separation
		var eps=hc/16;
		var ccnt_middle=this.GetMatchCcnt(ctx.m_current_point,1)
		var xy_middle=doc.ed.XYFromCcnt(ccnt_middle)
		var find_scroll_x=Math.max(xy_middle.x-(w_find_items-w_line_numbers),0)
		var find_scroll_y=ctx.m_find_scroll_visual_y
		var anim_node=W.AnimationNode("find_item_scrolling",{
			scroll_x:find_scroll_x,
			scroll_y:find_scroll_y,
		})
		find_scroll_x=anim_node.scroll_x
		find_scroll_y=anim_node.scroll_y
		if(ctx.m_is_just_reset){
			//don't animate the first round
			ctx.m_is_just_reset=0;
			this.find_item_scrolling=undefined;
		}
		var find_shared_h=h_find_items
		var ccnt_tot=doc.ed.GetTextSize()
		var ytot=doc.ed.XYFromCcnt(ccnt_tot).y+doc.ed.GetCharacterHeightAt(ccnt_tot);
		var h_safety=hc*this.find_item_expand_current;
		var h_safety_internal=h_safety+h_find_items//for page up/down
		if(find_scroll_y<ctx.m_y_extent_backward+h_safety_internal&&ctx.m_backward_frontier>=0){
			var p0=ctx.m_backward_matches.length
			ctx.m_backward_frontier=UI.ED_Search(doc.ed,ctx.m_backward_frontier,-1,ctx.m_needle,ctx.m_flags,262144,ctx.ReportMatchBackward,ctx)
			var ccnt_merged_anyway=ctx.m_mergable_ccnt_backward
			var current_y1=ctx.m_merged_y_windows_backward.pop()
			var current_y0=ctx.m_merged_y_windows_backward.pop()
			var current_visual_y=ctx.m_merged_y_windows_backward.pop()
			var current_id=ctx.m_merged_y_windows_backward.pop()
			current_y1+=current_y0
			for(var pmatch=p0;pmatch<ctx.m_backward_matches.length;pmatch+=2){
				var ccnt_id=ctx.m_backward_matches[pmatch]
				if(ccnt_id>=ccnt_merged_anyway){current_id=-1-(pmatch>>1);continue;}
				var y_id=doc.ed.XYFromCcnt(ccnt_id).y
				var y_id0=Math.max(y_id-hc,0),y_id1=Math.min(y_id+hc*2,ytot)
				if(y_id1>current_y0-eps){
					//merge
					current_visual_y-=Math.max(current_y0-y_id0,0)
					current_id=-1-(pmatch>>1)
					current_y0=y_id0
				}else{
					ctx.m_merged_y_windows_backward.push(current_id,current_visual_y,current_y0,current_y1-current_y0)
					current_id=-1-(pmatch>>1)
					current_y0=y_id0
					current_y1=y_id1
					current_visual_y-=y_id1-y_id0+this.find_item_separation
				}
				ccnt_merged_anyway=doc.ed.SeekXY(0,y_id)
			}
			ctx.m_merged_y_windows_backward.push(current_id,current_visual_y,current_y0,current_y1-current_y0)
			ctx.m_mergable_ccnt_backward=ccnt_merged_anyway
			ctx.m_merged_y_windows_forward[0]=ctx.m_merged_y_windows_backward[0]
			ctx.m_merged_y_windows_forward[1]=ctx.m_merged_y_windows_backward[1]
			ctx.m_merged_y_windows_forward[2]=ctx.m_merged_y_windows_backward[2]
			ctx.m_merged_y_windows_forward[3]=ctx.m_merged_y_windows_backward[3]
			ctx.m_y_extent_backward=current_visual_y
			if(ctx.m_home_end=='home'){
				ctx.m_current_point=-(ctx.m_backward_matches.length>>1)
			}
			UI.Refresh()
		}
		if(find_scroll_y+find_shared_h>ctx.m_y_extent_forward-h_safety_internal&&ctx.m_forward_frontier>=0){
			var p0=ctx.m_forward_matches.length
			ctx.m_forward_frontier=UI.ED_Search(doc.ed,ctx.m_forward_frontier,1,ctx.m_needle,ctx.m_flags,262144,ctx.ReportMatchForward,ctx);
			var ccnt_merged_anyway=ctx.m_mergable_ccnt_forward
			var current_y1=ctx.m_merged_y_windows_forward.pop()
			var current_y0=ctx.m_merged_y_windows_forward.pop()
			var current_visual_y=ctx.m_merged_y_windows_forward.pop()
			var current_id=ctx.m_merged_y_windows_forward.pop()
			current_y1+=current_y0
			for(var pmatch=p0;pmatch<ctx.m_forward_matches.length;pmatch+=2){
				var ccnt_id=ctx.m_forward_matches[pmatch]
				if(ccnt_id<=ccnt_merged_anyway){continue;}
				var y_id=doc.ed.XYFromCcnt(ccnt_id).y
				var y_id0=Math.max(y_id-hc,0),y_id1=Math.min(y_id+hc*2,ytot)
				if(y_id0<current_y1+eps){
					//merge
					current_y1=y_id1
				}else{
					ctx.m_merged_y_windows_forward.push(current_id,current_visual_y,current_y0,current_y1-current_y0)
					current_visual_y+=current_y1-current_y0+this.find_item_separation
					current_id=(pmatch>>1)+1
					current_y0=y_id0
					current_y1=y_id1
				}
				ccnt_merged_anyway=doc.ed.SeekXY(1e17,y_id)
			}
			ctx.m_merged_y_windows_forward.push(current_id,current_visual_y,current_y0,current_y1-current_y0)
			ctx.m_mergable_ccnt_forward=ccnt_merged_anyway
			ctx.m_merged_y_windows_backward[0]=ctx.m_merged_y_windows_forward[0]
			ctx.m_merged_y_windows_backward[1]=ctx.m_merged_y_windows_forward[1]
			ctx.m_merged_y_windows_backward[2]=ctx.m_merged_y_windows_forward[2]
			ctx.m_merged_y_windows_backward[3]=ctx.m_merged_y_windows_forward[3]
			ctx.m_y_extent_forward=current_visual_y+current_y1-current_y0
			if(ctx.m_home_end=='end'){
				ctx.m_current_point=(ctx.m_forward_matches.length>>1)
			}
			UI.Refresh()
		}
		var p0=this.BisectFindItems(find_scroll_y-h_safety)
		var p1=this.BisectFindItems(find_scroll_y+find_shared_h+h_safety)
		var ret=[]
		if(p0==-((ctx.m_merged_y_windows_backward.length>>2)-1)){
			//BOF
			var s_bof_message;
			if(ctx.m_backward_frontier>=0){
				s_bof_message=UI._("Searching @1%").replace("@1",((1-ctx.m_backward_frontier/ccnt_tot)*100).toFixed(0))
			}else{
				s_bof_message=UI._("No more matches above")
			}
			var text_dim=UI.MeasureText(this.find_message_font,s_bof_message)
			var y=ctx.m_y_extent_backward-find_scroll_y-h_bof_eof_message
			W.Text("",{
				x:(w_find_items-text_dim.w)*0.5,y:y,
				font:this.find_message_font,color:this.find_message_color,
				text:s_bof_message})
		}
		for(var i=p0;i<=p1;i++){
			var find_item_i=this.GetFindItem(i)
			var h_expand=0
			if(i==ctx.m_current_merged_item){
				h_expand=hc*this.find_item_expand_current;
			}
			var nodekey="find_item_"+i.toString();
			h_expand=W.AnimationNode(nodekey,{
				h_expand:h_expand,
			}).h_expand
			find_scroll_y-=h_expand*0.5
			DrawItem(find_item_i, find_scroll_x,find_scroll_y,h_expand)
			find_scroll_y-=h_expand*0.5
		}
		if(p1==(ctx.m_merged_y_windows_forward.length>>2)-1){
			//EOF
			var s_eof_message;
			if(ctx.m_forward_frontier>=0){
				s_eof_message=UI._("Searching @1%").replace("@1",((ctx.m_forward_frontier/ccnt_tot)*100).toFixed(0))
			}else{
				s_eof_message=UI._("No more matches below")
			}
			var text_dim=UI.MeasureText(this.find_message_font,s_eof_message)
			var y=ctx.m_y_extent_forward-find_scroll_y+this.find_item_separation
			W.Text("",{
				x:(w_find_items-text_dim.w)*0.5,y:y,
				font:this.find_message_font,color:this.find_message_color,
				text:s_eof_message})
		}
		return ret
	},
}

var ffindbar_plugin=function(){
	this.AddEventHandler('ESC',function(){
		var obj=this.owner
		obj.show_find_bar=0;
		obj.doc.sel0.ccnt=obj.m_sel0_before_find
		obj.doc.sel1.ccnt=obj.m_sel1_before_find
		obj.doc.AutoScroll('center')
		obj.doc.scrolling_animation=undefined
		UI.Refresh()
	})
	this.AddEventHandler('RETURN',function(){
		var obj=this.owner
		obj.show_find_bar=0;
		obj.doc.AutoScroll('center')
		obj.doc.scrolling_animation=undefined
		UI.Refresh()
	})
	this.AddEventHandler('change',function(){
		var obj=this.owner
		obj.doc.sel0.ccnt=obj.m_sel0_before_find
		obj.doc.sel1.ccnt=obj.m_sel1_before_find
		obj.ResetFindingContext(this.ed.GetText(),obj.find_flags)
	})
	this.AddEventHandler('UP',function(){
		var obj=this.owner
		if(obj.m_current_find_context){
			var ctx=obj.m_current_find_context
			ctx.m_home_end=undefined;
			if(ctx.m_current_point>-((ctx.m_backward_matches.length>>1))){
				ctx.m_current_point--
				obj.AutoScrollFindItems()
				UI.Refresh()
			}
		}
	})
	this.AddEventHandler('DOWN',function(){
		var obj=this.owner
		if(obj.m_current_find_context){
			var ctx=obj.m_current_find_context
			ctx.m_home_end=undefined;
			if(ctx.m_current_point<(ctx.m_forward_matches.length>>1)){
				ctx.m_current_point++
				obj.AutoScrollFindItems()
				UI.Refresh()
			}
		}
	})
	//////////////////////////////////////////////////
	this.AddEventHandler('PGUP',function(){
		var obj=this.owner
		if(obj.m_current_find_context){
			var ctx=obj.m_current_find_context
			ctx.m_find_scroll_visual_y-=ctx.m_current_visual_h
			obj.SeekFindItemByVisualY(ctx.m_current_visual_y-ctx.m_current_visual_h,1e17)
			ctx.m_home_end=undefined;
			obj.AutoScrollFindItems()
			UI.Refresh()
		}
	})
	this.AddEventHandler('PGDN',function(){
		var obj=this.owner
		if(obj.m_current_find_context){
			var ctx=obj.m_current_find_context
			ctx.m_find_scroll_visual_y+=ctx.m_current_visual_h
			obj.SeekFindItemByVisualY(ctx.m_current_visual_y+ctx.m_current_visual_h,0)
			ctx.m_home_end=undefined;
			obj.AutoScrollFindItems()
			UI.Refresh()
		}
	})
	this.AddEventHandler('CTRL+HOME',function(){
		var obj=this.owner
		if(obj.m_current_find_context){
			var ctx=obj.m_current_find_context
			obj.SeekFindItemByVisualY(ctx.m_y_extent_backward,0)
			ctx.m_home_end='home';
			obj.AutoScrollFindItems()
			UI.Refresh()
		}
	})
	this.AddEventHandler('CTRL+END',function(){
		var obj=this.owner
		if(obj.m_current_find_context){
			var ctx=obj.m_current_find_context
			obj.SeekFindItemByVisualY(ctx.m_y_extent_forward,1e17)
			ctx.m_home_end='end';
			obj.AutoScrollFindItems()
			UI.Refresh()
		}
	})
	//ctx.m_current_visual_y
	//todo: main editor onchange should invalidate the find context
}

W.CodeEditor=function(id,attrs){
	var obj=UI.StdWidget(id,attrs,"code_editor",W.CodeEditorWidget_prototype);
	UI.Begin(obj)
		//main code area
		var doc=obj.doc
		var prev_h_top_hint=(obj.h_top_hint||0),h_top_hint=0,w_line_numbers=0,w_scrolling_area=0,y_top_hint_scroll=0;
		var h_scrolling_area=obj.h
		var h_top_find=0,h_bottom_find=0
		var editor_style=UI.default_styles.code_editor.editor_style
		var top_hint_bbs=[]
		var current_find_context=obj.m_current_find_context
		var ytot
		if(doc){
			//scrolling and stuff
			var ccnt_tot=doc.ed.GetTextSize()
			var ytot=doc.ed.XYFromCcnt(ccnt_tot).y+doc.ed.GetCharacterHeightAt(ccnt_tot);
			if(obj.h<ytot){
				w_scrolling_area=obj.w_scroll_bar+4
				if(obj.show_minimap){
					w_scrolling_area+=obj.w_minimap+obj.padding
				}
			}
			if(obj.w<=w_line_numbers+w_scrolling_area){
				w_scrolling_area=0
				if(obj.w<=w_line_numbers){
					w_line_numbers=obj.w*0.5
				}
			}
			//top hint in a separate area
			if(obj.show_top_hint&&!obj.show_find_bar){
				var top_hints=[];
				var rendering_ccnt0=doc.SeekXY(doc.scroll_x,doc.scroll_y)
				var ccnt=doc.GetEnhancedHome(doc.sel1.ccnt)
				//prev_h_top_hint
				for(;;){
					var ccnti=ccnt
					ccnt=doc.FindOuterLevel(ccnti)
					if(ccnt<0||ccnt>=ccnti){break}
					if(ccnt<rendering_ccnt0){
						top_hints.push(ccnt)
					}
					if(top_hints.length>=obj.top_hint_max_levels){break;}
				}
				if(top_hints.length){
					//convert to bbs
					var top_hint_inv=[];
					for(var i=top_hints.length-1;i>=0;i--){
						top_hint_inv.push(top_hints[i]);
					}
					var line_xys=doc.ed.GetXYEnMasse(top_hint_inv)
					var hc=UI.GetCharacterHeight(doc.font)
					var eps=hc/16;
					var cur_bb_y0=line_xys[1];
					var cur_bb_y1=cur_bb_y0+hc;
					h_top_hint=hc
					for(var i=2;i<line_xys.length;i+=2){
						var y=line_xys[i+1];
						if(Math.abs(y-cur_bb_y1)<eps){
							cur_bb_y1=y+hc;
							h_top_hint+=hc
						}else if(y<cur_bb_y1){
							continue
						}else{
							top_hint_bbs.push(cur_bb_y0,cur_bb_y1)
							cur_bb_y0=y;
							cur_bb_y1=y+hc;
							h_top_hint+=hc
						}
					}
					if(h_top_hint>hc*obj.top_hint_max_lines-eps){
						y_top_hint_scroll=hc*obj.top_hint_max_lines-h_top_hint;
						h_top_hint=hc*obj.top_hint_max_lines;
					}
					top_hint_bbs.push(cur_bb_y0,cur_bb_y1)
				}
			}else{
				h_top_hint=0
			}
			//if(UI.nd_captured){
			//	h_top_hint=prev_h_top_hint;//don't change it while scrolling
			//}
			if(Math.abs(h_top_hint-prev_h_top_hint)>4&&h_top_hint>0&&!UI.nd_captured){
				h_top_hint=(h_top_hint*0.5+prev_h_top_hint*0.5);
				UI.Refresh()
			}
			obj.h_top_hint=h_top_hint
			if(h_top_hint-prev_h_top_hint){
				if(doc.scrolling_animation){
					var anim=doc.scrolling_animation
					if(anim.transition_current_frame){anim.transition_current_frame.scroll_y+=h_top_hint-prev_h_top_hint;}
					if(anim.transition_frame0){anim.transition_frame0.scroll_y+=h_top_hint-prev_h_top_hint;}
					if(anim.transition_frame1){anim.transition_frame1.scroll_y+=h_top_hint-prev_h_top_hint;}
				}
				doc.scroll_y+=h_top_hint-prev_h_top_hint
				doc.h=obj.h-h_top_hint
				if(!UI.nd_captured){doc.AutoScroll("show");}
			}
			//current line highlight
			if(!doc.cur_line_hl){
				doc.cur_line_p0=doc.ed.CreateLocator(0,-1);doc.cur_line_p0.undo_tracked=0;
				doc.cur_line_p1=doc.ed.CreateLocator(0,-1);doc.cur_line_p1.undo_tracked=0;
				doc.cur_line_hl=doc.ed.CreateHighlight(doc.cur_line_p0,doc.cur_line_p1,-100);
				doc.cur_line_hl.color=obj.color_cur_line_highlight;
				doc.cur_line_hl.invertible=0;
			}
			var line_current=doc.GetLC(doc.sel1.ccnt)[0]
			var line_ccnts=doc.SeekAllLinesBetween(line_current,line_current+2)
			doc.cur_line_p0.ccnt=line_ccnts[0];
			doc.cur_line_p1.ccnt=line_ccnts[1];
			//find highlight
			if(!obj.show_find_bar&&obj.m_current_needle){
				//repeat the animation to get correct the correct scrolling information
				UI.Begin(doc)
					var anim=W.AnimationNode("scrolling_animation",{transition_dt:doc.scroll_transition_dt,
						scroll_x:doc.scroll_x,
						scroll_y:doc.scroll_y})
				UI.End("temp")
				doc.visible_scroll_x=anim.scroll_x
				doc.visible_scroll_y=anim.scroll_y
				var scroll_x=doc.visible_scroll_x;
				var scroll_y=doc.visible_scroll_y;
				var area_w=doc.w
				var area_h=doc.h
				var rendering_ccnt0=doc.SeekXY(scroll_x,scroll_y)
				var rendering_ccnt1=doc.SeekXY(scroll_x+area_w,scroll_y+area_h)
				obj.ResetFindingContext(obj.m_current_needle,obj.find_flags, Math.min(Math.max(rendering_ccnt0,doc.SeekLC(doc.GetLC(doc.sel1.ccnt)[0],0)),rendering_ccnt1))
				var ctx=obj.m_current_find_context
				current_find_context=ctx
				if(ctx.m_backward_frontier>=0&&ctx.m_backward_frontier>rendering_ccnt0){
					ctx.m_backward_frontier=UI.ED_Search(doc.ed,ctx.m_backward_frontier,-1,ctx.m_needle,ctx.m_flags,65536,ctx.ReportMatchBackward,ctx)
					UI.Refresh()
				}
				if(ctx.m_forward_frontier>=0&&ctx.m_forward_frontier<rendering_ccnt1){
					ctx.m_forward_frontier=UI.ED_Search(doc.ed,ctx.m_forward_frontier,1,ctx.m_needle,ctx.m_flags,65536,ctx.ReportMatchForward,ctx);
					UI.Refresh()
				}
			}
		}
		//hopefully 8 is the widest char
		if(obj.show_line_numbers){
			var lmax=(doc?doc.GetLC(doc.ed.GetTextSize())[0]:0)+1
			w_line_numbers=lmax.toString().length*UI.GetCharacterAdvance(obj.line_number_font,56);
		}
		var w_bookmark=UI.GetCharacterAdvance(obj.bookmark_font,56)+4
		w_line_numbers+=obj.padding+w_bookmark;
		if(obj.show_find_bar&&current_find_context){
			UI.RoundRect({color:obj.find_mode_bgcolor,x:obj.x,y:obj.y,w:obj.w,h:obj.h})
			UI.RoundRect({color:obj.bgcolor,x:obj.x+obj.w-w_scrolling_area,y:obj.y,w:w_scrolling_area,h:obj.h})
		}else{
			UI.RoundRect({color:obj.line_number_bgcolor,x:obj.x,y:obj.y,w:w_line_numbers,h:obj.h})
			UI.RoundRect({color:obj.bgcolor,x:obj.x+w_line_numbers,y:obj.y,w:obj.w-w_line_numbers,h:obj.h})
		}
		//todo: loading progress - notification system
		if(doc&&doc.ed.saving_context){
			//todo: draw a progress bar with no interaction
			obj.__children.push(doc)
		}else{
			if(obj.show_find_bar){
				h_top_find+=obj.h_find_bar
			}
			//individual lines, each with a box and a little shadow for separation
			var h_max_find_items_per_side=(obj.h-obj.h_find_bar)*obj.find_item_space_percentage*0.5
			var h_find_item_middle=obj.h-obj.h_find_bar-h_max_find_items_per_side*2
			//var find_ranges_back=undefined;
			//var find_ranges_forward=undefined;
			var find_item_scroll_x=undefined
			var w_document=obj.w-w_scrolling_area-w_line_numbers
			var DrawFindItemBox=function(y,h){
				UI.RoundRect({color:obj.line_number_bgcolor,x:0,y:y,w:w_line_numbers,h:h})
				UI.RoundRect({color:obj.bgcolor,x:0+w_line_numbers,y:y,w:(obj.w-w_scrolling_area)/obj.find_item_scale,h:h})
				UI.RoundRect({x:0,y:y,w:(obj.w-w_scrolling_area)/obj.find_item_scale,h:h,
					color:0,border_color:obj.find_item_border_color,border_width:obj.find_item_border_width})
				UI.PushCliprect(0,y+h,(obj.w-w_scrolling_area)/obj.find_item_scale,obj.find_item_separation)
					UI.RoundRect({x:0-obj.find_item_shadow_size,y:y+h-obj.find_item_shadow_size,w:(obj.w-w_scrolling_area)/obj.find_item_scale+obj.find_item_shadow_size*2,h:obj.find_item_shadow_size*2,
						color:obj.find_item_shadow_color,
						round:obj.find_item_shadow_size,
						border_width:-obj.find_item_shadow_size})
				UI.PopCliprect()
			}
			var DrawFindItemHighlight=function(y,h,highlight_alpha){
				var alpha=Math.max(Math.min(((1-highlight_alpha)*64)|0,255),0)
				UI.RoundRect({color:(obj.find_mode_bgcolor&0xffffff)|(alpha<<24),x:0,y:y,w:(obj.w-w_scrolling_area)/obj.find_item_scale,h:h})
			}
			if(obj.show_find_bar&&current_find_context){
				obj.__children.push(doc)
				UI.Begin(doc)
					var anim=W.AnimationNode("scrolling_animation",{transition_dt:doc.scroll_transition_dt,
						scroll_x:doc.scroll_x,
						scroll_y:doc.scroll_y})
				UI.End()
				doc.visible_scroll_x=anim.scroll_x
				doc.visible_scroll_y=anim.scroll_y
			}else{
				//if(!?){
				//	!? //this.m_current_needle
				//}
				W.Edit("doc",{
					///////////////
					language:g_language_C,//todo
					style:editor_style,
					///////////////
					x:obj.x+w_line_numbers+obj.padding,y:obj.y+h_top_hint+h_top_find,w:obj.w-w_line_numbers-obj.padding-w_scrolling_area,h:obj.h-h_top_hint-h_top_find-h_bottom_find,
				},W.CodeEditor_prototype);
			}
			if(!doc){
				//initiate progressive loading
				doc=obj.doc
				doc.OnLoad=obj.OnLoad.bind(obj)
				doc.StartLoading(obj.file_name)
				UI.InvalidateCurrentFrame()
			}
			//prepare bookmarks - they appear under line numbers
			var bm_ccnts=[]
			for(var i=0;i<doc.m_bookmarks.length;i++){
				var bm=doc.m_bookmarks[i];
				if(bm){
					bm_ccnts.push([i,bm.ccnt])
				}
			}
			var bm_filtered=[];
			for(var i=0;i<doc.m_unkeyed_bookmarks.length;i++){
				var bm=doc.m_unkeyed_bookmarks[i];
				if(bm){
					bm_ccnts.push([-1,bm.ccnt])
					bm_filtered.push(bm)
				}
			}
			this.m_unkeyed_bookmarks=bm_filtered;
			var bm_xys=undefined
			if(bm_ccnts.length){
				bm_ccnts.sort(function(a,b){return (a[1]*10+a[0])-(b[1]*10+b[0]);});
				bm_xys=doc.ed.GetXYEnMasse(bm_ccnts.map(function(a){return a[1]}))
			}
			//general annotation system after find - f3 / shift-f3
			//generic drawing function
			var line_current=doc.GetLC(doc.sel1.ccnt)[0]
			var DrawLineNumbers=function(scroll_x,scroll_y,area_w,area_y,area_h){
				if(bm_xys){
					var hc=UI.GetCharacterHeight(doc.font)
					UI.PushCliprect(obj.x,area_y,obj.w,area_h)
					for(var i=0;i<bm_ccnts.length;i++){
						var y=bm_xys[i*2+1]-scroll_y+area_y
						var id=bm_ccnts[i][0]
						UI.RoundRect({x:2,y:y+4,w:w_line_numbers-4,h:hc-8,
							color:obj.bookmark_color,
							border_color:obj.bookmark_border_color,
							border_width:Math.min(hc/8,2),
							round:4})
						if(id>=0){
							UI.DrawChar(obj.bookmark_font,4,y+4,obj.bookmark_text_color,48+id)
						}
					}
					UI.PopCliprect()
				}
				if(obj.show_line_numbers){
					var rendering_ccnt0=doc.SeekXY(scroll_x,scroll_y)
					var rendering_ccnt1=doc.SeekXY(scroll_x+area_w,scroll_y+area_h)
					var dy_line_number=(UI.GetCharacterHeight(doc.font)-UI.GetCharacterHeight(obj.line_number_font))*0.5;
					var line0=doc.GetLC(rendering_ccnt0)[0];
					var line1=doc.GetLC(rendering_ccnt1)[0];
					var line_ccnts=doc.SeekAllLinesBetween(line0,line1+1);
					var line_xys=doc.ed.GetXYEnMasse(line_ccnts)
					UI.PushCliprect(obj.x,area_y,obj.w,area_h)
					for(var i=0;i<line_ccnts.length;i++){
						if(i&&line_ccnts[i]==line_ccnts[i-1]){break;}
						var s_line_number=(line0+i+1).toString();
						var y=line_xys[i*2+1]-scroll_y+dy_line_number+area_y
						var text_dim=UI.MeasureText(obj.line_number_font,s_line_number)
						var x=w_line_numbers-text_dim.w-obj.padding
						W.Text("",{x:obj.x+x,y:y, font:obj.line_number_font,text:s_line_number,color:line0+i==line_current?obj.line_number_color_focus:obj.line_number_color})
					}
					UI.PopCliprect()
				}
			}
			//the find bar and stuff
			if(obj.show_find_bar&&current_find_context){
				//draw the find items
				UI.PushSubWindow(obj.x,obj.y+obj.h_find_bar,obj.w-w_scrolling_area,obj.h-obj.h_find_bar,obj.find_item_scale)
				var hc=UI.GetCharacterHeight(doc.font)
				var w_find_items=(obj.w-w_scrolling_area)/obj.find_item_scale, h_find_items=(obj.h-obj.h_find_bar)/obj.find_item_scale-obj.find_item_expand_current*hc;
				var h_expand_max=hc*obj.find_item_expand_current
				var render_secs=0,ln_secs=0;
				//DrawItem
				obj.RenderVisibleFindItems(w_line_numbers+obj.padding,w_find_items,h_find_items,function(find_item_i,find_scroll_x,find_scroll_y,h_expand){
					var doc_h=find_item_i.shared_h+h_expand
					var doc_scroll_y=Math.max(Math.min(find_item_i.scroll_y-h_expand*0.5,ytot-doc_h),0)
					DrawFindItemBox(find_item_i.visual_y-find_scroll_y-h_expand*0.5,doc_h)
					var tick0=Duktape.__ui_get_tick()
					doc.ed.Render({x:find_scroll_x,y:doc_scroll_y,w:w_find_items,h:doc_h,
						scr_x:(w_line_numbers+obj.padding)*UI.pixels_per_unit,scr_y:(find_item_i.visual_y-find_scroll_y-h_expand*0.5)*UI.pixels_per_unit, scale:UI.pixels_per_unit, obj:doc});
					var tick1=Duktape.__ui_get_tick()
					DrawLineNumbers(find_scroll_x,doc_scroll_y,
						doc.w,find_item_i.visual_y-find_scroll_y-h_expand*0.5,doc_h);
					var tick2=Duktape.__ui_get_tick()
					render_secs+=Duktape.__ui_seconds_between_ticks(tick0,tick1)
					ln_secs+=Duktape.__ui_seconds_between_ticks(tick1,tick2)
					DrawFindItemHighlight(find_item_i.visual_y-find_scroll_y-h_expand*0.5,doc_h,h_expand/h_expand_max)
				})
				//print(render_secs*1000,ln_secs*1000)
				UI.PopSubWindow()
			}else{
				//line numbers
				DrawLineNumbers(doc.visible_scroll_x,doc.visible_scroll_y,doc.w,doc.y,doc.h);
				//the top hint
				if(top_hint_bbs.length){
					var y_top_hint=y_top_hint_scroll;
					for(var bbi=0;bbi<top_hint_bbs.length;bbi+=2){
						var y0=top_hint_bbs[bbi]
						var y1=top_hint_bbs[bbi+1]
						var hh=Math.min(y1-y0,h_top_hint-y_top_hint)
						if(hh>=0){
							doc.ed.Render({x:0,y:y0,w:obj.w-w_line_numbers-w_scrolling_area,h:hh,
								scr_x:obj.x+w_line_numbers,scr_y:obj.y+y_top_hint, scale:UI.pixels_per_unit, obj:doc});
							//also draw the line numbers
							DrawLineNumbers(0,y0,1,obj.y+y_top_hint,y1-y0);
						}
						y_top_hint+=y1-y0;
					}
					UI.PushCliprect(obj.x,obj.y+h_top_hint,obj.w-w_scrolling_area,obj.h-h_top_hint)
					//a (shadowed) separation bar
					UI.RoundRect({
						x:obj.x-obj.top_hint_shadow_size, y:obj.y+h_top_hint-obj.top_hint_shadow_size, w:obj.w-w_scrolling_area+2*obj.top_hint_shadow_size, h:obj.top_hint_shadow_size*2,
						round:obj.top_hint_shadow_size,
						border_width:-obj.top_hint_shadow_size,
						color:obj.top_hint_shadow_color})
					UI.RoundRect({
						x:obj.x, y:obj.y+h_top_hint, w:obj.w-w_scrolling_area, h:obj.top_hint_border_width,
						color:obj.top_hint_border_color})
					UI.PopCliprect()
				}
			}
			if(obj.show_find_bar){
				//the find bar
				UI.PushCliprect(obj.x,obj.y,obj.w-w_scrolling_area,obj.h)
				UI.RoundRect({
					x:obj.x-obj.find_bar_shadow_size, y:obj.y+obj.h_find_bar-obj.find_bar_shadow_size, w:obj.w-w_scrolling_area+2*obj.find_bar_shadow_size, h:obj.find_bar_shadow_size*2,
					round:obj.find_bar_shadow_size,
					border_width:-obj.find_bar_shadow_size,
					color:obj.find_bar_shadow_color})
				UI.PopCliprect()
				UI.RoundRect({x:obj.x,y:obj.y,w:obj.w-w_scrolling_area,h:obj.h_find_bar,
					color:obj.find_bar_bgcolor})
				var rect_bar=UI.RoundRect({
					x:obj.x+obj.find_bar_padding,y:obj.y+obj.find_bar_padding,
					w:obj.w-w_scrolling_area-obj.find_bar_padding*2-(obj.find_bar_button_size+obj.find_bar_padding)*3,h:obj.h_find_bar-obj.find_bar_padding*2,
					color:obj.find_bar_color,
					round:obj.find_bar_round})
				UI.DrawChar(UI.icon_font_20,obj.x+obj.find_bar_padding*2,obj.y+(obj.h_find_bar-UI.GetCharacterHeight(UI.icon_font_20))*0.5,
					obj.find_bar_hint_color,'s'.charCodeAt(0))
				var x_button_right=rect_bar.x+rect_bar.w+obj.find_bar_padding
				W.Button("find_button_case",{style:UI.default_styles.check_button,
					x:x_button_right,y:rect_bar.y+(rect_bar.h-obj.find_bar_button_size)*0.5,w:obj.find_bar_button_size,h:obj.find_bar_button_size,
					font:UI.icon_font,text:"写",tooltip:"Case sensitive",
					value:(obj.find_flags&UI.SEARCH_FLAG_CASE_SENSITIVE?1:0),
					OnChange:function(value){
						obj.find_flags=(obj.find_flags&~UI.SEARCH_FLAG_CASE_SENSITIVE)|(value?UI.SEARCH_FLAG_CASE_SENSITIVE:0)
						obj.ResetFindingContext(obj.find_bar_edit.ed.GetText(),obj.find_flags)
					}})
				x_button_right+=obj.find_bar_padding+obj.find_bar_button_size;
				W.Button("find_button_word",{style:UI.default_styles.check_button,
					x:x_button_right,y:rect_bar.y+(rect_bar.h-obj.find_bar_button_size)*0.5,w:obj.find_bar_button_size,h:obj.find_bar_button_size,
					font:UI.icon_font,text:"字",tooltip:"Word wrap",
					value:(obj.find_flags&UI.SEARCH_FLAG_WHOLE_WORD?1:0),
					OnChange:function(value){
						obj.find_flags=(obj.find_flags&~UI.SEARCH_FLAG_WHOLE_WORD)|(value?UI.SEARCH_FLAG_WHOLE_WORD:0)
						obj.ResetFindingContext(obj.find_bar_edit.ed.GetText(),obj.find_flags)
					}})
				x_button_right+=obj.find_bar_padding+obj.find_bar_button_size;
				W.Button("find_button_regexp",{style:UI.default_styles.check_button,
					x:x_button_right,y:rect_bar.y+(rect_bar.h-obj.find_bar_button_size)*0.5,w:obj.find_bar_button_size,h:obj.find_bar_button_size,
					font:UI.icon_font,text:"正",tooltip:"Regular Expression",
					value:(obj.find_flags&UI.SEARCH_FLAG_REGEXP?1:0),
					OnChange:function(value){
						obj.find_flags=(obj.find_flags&~UI.SEARCH_FLAG_REGEXP)|(value?UI.SEARCH_FLAG_REGEXP:0)
						obj.ResetFindingContext(obj.find_bar_edit.ed.GetText(),obj.find_flags)
					}})
				var x_find_edit=obj.x+obj.find_bar_padding*3+UI.GetCharacterAdvance(UI.icon_font_20,'s'.charCodeAt(0));
				var w_find_edit=rect_bar.x+rect_bar.w-obj.find_bar_padding-x_find_edit;
				var previous_edit=obj.find_bar_edit
				W.Edit("find_bar_edit",{language:doc.language,style:obj.find_bar_editor_style,
					x:x_find_edit,w:w_find_edit,y:rect_bar.y,h:rect_bar.h,
					owner:obj,
					plugins:[ffindbar_plugin]
				},W.CodeEditor_prototype);
				if(!previous_edit){
					if(obj.m_current_needle){
						obj.find_bar_edit.ed.Edit([0,0,obj.m_current_needle],1)
						obj.find_bar_edit.sel0.ccnt=0
						obj.find_bar_edit.sel1.ccnt=obj.find_bar_edit.ed.GetTextSize()
						obj.ResetFindingContext(obj.find_bar_edit.ed.GetText(),obj.find_flags)
					}
					UI.SetFocus(obj.find_bar_edit);
					UI.InvalidateCurrentFrame();
					UI.Refresh()
				}else if(UI.nd_focus==doc){
					UI.SetFocus(obj.find_bar_edit);
					UI.InvalidateCurrentFrame();
					UI.Refresh()
				}
				if(!obj.find_bar_edit.ed.GetTextSize()){
					W.Text("",{x:x_find_edit+2,w:w_find_edit,y:rect_bar.y,h:rect_bar.h,
						font:obj.find_bar_hint_font,color:obj.find_bar_hint_color,
						text:"Search"})
				}
			}
			//minimap / scroll bar
			if(w_scrolling_area>0){
				var y_scrolling_area=obj.y
				var effective_scroll_y=doc.visible_scroll_y-h_top_hint
				var sbar_value=Math.max(Math.min(effective_scroll_y/(ytot-h_scrolling_area),1),0)
				if(obj.show_minimap){
					var x_minimap=obj.x+obj.w-w_scrolling_area+obj.padding*0.5
					var minimap_scale=obj.minimap_font_height/UI.GetFontHeight(editor_style.font)
					var h_minimap=h_scrolling_area/minimap_scale
					var scroll_y_minimap=sbar_value*Math.max(ytot-h_minimap,0)
					UI.PushSubWindow(x_minimap,y_scrolling_area,obj.w_minimap,h_scrolling_area,minimap_scale)
						doc.ed.Render({x:0,y:scroll_y_minimap,w:obj.w_minimap/minimap_scale,h:h_minimap,
							scr_x:0,scr_y:0, scale:UI.pixels_per_unit, obj:doc});
					UI.PopSubWindow()
					var minimap_page_y0=(effective_scroll_y-scroll_y_minimap)*minimap_scale
					var minimap_page_y1=(effective_scroll_y+h_scrolling_area-scroll_y_minimap)*minimap_scale
					UI.RoundRect({
						x:x_minimap-obj.padding*0.5, y:y_scrolling_area+minimap_page_y0, w:obj.w_minimap+obj.padding, h:minimap_page_y1-minimap_page_y0,
						color:obj.minimap_page_shadow})
					UI.RoundRect({
						x:x_minimap-obj.padding*0.5, y:y_scrolling_area+minimap_page_y0, w:obj.w_minimap+obj.padding, h:obj.minimap_page_border_width,
						color:obj.minimap_page_border_color})
					UI.RoundRect({
						x:x_minimap-obj.padding*0.5, y:y_scrolling_area+minimap_page_y1-obj.minimap_page_border_width, w:obj.w_minimap+obj.padding, h:obj.minimap_page_border_width,
						color:obj.minimap_page_border_color})
					if((minimap_page_y1-minimap_page_y0)<h_minimap){
						W.Region('minimap_page',{
							x:x_minimap-obj.padding*0.5, y:y_scrolling_area+minimap_page_y0, w:obj.w_minimap+obj.padding, h:minimap_page_y1-minimap_page_y0,
							value:sbar_value,
							factor:h_scrolling_area-(minimap_page_y1-minimap_page_y0),
							OnChange:function(value){
								doc.scroll_y=value*(ytot-h_scrolling_area)
								doc.scrolling_animation=undefined
								UI.Refresh()
							},
						},W.MinimapThingy_prototype)
					}
				}
				//scrollbar background
				var sbar=UI.RoundRect({x:obj.x+obj.w-obj.w_scroll_bar-4, y:y_scrolling_area, w:obj.w_scroll_bar+4, h:h_scrolling_area,
					color:obj.line_number_bgcolor
				})
				//at-scrollbar bookmark marker
				var hc_bookmark=UI.GetCharacterHeight(obj.bookmark_font)
				if(bm_ccnts.length){
					for(var i=0;i<bm_ccnts.length;i++){
						var y=Math.max(Math.min(bm_xys[i*2+1]/(ytot-h_scrolling_area),1),0)*sbar.h+sbar.y
						var id=bm_ccnts[i][0]
						UI.RoundRect({
							x:sbar.x, w:sbar.w,
							y:y-obj.bookmark_scroll_bar_marker_size*0.5,h:obj.bookmark_scroll_bar_marker_size,
							color:obj.bookmark_text_color})
						if(id>=0){
							UI.DrawChar(obj.bookmark_font,sbar.x+2,
								y-sbar.y>hc_bookmark?y-obj.bookmark_scroll_bar_marker_size*0.5-hc_bookmark:y+obj.bookmark_scroll_bar_marker_size*0.5,
								obj.bookmark_text_color,48+id)
						}
					}
				}
				//the actual bar
				W.ScrollBar("sbar",{x:obj.x+obj.w-obj.w_scroll_bar-4, y:y_scrolling_area+4, w:obj.w_scroll_bar, h:h_scrolling_area-8, dimension:'y',
					page_size:h_scrolling_area, total_size:ytot, value:sbar_value,
					OnChange:function(value){
						doc.scroll_y=value*(this.total_size-this.page_size)
						doc.scrolling_animation=undefined
						UI.Refresh()
					},
					style:obj.scroll_bar_style
				})
				//separators
				UI.RoundRect({
					x:obj.x+obj.w-w_scrolling_area, y:y_scrolling_area, w:1, h:h_scrolling_area,
					color:obj.separator_color})
			}
			//UI.RoundRect({
			//	x:obj.x+w_line_numbers-1, y:obj.y, w:1, h:obj.h,
			//	color:obj.separator_color})
			if(UI.HasFocus(doc)){
				var menu_search=UI.BigMenu("&Search")
				menu_search.AddNormalItem({text:"&Find or replace",enable_hotkey:1,key:"CTRL+F",action:function(){
					var sel=obj.doc.GetSelection()
					obj.show_find_bar=1
					obj.m_sel0_before_find=obj.doc.sel0.ccnt
					obj.m_sel1_before_find=obj.doc.sel1.ccnt
					if(sel[0]<sel[1]){
						obj.m_current_needle=obj.doc.ed.GetText(sel[0],sel[1]-sel[0])
					}
					//if(obj.m_current_find_context){
					//	obj.ResetFindingContext(obj.doc.sel1.ccnt,obj.m_current_find_context.m_needle,obj.find_flags)
					//}
					UI.Refresh()
				}})
				menu_search.AddButtonRow({text:"Find "},[
					{key:"CTRL+G F3",text:"&previous",action:function(){
						//todo
					}},{key:"SHIFT+CTRL+G SHIFT+F3",text:"&next",action:function(){
						//todo
					}}])
			}
		}
	UI.End()
	return obj
}

UI.NewCodeEditorTab=function(fname0){
	var file_name=fname0||IO.GetNewDocumentName("new","txt","document")
	return UI.NewTab({
		file_name:file_name,
		title:UI.RemovePath(file_name),
		body:function(){
			//use styling for editor themes
			//todo: load a style object from some user-defined file
			UI.context_parent.body=this.doc;
			var body=W.CodeEditor("body",{
				'anchor':'parent','anchor_align':"fill",'anchor_valign':"fill",
				'x':0,'y':0,
				'file_name':this.file_name,
			})
			if(!this.doc){
				this.doc=body;
			}
			var doc=body.doc;
			body.title=UI.RemovePath(this.file_name)
			this.need_save=0
			if((doc.saved_point||0)<doc.ed.GetUndoQueueLength()){
				body.title=body.title+'*'
				this.need_save=1
			}
			return body;
		},
		Save:function(){
			this.doc.Save();
			var doc=this.doc.doc;
			this.need_save=0
			if((doc.saved_point||0)<doc.ed.GetUndoQueueLength()){
				this.need_save=1
			}
		},
		SaveMetaData:function(){
			this.doc.SaveMetaData();
		},
		property_windows:[],
		color_theme:[0xffb4771f],
	})
};

UI.RegisterLoaderForExtension("*",function(fname){return UI.NewCodeEditorTab(fname)})
