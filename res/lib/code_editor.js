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
		lang.SetExclusive([bid_comment,bid_comment2,bid_string,bid_string2]);
		if(lang.isInside(bid_comment)||lang.isInside(bid_comment2)||lang.isInside(bid_string)||lang.isInside(bid_string2)){
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
		var floadNext=function(){
			ed.hfile_loading=UI.EDLoader_Read(ed,ed.hfile_loading)
			if(ed.hfile_loading){
				UI.NextTick(floadNext);
			}else{
				this.OnLoad()
			}
			UI.Refresh()
		}
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

W.CodeEditorWidget_prototype={
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
	}
}

W.CodeEditor=function(id,attrs){
	var obj=UI.StdWidget(id,attrs,"code_editor",W.CodeEditorWidget_prototype);
	UI.Begin(obj)
		//main code area
		var doc=obj.doc
		var prev_h_top_hint=(obj.h_top_hint||0),h_top_hint=0,w_line_numbers=0,y_top_hint_scroll=0;
		var editor_style=UI.default_styles.code_editor.editor_style
		var top_hint_bbs=[]
		if(doc){
			//top hint in a separate area
			if(obj.show_top_hint){
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
			}
			if(Math.abs(h_top_hint-prev_h_top_hint)>4){
				h_top_hint=(h_top_hint*0.5+prev_h_top_hint*0.5);
				UI.Refresh()
			}
			obj.h_top_hint=h_top_hint
			if(h_top_hint-prev_h_top_hint){
				doc.scroll_y+=h_top_hint-prev_h_top_hint
				doc.h=obj.h-h_top_hint
				doc.AutoScroll("show")
			}
			//current line highlight
			if(!doc.cur_line_hl){
				doc.cur_line_p0=doc.ed.CreateLocator(0,-1);doc.cur_line_p0.undo_tracked=0;
				doc.cur_line_p1=doc.ed.CreateLocator(0,-1);doc.cur_line_p1.undo_tracked=0;
				doc.cur_line_hl=doc.ed.CreateHighlight(doc.cur_line_p0,doc.cur_line_p1);
				doc.cur_line_hl.color=obj.color_cur_line_highlight;
				doc.cur_line_hl.invertible=0;
			}
			var line_current=doc.GetLC(doc.sel1.ccnt)[0]
			var line_ccnts=doc.SeekAllLinesBetween(line_current,line_current+2)
			doc.cur_line_p0.ccnt=line_ccnts[0];
			doc.cur_line_p1.ccnt=line_ccnts[1];
		}
		//hopefully 8 is the widest char
		if(obj.show_line_numbers){
			var lmax=(doc?doc.GetLC(doc.ed.GetTextSize())[0]:0)+1
			w_line_numbers=lmax.toString().length*UI.GetCharacterAdvance(obj.line_number_font,56);
		}
		var w_bookmark=UI.GetCharacterAdvance(obj.bookmark_font,56)+4
		w_line_numbers+=obj.padding+w_bookmark;
		UI.RoundRect({color:obj.line_number_bgcolor,x:obj.x,y:obj.y,w:w_line_numbers,h:obj.h})
		UI.RoundRect({color:obj.bgcolor,x:obj.x+w_line_numbers,y:obj.y,w:obj.w-w_line_numbers,h:obj.h})
		if(doc&&doc.ed.saving_context){
			//todo: draw a progress bar with no interaction
			obj.__children.push(doc)
		}else{
			W.Edit("doc",{
				///////////////
				language:g_language_C,//todo
				style:editor_style,
				///////////////
				x:obj.x+w_line_numbers+obj.padding,y:obj.y+h_top_hint,w:obj.w-w_line_numbers-obj.padding,h:obj.h-h_top_hint,
			},W.CodeEditor_prototype);
			if(!doc){
				//initiate progressive loading
				doc=obj.doc
				doc.OnLoad=obj.OnLoad.bind(obj)
				doc.StartLoading(obj.file_name)
			}
			//bookmarks - they appear under line numbers
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
			if(bm_ccnts.length){
				bm_ccnts.sort(function(a,b){return (a[1]*10+a[0])-(b[1]*10+b[0]);});
				var bm_xys=doc.ed.GetXYEnMasse(bm_ccnts.map(function(a){return a[1]}))
				var hc=UI.GetCharacterHeight(doc.font)
				//var bookmark_fnt_scale=2;
				//var bookmark_fnt=UI.Font('res/fonts/iconfnt.ttf,!',UI.GetCharacterHeight(obj.line_number_font)*bookmark_fnt_scale)
				//var dy_bookmark=(UI.GetCharacterHeight(doc.font)-UI.GetCharacterHeight(bookmark_fnt))*0.5
				//var x_bookmark=w_line_numbers-UI.GetCharacterAdvance(bookmark_fnt,'b'.charCodeAt(0))
				UI.PushCliprect(obj.x,obj.y+h_top_hint,obj.w,obj.h-h_top_hint)
				for(var i=0;i<bm_ccnts.length;i++){
					var y=bm_xys[i*2+1]-doc.scroll_y+doc.y
					var id=bm_ccnts[i][0]
					//UI.DrawChar(bookmark_fnt,x_bookmark,y+dy_bookmark,obj.bookmark_color,'b'.charCodeAt(0))
					//UI.RoundRect({x:0,y:y+4,w:w_line_numbers,h:hc-4,
					//	color:obj.bookmark_shadow,
					//	border_width:-6,
					//	round:6})
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
				//put under an arrow could be more consistent with the scroll bar thingy 'b'
				//todo: at-scrollbar, potentially numbered marks
			}
			//line numbers
			var rendering_ccnt0=doc.SeekXY(doc.scroll_x,doc.scroll_y)
			var rendering_ccnt1=doc.SeekXY(doc.scroll_x+doc.w,doc.scroll_y+doc.h)
			if(obj.show_line_numbers){
				var dy_line_number=(UI.GetCharacterHeight(doc.font)-UI.GetCharacterHeight(obj.line_number_font))*0.5;
				var line0=doc.GetLC(rendering_ccnt0)[0];
				var line1=doc.GetLC(rendering_ccnt1)[0];
				var line_current=doc.GetLC(doc.sel1.ccnt)[0]
				var line_ccnts=doc.SeekAllLinesBetween(line0,line1+1);
				var line_xys=doc.ed.GetXYEnMasse(line_ccnts)
				UI.PushCliprect(obj.x,obj.y+h_top_hint,obj.w,obj.h-h_top_hint)
				for(var i=0;i<line_ccnts.length;i++){
					if(i&&line_ccnts[i]==line_ccnts[i-1]){break;}
					var s_line_number=(line0+i+1).toString();
					var y=line_xys[i*2+1]-doc.scroll_y+dy_line_number+h_top_hint
					var text_dim=UI.MeasureText(obj.line_number_font,s_line_number)
					var x=w_line_numbers-text_dim.w-obj.padding
					W.Text("",{x:obj.x+x,y:obj.y+y, font:obj.line_number_font,text:s_line_number,color:line0+i==line_current?obj.line_number_color_focus:obj.line_number_color})
				}
				UI.PopCliprect()
			}
			//the top hint
			if(top_hint_bbs.length){
				var y_top_hint=y_top_hint_scroll;
				for(var bbi=0;bbi<top_hint_bbs.length;bbi+=2){
					var y0=top_hint_bbs[bbi]
					var y1=top_hint_bbs[bbi+1]
					var hh=Math.min(y1-y0,h_top_hint-y_top_hint)
					if(hh>=0){
						doc.ed.Render({x:0,y:y0,w:obj.w-w_line_numbers,h:hh,
							scr_x:obj.x+w_line_numbers,scr_y:obj.y+y_top_hint, scale:1, obj:doc});
						//also draw the line numbers
						if(obj.show_line_numbers){
							var rendering_ccnt0=doc.SeekXY(0,y0)
							var rendering_ccnt1=doc.SeekXY(1,y1)
							var dy_line_number=(UI.GetCharacterHeight(doc.font)-UI.GetCharacterHeight(obj.line_number_font))*0.5;
							var line0=doc.GetLC(rendering_ccnt0)[0];
							var line1=doc.GetLC(rendering_ccnt1)[0];
							var line_current=doc.GetLC(doc.sel1.ccnt)[0]
							var line_ccnts=doc.SeekAllLinesBetween(line0,line1+1);
							var line_xys=doc.ed.GetXYEnMasse(line_ccnts)
							UI.PushCliprect(obj.x,obj.y+y_top_hint,obj.w,hh)
							for(var i=0;i<line_ccnts.length;i++){
								if(i&&line_ccnts[i]==line_ccnts[i-1]){break;}
								var s_line_number=(line0+i+1).toString();
								var y=line_xys[i*2+1]-y0+dy_line_number+y_top_hint
								var text_dim=UI.MeasureText(obj.line_number_font,s_line_number)
								var x=w_line_numbers-text_dim.w-obj.padding
								W.Text("",{x:obj.x+x,y:obj.y+y, font:obj.line_number_font,text:s_line_number,color:line0+i==line_current?obj.line_number_color_focus:obj.line_number_color})
							}
							UI.PopCliprect()
						}
					}
					y_top_hint+=y1-y0;
				}
				UI.PushCliprect(obj.x,obj.y+h_top_hint,obj.w,obj.h-h_top_hint)
				//a (shadowed) separation bar
				UI.RoundRect({
					x:obj.x-obj.top_hint_shadow_size, y:obj.y+h_top_hint-obj.top_hint_shadow_size, w:obj.w+2*obj.top_hint_shadow_size, h:obj.top_hint_shadow_size*2,
					round:obj.top_hint_shadow_size,
					border_width:-obj.top_hint_shadow_size,
					color:obj.top_hint_shadow_color})
				UI.RoundRect({
					x:obj.x, y:obj.y+h_top_hint, w:obj.w, h:obj.top_hint_border_width,
					color:obj.top_hint_border_color})
				UI.PopCliprect()
			}
			//minimap / scroll bar
			//todo
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
			//todo: load a style object
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
