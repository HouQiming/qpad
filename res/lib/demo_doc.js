var UI=require("gui2d/ui");
var W=require("gui2d/widgets");
require("res/lib/boxdoc");

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
	page_w:1440,page_h:1080,
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
	AsWidget:function(id,attrs){
		var body=this.body;
		var n=body.length;
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
			real_obj.x=this.my_anchor_x;
			real_obj.y=this.my_anchor_y;
			if(tr.scale){
				real_obj.x+=tr.relative_anchor[0]*this.my_anchor_w;
				real_obj.y+=tr.relative_anchor[1]*this.my_anchor_h;
				real_obj.w-=tr.relative_anchor[0]*real_obj.w;
				real_obj.h-=tr.relative_anchor[1]*real_obj.h;
			}
			UI.Refresh()
		})
		var items=[]
		for(var i=0;i<body.length;i++){
			var item_i=body[i];
			var obj_i={x:attrs.x+item_i.x,y:attrs.y+item_i.y,w:item_i.w,h:item_i.h, numerical_id:i}
			var obj_real=item_i.obj
			var id_i="$"+i
			obj_i.read_only=(attrs.read_only||0)
			//save the widget regions
			//todo: arbitrary transformation
			var uirgs=UI.context_regions
			var lg0=uirgs.length
			var widget_regions=[]
			obj_real.AsWidget(id_i,obj_i)
			while(uirgs.length>lg0){
				widget_regions.push(uirgs.pop())
			}
			obj_i.widget_regions=widget_regions
			obj_i.id=id_i;
			obj_i.AnchorTransform=fanchortransform;
			obj_i.SetTransform=fonchange;
			items.push(obj_i)
		}
		if(!attrs.read_only){
			var obj_prev=UI.GetPreviousState(id)
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
			W.BoxDocument(id,{
				'x':0,'y':0,'w':attrs.x+attrs.w,'h':attrs.y+attrs.h,
				'items':items,
				'snapping_coords':snapping_coords,
				'disable_region':1,
			})
		}
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

//todo: bgcolor
var thumbnail_prototype={
	//todo: page selection... it's like tab labels
	/*
		click -> make current
			this has multi-sel and copy/paste
		dragging
	*/
};
var DemoDocument_prototype={
	default_extension:"demo_doc",
	enable_compression:1,
	Init:function(){
		this.pages=[];
		this.current_page=0
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
		//todo: current page, page list (id and thumbnail)
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
			var x=obj.x+thumbnail_margin;
			var y=thumbnail_margin;
			var thumbnail_style=obj.thumbnail_style;
			//todo: scrolling
			for(var i=0;i<n;i++){
				var page_i=pages[i]
				var w_i=w_thumbnail,scale=w_i/page_i.page_w,h_i=scale*page_i.page_h
				//todo: additional clipping inside... should be fine if we also clip m_window_foo
				UI.PushSubWindow(x,y,w_i,h_i,scale)
				page_i.AsWidget("",{x:0,y:0,w:page_i.page_w,h:page_i.page_h,read_only:1})
				UI.PopSubWindow()
				y+=h_i+thumbnail_margin;
				W.Region("$thumbnail_"+i,{x:x, y:y, w:w_i, h:h_i},thumbnail_prototype)
				UI.RoundRect({x:x,y:y,w:w_i,h:h_i,
					color:0,border_color:thumbnail_style.border_color,border_width:thumbnail_style.border_width})
				var s_i=(i+1).toString();
				W.Text("",{
					text:s_i,
					font:thumbnail_style.font,color:thumbnail_style.text_color,
					x:x-UI.MeasureIconText({font:thumbnail_style.font,text:s_i})-thumbnail_style.text_padding,y:y})
			}
			var x_main_ui=w_thumbnail+thumbnail_margin*3
			var w_main_ui=obj.w-x_main_page-thumbnail_margin
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
		UI.End(obj)
		return obj
	}
};

W.subwindow_insert_stuff={
	'title':'Insert',h:300,
};
W.subwindow_insert_stuff.body=function(id,attrs){
	/*editor: UI.BeginVirtualWindow(id,{w:480,h:720,bgcolor:0xffffffff})//*/
	//image, text box, symbol
	//put VG creation in the image program?
	//
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
			this.doc.AsWidget("body",{
				'anchor':'parent','anchor_align':"center",'anchor_valign':"fill",
				'x':0,'y':0,
				'file_name':this.file_name})
			return body;
		},
		title:UI.GetMainFileName(file_name),
		property_windows:[
			//todo
			W.subwindow_text_properties
		],
		color_theme:[0xffcc7733],
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
//todo: insertion toolbar
