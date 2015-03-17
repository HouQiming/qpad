 var UI=require("gui2d/ui");
var W=require("gui2d/widgets");
var LOADER=require("res/lib/objloader");
require("res/lib/boxdoc");

/*editor: UI.Theme_Minimalistic([0xff2858d6])//*/
/*editor: UI.icon_font=UI.Font('res/fonts/iconfnt.ttf,!',24);//*/

/*
array of {x,y,w,h, obj}
	x,y,w,h for current frame
		needed for keying anyway
	add keyframe transforms later
group: a page-in-page
*/
var DemoPage_prototype={
	default_extension:"demo_page",
	enable_compression:1,
	page_w:1440,page_h:1080,bgcolor:0xffffffff,
	Init:function(){
		this.body=[];
	},
	GetReferences:function(){
		var objects=[];
		var body=this.body;
		var n=body.length;
		for(var i=0;i<n;i++){
			objects.push(body[i])
		}
		return objects;
	},
	Save:function(){
		var body=this.body;
		var n=body.length;
		var pod_body=[];
		for(var i=0;i<n;i++){
			var pod_clone_i={};
			var item_i=body[i];
			for(var key in item_i){
				pod_clone_i[key]=item_i[key];
			}
			pod_clone_i.obj=pod_clone_i.obj.__unique_id;
			pod_body[i]=pod_clone_i;
		}
		return s_json=JSON.stringify({body:pod_body,page_w:this.page_w,page_h:this.page_h});
	},
	InsertObject:function(obj,w,h){
		//todo: positioning and sizing: drag for it
		//fragile UI: unintended interaction breaks it
		this.body.push({x:8,y:8,w:w,h:h,obj:obj})
		if(this.pboxdoc){
			var sel={}
			sel["$"+(this.body.length-1).toString()]=1
			this.pboxdoc.group.selection=sel;
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
		this.InsertObject(obj_img,obj_img.w,obj_img.h)
	},
	InsertTextBox:function(){
		var obj=UI.NewTextBox()
		this.InsertObject(obj,obj.w,obj.h)
	},
	AsWidget:function(id,attrs){
		UI.context_parent[id]=this
		UI.Begin(UI.Keep(id,attrs))
		var body=this.body;
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
		for(var i=0;i<body.length;i++){
			var item_i=body[i];
			var obj_i={x:attrs.x+item_i.x,y:attrs.y+item_i.y,w:item_i.w,h:item_i.h, numerical_id:i}
			var obj_real=item_i.obj
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
};

LOADER.RegisterZipLoader("demo_page",function(data_list,id,fname){
	var sdata=data_list[id*2+0];
	var json=JSON.parse(sdata)
	var body=json.body;
	for(var i=0;i<body.length;i++){
		var obj_id=body[i].obj
		if(!(obj_id*2<data_list.length&&obj_id>=0)){
			throw new Error("invalid object id '@1'".replace('@1',obj_id));
		}
		body[i].obj=LOADER.LoadObject(data_list,obj_id)
	}
	var ret=Object.create(DemoPage_prototype)
	//ret.Init();
	ret.body=body;
	ret.page_w=(parseInt(json.page_w)||ret.page_w)
	ret.page_h=(parseInt(json.page_h)||ret.page_h)
	return ret;
})

var DemoDocument_prototype={
	default_extension:"demo_doc",
	enable_compression:1,
	Init:function(){
		this.pages=[];
		this.current_page=0
		this.aspect_ratio=3/2;
	},
	GetReferences:function(){
		return this.pages;
	},
	Save:function(){
		var pages=this.pages;
		var n=pages.length;
		var pod_pages=[];
		for(var i=0;i<n;i++){
			pod_pages[i]=pages[i].__unique_id;
		}
		return s_json=JSON.stringify({pages:pod_pages});
	},
	AsWidget:function(id,attrs){
		UI.context_parent[id]=this
		var obj=UI.StdWidget(id,attrs,"demo_document")
		UI.Begin(obj)
		//PushSubWindow for thumbnail and editing panel
		if(obj.w<obj.h){
			//phone layout
			var h_thumbnail=0.1*obj.h
			//todo
		}else{
			//PC layout
			var w_thumbnail=(3/32)*obj.w
			var thumbnail_margin=w_thumbnail*(3/32);
			var pages=this.pages;
			var n=pages.length;
			var thumbnail_style=obj.thumbnail_style;
			var list_items=[]
			for(var i=0;i<n;i++){
				var page_i=pages[i]
				var w_i=w_thumbnail,scale=w_i/page_i.page_w,h_i=scale*page_i.page_h
				list_items.push({x:thumbnail_margin,w:w_i,h:h_i,numerical_id:i})
			}
			//new page area
			var w_i=w_thumbnail,h_i=w_thumbnail/this.aspect_ratio
			list_items.push({
				object_type:W.Button,
				x:thumbnail_margin,y:0,w:w_i,h:h_i,
				style:obj.new_page_button_style,
				no_click_selection:1,
				text:"+",
				OnClick:function(){
					var new_page=Object.create(DemoPage_prototype)
					new_page.Init()
					obj.pages.push(new_page)
					UI.Refresh()
				}
			})
			var page_list=W.ListView("page_list",{
				x:0,y:0,w:w_thumbnail+thumbnail_margin*3,h:obj.h,
				value:this.current_page,OnChange:function(value){
					obj.current_page=value
					UI.Refresh()
				},
				layout_spacing:thumbnail_margin,layout_align:'right',layout_valign:'up',
				items:list_items,
				item_template:{object_type:function(id,attrs){
					var obj=UI.Keep(id,attrs)
					UI.StdAnchoring(id,obj)
					var page_i=pages[this.numerical_id]
					var w_i=w_thumbnail,scale=w_i/page_i.page_w,h_i=scale*page_i.page_h
					var new_subwin=UI.PushSubWindow(obj.x,obj.y,w_i,h_i,scale)
					if(new_subwin[2]||new_subwin[3]){
						page_i.AsWidget("",{x:0,y:0,w:page_i.page_w,h:page_i.page_h,read_only:1})
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
				}},
			})
			var x_main_ui=w_thumbnail+thumbnail_margin*4
			var w_main_ui=obj.w-x_main_ui-thumbnail_margin*2
			var h_main_ui=obj.h-thumbnail_margin*2
			var cur_page=this.pages[this.current_page]
			if(this.current_page!=this.last_current_page){
				this.last_current_page=this.current_page
				obj.cur_tab=undefined;
			}
			if(cur_page){
				var scale=Math.min(w_main_ui/cur_page.page_w,h_main_ui/cur_page.page_h)
				UI.PushSubWindow(x_main_ui,thumbnail_margin,w_main_ui,h_main_ui,scale)
				cur_page.AsWidget("cur_tab",{x:0,y:0,w:cur_page.page_w,h:cur_page.page_h})
				UI.PopSubWindow()
				UI.RoundRect({x:x_main_ui,y:thumbnail_margin,w:cur_page.page_w*scale,h:cur_page.page_h*scale,
					color:0,border_color:thumbnail_style.border_color,border_width:thumbnail_style.border_width})
			}
		}
		UI.End()
		return obj
	}
};

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

UI.NewDemoTab=function(fname0,pages){
	var file_name=(fname0||IO.GetNewDocumentName("demo","demo","document"));
	var doc=Object.create(DemoDocument_prototype)
	if(pages){doc.pages=pages;}else{doc.Init();}
	return UI.NewTab({
		file_name:file_name,
		doc:doc,
		body:function(){
			var body=this.doc.AsWidget("body",{
				'anchor':'parent','anchor_align':"fill",'anchor_valign':"fill",
				'x':0,'y':0,
				'file_name':this.file_name})
			return body;
		},
		title:UI.GetMainFileName(file_name),
		property_windows:[
			W.subwindow_insert_stuff,
			W.subwindow_text_properties
		],
		color_theme:[0xff2858d6],
	})
}

LOADER.RegisterZipLoader("demo_doc",function(data_list,id,fname){
	var sdata=data_list[id*2+0];
	var pages=JSON.parse(sdata).pages;
	for(var i=0;i<pages.length;i++){
		var obj_id=pages[i]
		if(!(obj_id*2<data_list.length&&obj_id>=0)){
			throw new Error("invalid object id '@1'".replace('@1',obj_id));
		}
		pages[i]=LOADER.LoadObject(data_list,obj_id)
	}
	UI.NewDemoTab(fname,pages);
	return ret;
})


//demo document: multiple pages, widget is the main UI
