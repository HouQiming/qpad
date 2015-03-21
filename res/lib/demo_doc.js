var UI=require("gui2d/ui");
var W=require("gui2d/widgets");
require("res/lib/boxdoc");
require("res/lib/global_doc");

/*editor: UI.Theme_Minimalistic([0xff2858d6])//*/
/*editor: UI.icon_font=UI.Font('res/fonts/iconfnt.ttf,!',24);//*/

/*
array of {x,y,w,h, obj_id}
	x,y,w,h for current frame
		needed for keying anyway
	add keyframe transforms later
group: a page-in-page
*/
var DemoPage_prototype=UI.CreateJSONObjectClass({
	default_extension:"demo_page",
	enable_compression:1,
	active_drag_insertion:undefined,
	Init:function(){
		UI.JSONObject_prototype.Init.call(this)
		var data=this.m_data
		data.body=[];
		data.page_w=1440;
		data.page_h=1080;
		data.bgcolor=0xffffffff
	},
	GetReferences:function(){
		var objects=[];
		var body=this.m_data.body;
		var n=body.length;
		for(var i=0;i<n;i++){
			objects.push(body[i].obj_id)
		}
		return objects;
	},
	SetReferences:function(mapping){
		var body=this.m_data.body;
		var n=body.length;
		for(var i=0;i<n;i++){
			body[i].obj_id=mapping[body[i].obj_id]
		}
	},
	DragInsert:function(action,w,h,fix_aspect){
		//just an overlaid region
		this.active_drag_insertion={
			action:action,
			w_intrinsic:w,h_intrinsic:h,
			aspect_intrinsic:fix_aspect?w/h:undefined,
			gdoc:this.m_global_document,
		}
		UI.Refresh()
	},
	InsertImage:function(){
		var img_name=UI.PickImage();
		if(!img_name){return;}
		var s_data=IO.ReadAll(img_name)
		if(!s_data){return;}//todo: show error notification
		var obj_img=UI.CreateEmbeddedImageFromFileData(s_data);
		if(!obj_img){return;}//todo: show error notification
		this.DragInsert(function(w,h){
			return obj_img
		},obj_img.w,obj_img.h,1)
	},
	InsertTextBox:function(){
		var gdoc=this.m_global_document
		this.DragInsert(function(w,h){
			return UI.NewTxtxEditor(w,gdoc)
		},200,32)
	},
	AsWidget:function(id,attrs){
		UI.context_parent[id]=this
		UI.Begin(UI.Keep(id,attrs))
		var body=this.m_data.body;
		var n=body.length;
		UI.RoundRect({x:attrs.x,y:attrs.y,w:attrs.w,h:attrs.h,color:this.bgcolor})
		var fanchortransform=UI.HackCallback(function(){
			var real_obj=body[this.numerical_id];
			this.my_anchor_x=real_obj.x;
			this.my_anchor_y=real_obj.y;
			this.my_anchor_w=real_obj.w;
			this.my_anchor_h=real_obj.h;
		})
		var fonchange=UI.HackCallback(function(tr){
			var real_obj=body[this.numerical_id];
			real_obj.w=this.my_anchor_w*(tr.scale?tr.scale[0]:1);
			real_obj.h=this.my_anchor_h*(tr.scale?tr.scale[1]:1);
			real_obj.x=this.my_anchor_x+(tr.translation?tr.translation[0]:0);
			real_obj.y=this.my_anchor_y+(tr.translation?tr.translation[1]:0);
			if(tr.scale){
				real_obj.x+=tr.relative_anchor[0]*this.my_anchor_w;
				real_obj.y+=tr.relative_anchor[1]*this.my_anchor_h;
				real_obj.x-=tr.relative_anchor[0]*real_obj.w;
				real_obj.y-=tr.relative_anchor[1]*real_obj.h;
			}
			UI.Refresh()
		})
		var obj_prev;
		if(!attrs.read_only){
			obj_prev=this.pboxdoc
		}
		var items=[]
		var gdoc=this.m_global_document
		for(var i=0;i<body.length;i++){
			var item_i=body[i];
			var obj_i={x:attrs.x+item_i.x,y:attrs.y+item_i.y,w:item_i.w,h:item_i.h, numerical_id:i}
			var obj_real=gdoc.GetObject(item_i.obj_id)
			var id_i="$"+i
			obj_i.read_only=(attrs.read_only||0)
			if(obj_prev&&obj_prev.group.selection&&!obj_prev.group.selection[id_i]){
				obj_i.read_only=1
			}
			//todo: arbitrary transformation
			UI.EmbedObjectAndPostponeRegions(id_i,obj_i,obj_real,obj_prev)
			obj_i.AnchorTransform=fanchortransform;
			obj_i.SetTransform=fonchange;
			items.push(obj_i)
		}
		if(!attrs.read_only){
			var sel={}
			if(obj_prev){sel=(obj_prev.group.selection||sel);}
			var snapping_coords={'x':[],'y':[],'tolerance':UI.IS_MOBILE?8:4}
			for(var i=0;i<items.length;i++){
				var item_i=items[i];
				if(sel[item_i.id]){
					//avoid self-snapping
					continue;
				}
				snapping_coords.x.push(UI.SNAP_LEFT,item_i.x);
				snapping_coords.x.push(UI.SNAP_CENTER,item_i.x+item_i.w*0.5);
				snapping_coords.x.push(UI.SNAP_RIGHT,item_i.x+item_i.w);
				snapping_coords.y.push(UI.SNAP_LEFT,item_i.y);
				snapping_coords.y.push(UI.SNAP_CENTER,item_i.y+item_i.h*0.5);
				snapping_coords.y.push(UI.SNAP_RIGHT,item_i.y+item_i.h);
			}
			W.BoxDocument("pboxdoc",{
				'x':attrs.x,'y':attrs.y,'w':attrs.w,'h':attrs.h,
				'items':items,
				'snapping_coords':snapping_coords,
			})
			var sheet=UI.document_property_sheet;
			sheet.insert_image=[0,this.InsertImage.bind(this)]
			sheet.insert_text=[0,this.InsertTextBox.bind(this)]
		}
		UI.End()
		this.__children=[]
		return this
	}
});

var ActiveInsertion_prototype={
	//todo: snapping, shift, ...
	min_dragging_initiation:8,
	OnMouseDown:function(event){
		this.drag_x_base=event.x
		this.drag_y_base=event.y
		this.drag_x1=event.x
		this.drag_y1=event.y
		this.is_dragging=1
		UI.Refresh()
	},
	OnMouseMove:function(event){
		if(!this.is_dragging){return;}
		var dx=event.x-this.drag_x_base;
		var dy=event.y-this.drag_y_base;
		if(!this.drag_initiated&&(Math.abs(dx)>this.min_dragging_initiation||Math.abs(dy)>this.min_dragging_initiation)){
			this.drag_initiated=1;
		}
		this.drag_x1=event.x
		this.drag_y1=event.y
		if(!this.drag_initiated){
			this.drag_x1=this.drag_x_base
			this.drag_y1=this.drag_y_base
		}else{
			if(this.desc.aspect_intrinsic){
				var w_max=Math.max(Math.abs(dx),Math.abs(dy)*this.desc.aspect_intrinsic)
				var h_max=w_max/this.desc.aspect_intrinsic;
				this.drag_x1=this.drag_x_base+(dx<0?-w_max:w_max)
				this.drag_y1=this.drag_y_base+(dy<0?-h_max:h_max)
			}
		}
		UI.Refresh()
	},
	OnMouseUp:function(){
		if(!this.is_dragging){return;}
		var desc=this.desc
		var x=this.drag_x_base,w=this.drag_x1-x;if(w<0){x+=w;w=-w;}
		var y=this.drag_y_base,h=this.drag_y1-y;if(h<0){y+=h;h=-h;}
		x-=this.x;
		y-=this.y;
		x/=this.scale;
		y/=this.scale;
		w/=this.scale;
		h/=this.scale;
		//insert in the original size if tiny
		if(!w){w=desc.w_intrinsic}
		if(!h){h=desc.h_intrinsic}
		var obj=desc.action(w,h)
		var obj_id=desc.gdoc.AddObject(obj)
		var body=this.cur_page.m_data.body
		body.push({x:x,y:y,w:w,h:h,obj_id:obj_id})
		var pboxdoc=this.parent.cur_tab.pboxdoc
		if(pboxdoc){
			var sel={}
			sel["$"+(body.length-1).toString()]=1
			pboxdoc.group.selection=sel;
		}
		//remove the temp dragging UI
		this.cur_page.active_drag_insertion=undefined
		this.cur_page=undefined
		UI.Refresh()
	},
	Render:function(){
		var x=this.drag_x_base,w=this.drag_x1-x;if(w<0){x+=w;w=-w;}
		var y=this.drag_y_base,h=this.drag_y1-y;if(h<0){y+=h;h=-h;}
		//todo: mouse cursor and insertion indication
		var pboxdoc=this.parent.cur_tab.pboxdoc
		if(w&&h){
			UI.RoundRect({x:x,y:y,w:w,h:h,
				border_color:pboxdoc.border_color&0xff000000,border_width:pboxdoc.border_width,
				color:(pboxdoc.color>>1)&0xff000000})
		}
	},
};
var DemoDocument_prototype=UI.CreateJSONObjectClass({
	default_extension:"demo_doc",
	enable_compression:1,
	Init:function(){
		UI.JSONObject_prototype.Init.call(this)
		var data=this.m_data
		data.pages=[];
		data.aspect_ratio=3/2;
	},
	GetReferences:function(){
		return this.m_data.pages;
	},
	SetReferences:function(mapping){
		var pages=this.m_data.pages;
		for(var i=0;i<pages.length;i++){
			pages[i]=mapping[pages[i]]
		}
	},
	AsWidget:function(id,attrs){
		UI.context_parent[id]=this
		var obj=UI.StdWidget(id,attrs,"demo_document")
		var x_main_ui,w_main_ui,h_main_ui
		UI.Begin(obj)
		//todo: zoom bar
		//the page scrolling area
		var pages=this.m_data.pages;
		var page_list
		var n=pages.length;
		var thumbnail_style=obj.thumbnail_style;
		var list_items=[]
		var gdoc=this.m_global_document
		var obj_template={object_type:function(id,attrs){
			var obj=UI.Keep(id,attrs)
			UI.StdAnchoring(id,obj)
			var page_i=gdoc.GetObject(pages[this.numerical_id])
			var page_w=page_i.m_data.page_w
			var page_h=page_i.m_data.page_h
			var w_i=w_thumbnail,scale=w_i/page_w,h_i=scale*page_h
			var new_subwin=UI.PushSubWindow(obj.x,obj.y,w_i,h_i,scale)
			if(new_subwin[2]||new_subwin[3]){
				page_i.AsWidget("",{x:0,y:0,w:page_w,h:page_h,read_only:1})
			}
			UI.PopSubWindow()
			//////////
			if(obj.selected){
				UI.RoundRect({x:obj.x,y:obj.y,w:w_i,h:h_i,
					color:0,border_color:thumbnail_style.sel_border_color,border_width:thumbnail_style.sel_border_width})
			}else{
				UI.RoundRect({x:obj.x,y:obj.y,w:w_i,h:h_i,
					color:0,border_color:thumbnail_style.border_color,border_width:thumbnail_style.border_width})
			}
			var s_i=(this.numerical_id+1).toString();
			W.Text("",{
				anchor_placement:'absolute',
				text:s_i,
				font:thumbnail_style.font,color:obj.selected?thumbnail_style.sel_text_color:thumbnail_style.text_color,
				x:obj.x-UI.MeasureIconText({font:thumbnail_style.font,text:s_i}).w-thumbnail_style.text_padding,y:obj.y})
			return attrs
		}}
		var fnewpage=function(){
			var new_page=Object.create(DemoPage_prototype)
			new_page.Init()
			obj.m_data.pages.push(gdoc.AddObject(new_page))
			UI.Refresh()
		}
		var thumbnail_margin;
		var current_page_id=(UI.GetMetaData(this).current_page||0)
		if(obj.w<obj.h){
			//phone layout
			var h_thumbnail=(3/32)*obj.h
			thumbnail_margin=h_thumbnail*(3/32);
			for(var i=0;i<n;i++){
				var page_i=gdoc.GetObject(pages[this.numerical_id])
				var page_w=page_i.m_data.page_w
				var page_h=page_i.m_data.page_h
				var h_i=h_thumbnail,scale=h_i/page_h,w_i=scale*page_w
				list_items.push({x:thumbnail_margin,w:w_i,h:h_i,numerical_id:i})
			}
			var h_i=h_thumbnail,w_i=w_thumbnail*this.m_data.aspect_ratio
			list_items.push({
				object_type:W.Button,
				x:0,y:0,w:w_i,h:h_i,
				style:obj.new_page_button_style,
				no_click_selection:1,
				text:"+",
				OnClick:fnewpage
			})
			page_list=W.ListView("page_list",{
				anchor:'parent',anchor_valign:'down',anchor_align:'fill',
				x:0,y:0,h:h_thumbnail+thumbnail_margin,
				value:current_page_id,OnChange:function(value){
					obj.current_page=value
					UI.Refresh()
				},
				layout_spacing:thumbnail_margin*2,layout_align:'right',layout_valign:'up',
				items:list_items,
				item_template:obj_template,
			})
			x_main_ui=0
			w_main_ui=obj.w-thumbnail_margin*2
			h_main_ui=obj.h-h_thumbnail-thumbnail_margin*2
		}else{
			//PC layout
			var w_thumbnail=(3/32)*obj.w
			thumbnail_margin=w_thumbnail*(3/32);
			for(var i=0;i<n;i++){
				var page_i=gdoc.GetObject(pages[this.numerical_id])
				var page_w=page_i.m_data.page_w
				var page_h=page_i.m_data.page_h
				var w_i=w_thumbnail,scale=w_i/page_w,h_i=scale*page_h
				list_items.push({x:thumbnail_margin,w:w_i,h:h_i,numerical_id:i})
			}
			//new page area
			var w_i=w_thumbnail,h_i=w_thumbnail/this.m_data.aspect_ratio
			list_items.push({
				object_type:W.Button,
				x:thumbnail_margin,y:0,w:w_i,h:h_i,
				style:obj.new_page_button_style,
				no_click_selection:1,
				text:"+",
				OnClick:fnewpage
			})
			page_list=W.ListView("page_list",{
				x:0,y:0,w:w_thumbnail+thumbnail_margin*3,h:obj.h,
				value:current_page_id,OnChange:function(value){
					obj.current_page=value
					UI.Refresh()
				},
				layout_spacing:thumbnail_margin,layout_align:'right',layout_valign:'up',
				items:list_items,
				item_template:obj_template,
			})
			x_main_ui=w_thumbnail+thumbnail_margin*4
			w_main_ui=obj.w-x_main_ui-thumbnail_margin*2
			h_main_ui=obj.h-thumbnail_margin*2
		}
		var cur_page=gdoc.GetObject(pages[current_page_id])
		//last_current_page is not even metadata - it's purely transient
		if(current_page_id!=this.last_current_page){
			this.last_current_page=current_page_id
			obj.cur_tab=undefined;
		}
		if(cur_page){
			var cpage_w=cur_page.m_data.page_w
			var cpage_h=cur_page.m_data.page_h
			var scale=Math.min(w_main_ui/cpage_w,h_main_ui/cpage_h)
			x_main_ui+=Math.max((obj.w-x_main_ui-thumbnail_margin*2-cpage_w*scale)*0.5,0)
			UI.PushSubWindow(x_main_ui,thumbnail_margin,w_main_ui,h_main_ui,scale)
			cur_page.AsWidget("cur_tab",{x:0,y:0,w:cpage_w,h:cpage_h})
			UI.PopSubWindow()
			UI.RoundRect({x:x_main_ui,y:thumbnail_margin,w:cpage_w*scale,h:cpage_h*scale,
				color:0,border_color:thumbnail_style.border_color,border_width:thumbnail_style.border_width})
			//the active insertion
			if(cur_page.active_drag_insertion){
				var active_ins=W.Region("active_ins",{
					x:x_main_ui,y:thumbnail_margin,w:w_main_ui,h:h_main_ui,
					scale:scale,
					desc:cur_page.active_drag_insertion,
					cur_page:cur_page,
					parent:obj},ActiveInsertion_prototype)
				active_ins.Render()
			}
		}
		UI.End()
		return obj
	},
	/////////////////////
	OpenAsTab:function(){
		var gdoc=this.m_global_document
		return UI.NewTab({
			file_name:gdoc.m_file_name,
			gdoc:gdoc,
			body:function(){
				var body=this.gdoc.GetObject(1).AsWidget("body",{
					'anchor':'parent','anchor_align':"fill",'anchor_valign':"fill",
					'x':0,'y':0,
					'file_name':this.m_file_name})
				return body;
			},
			title:UI.GetMainFileName(gdoc.m_file_name),
			property_windows:[
				W.subwindow_insert_stuff,
				W.subwindow_text_properties
			],
			color_theme:[0xffb4771f],
		})
	}
});

W.subwindow_insert_stuff={
	'title':'Insert',h:72,
};
W.subwindow_insert_stuff.body=function(id,attrs){
	/*editor: UI.BeginVirtualWindow(id,{w:300,h:48,bgcolor:0xffffffff})//*/
	//put VG creation in the image program?
	/*widget*/(W.Button('insert_image',{
		'x':7.020378442417041,'y':31,'w':32,'h':32,
		style:UI.default_styles.tool_button,font:UI.icon_font,text:'M',
		property_name:"insert_image"}));
	/*widget*/(W.Button('insert_text',{
		'x':39.02037844241704,'y':31,'w':32,'h':32,
		style:UI.default_styles.tool_button,font:UI.icon_font,text:'T',
		property_name:"insert_text"}));
	/*widget*/(W.Button('insert_sym',{
		'x':71.02037844241704,'y':31,'w':32,'h':32,
		style:UI.default_styles.tool_button,font:UI.Font("res/fonts/cmunss.ttf,!",24,100),text:'\u03A3',
		property_name:"insert_sym"}));
	/*widget*/(W.Button('insert_video',{
		'x':103.02037844241704,'y':31,'w':32,'h':32,
		style:UI.default_styles.tool_button,font:UI.icon_font,text:'V',
		property_name:"insert_video"}));
	//todo: sound
	/*insert here*/
	/*editor: UI.EndVirtualWindow()//*/
}
