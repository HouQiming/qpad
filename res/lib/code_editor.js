var UI=require("gui2d/ui");
var W=require("gui2d/widgets");
require("res/lib/boxdoc");
var Language=require("res/lib/langdef");

//todo: smartification - make rubber controls auto-resize when faced with dimension changes
//rubber-control > space
//or scale-to-fit-some-edge

function parent(){return UI.context_parent;}

var g_sandbox=UI.CreateSandbox();
g_sandbox.ReadBack=function(s){return JSON.parse(g_sandbox._ReadBack("JSON.stringify("+s+")"))}
g_sandbox.eval("var UI=require('gui2d/ui');var W=require('gui2d/widgets');require('res/lib/inmate');")
//xywh: relative mode?
g_sandbox.m_relative_scaling=1;//0.5;
var g_params={padding:12};
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
		g_sandbox.eval(ed.GetText());
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

W.subwindow_insertion_bar={
	'title':'Insert widgets',h:500,
	body:function(){
		var obj_temp=W.Text("-",{anchor:'parent',anchor_align:'left',anchor_valign:'top',x:8,y:32,
			font:UI.Font("res/fonts/opensans.ttf",24),color:0xff000000,text:"Zoom"})
		obj_temp=W.Slider("zoom",{anchor:obj_temp,anchor_placement:'right',anchor_valign:'center',x:8,y:0,w:180,h:24,h_slider:8,property_name:'scale'})
		W.Text("-",{anchor:obj_temp,anchor_placement:'right',anchor_valign:'center',x:8,y:0,
			font:UI.Font("res/fonts/opensans.ttf",24),color:0xff000000,
			text:(g_sandbox.m_relative_scaling*100).toFixed(0)+"%"})
		obj_temp=W.Text("-",{anchor:'parent',anchor_align:'left',anchor_valign:'top',x:8,y:64,
			font:UI.Font("res/fonts/opensans.ttf",24),color:0xff000000,text:"Padding"})
		W.EditBox("padding_editor",{anchor:obj_temp,anchor_placement:'right',anchor_valign:'center',x:8,y:0,w:32,h:28,
			property_name:'padding'})
		W.Group("layout",{
			anchor:'parent',anchor_align:'fill',anchor_valign:'top',
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
UI.NewUIEditorDocument=function(fname0){
	var s_data=(IO.ReadAll(fname0)||g_template_code);
	return {
		file_name:(fname0||IO.GetNewDocumentName("ui","js","document")),
		body:function(){
			var body=W.UIEditor("body",{
				'anchor':'parent','anchor_align':"fill",'anchor_valign':"fill",
				'x':0,'y':0,
				'file_name':this.file_name,
				'bgcolor':0xfff0f0f0,
			})
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
			return body;
		},
		property_windows:[
			W.subwindow_insertion_bar
		],
		color_theme:[0xff5511aa],
	}
};
LOADER.RegisterLoaderForExtension("js",function(fn){UI.NewTab(UI.NewUIEditorDocument(fn))})

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
			color_string:0xff0055aa,
			color_comment:0xff008000,
			///////////////
			OnSelectionChange:function(){
				var code_box=obj.doc;
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
		//todo: scrolling / clipping - use a transformation hack and a smaller viewport
		UI.GLWidget(function(){
			//var tick0=Duktape.__ui_get_tick();
			//todo: scrolling
			g_sandbox.DrawSandboxScreen(obj.x+8,obj.y+8,w_sandbox_area,obj.h-16,0,0);
			//print("g_sandbox.DrawWindow",Duktape.__ui_seconds_between_ticks(tick0,Duktape.__ui_get_tick())*1000,"ms");
		})
		//create the boxes
		if(code_box.document_items){
			var items=code_box.document_items;
			var snapping_coords={'x':[],'y':[],'tolerance':4}
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
