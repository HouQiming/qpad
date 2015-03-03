var UI=require("gui2d/ui");
var W=require("gui2d/widgets");

var DrawSnappingLine=function(parent,x,dim){
	var rect;
	if(dim=="x"){
		rect={'x':x+parent.x,'y':parent.y,'w':1/UI.pixels_per_unit,'h':parent.h}
	}else{
		rect={'x':parent.x,'y':x+parent.y,'w':parent.w,'h':1/UI.pixels_per_unit}
	}
	rect.border_width=0;
	rect.color=parent.color;
	//print(JSON.stringify(rect))
	parent["snapping_rect_"+dim]=rect;
}
var TestSnappingOneDim=function(parent,event,dim, dx,w){
	var coords=parent.snapping_coords;
	var coords_x=coords[dim];
	var x=event[dim];
	var tolerance=(coords.tolerance||8);
	parent["snapping_rect_"+dim]=null;
	for(var i=0;i<coords_x.length;i++){
		if(Math.abs(x+dx-coords_x[i])<tolerance){
			event[dim]=(coords_x[i]-dx);
			DrawSnappingLine(parent,coords_x[i],dim)
			return;
		}
		if(Math.abs(x+dx+w-coords_x[i])<tolerance){
			event[dim]=(coords_x[i]-dx-w);
			DrawSnappingLine(parent,coords_x[i],dim)
			return;
		}
	}
};
var TestSnappingCoords=function(obj,event, dx,dy,w,h){
	var parent=obj.parent;
	var coords=parent.snapping_coords;
	if(!coords){return;}
	if(UI.IsPressed("LSHIFT")||UI.IsPressed("RSHIFT")){return;}
	TestSnappingOneDim(parent,event,"x",dx,w)
	TestSnappingOneDim(parent,event,"y",dy,h)
};

//interface change: AnchorTransform, SetTransform
var BoxDocumentItem_prototype={
	color:0,
	color:0xff000000,
	border_color:0xff000000,
	width:2,
	border_width:0,
	min_dragging_initiation:8,
	///////
	can_rotate:0,
	rotation_arm_length:16,
	can_scale:1,
	locked_aspect_ratio:0,
	w_min:1,
	h_min:1,
	knob_scale:{
		w:8,
		h:8,
		color:0xffffffff,
		border_color:0xff000000,
		border_width:2,
	},
	OnMouseDown:function(event){
		//toggle selection
		var doc=this.parent;
		if(!doc.group.selection){
			doc.group.selection={};
		}
		if(!(UI.IsPressed("LSHIFT")||UI.IsPressed("RSHIFT"))){
			if(!doc.group.selection[this.id]){
				doc.group.selection={};
				doc.group.selection[this.id]=1;
			}
		}else{
			doc.group.selection[this.id]=1;
		}
		doc.OnSelectionChange()
		this.drag_x_anchor=this.x;
		this.drag_y_anchor=this.y;
		this.drag_x_base=event.x;
		this.drag_y_base=event.y;
		doc.drag_initiated=0;
		doc.AnchorTransform();
		//if(this.OnDragStart){this.OnDragStart(this);}
		UI.Refresh();
		UI.CaptureMouse(this);
	},
	OnMouseMove:function(event){
		var doc=this.parent;
		if(!doc.is_dragging){return;}
		TestSnappingCoords(this,event, this.drag_x_anchor-this.drag_x_base-doc.x,this.drag_y_anchor-this.drag_y_base-doc.y, this.w,this.h);
		var dx=event.x-this.drag_x_base;
		var dy=event.y-this.drag_y_base;
		if(!doc.drag_initiated&&(Math.abs(dx)>this.min_dragging_initiation||Math.abs(dy)>this.min_dragging_initiation)){
			doc.drag_initiated=1;
		}
		if(!doc.drag_initiated){return;}
		doc.SetTransform({"translation":[dx,dy]});
		//this.x=this.drag_x_anchor+dx;
		//this.y=this.drag_y_anchor+dy;
		//this.OnChange(this);
		UI.Refresh()
	},
	OnMouseUp:function(event){
		UI.ReleaseMouse(this);
		var doc=this.parent;
		if(doc.is_dragging){
			doc.FinalizeTransform()
		}
	},
};
var ScaleKnob_prototype={
	OnMouseDown:function(event){
		var obj=this.owner;
		var doc=obj.parent;
		this.dx_base=(event.x-this.x_anchor);
		this.dy_base=(event.y-this.y_anchor);
		this.drag_x_anchor=this.x_anchor;
		this.drag_y_anchor=this.y_anchor;
		this.drag_x0=obj.x-this.x_anchor;
		this.drag_y0=obj.y-this.y_anchor;
		this.drag_w=obj.w;
		this.drag_h=obj.h;
		doc.AnchorTransform()
		UI.CaptureMouse(this);
	},
	OnMouseMove:function(event){
		var obj=this.owner;
		var doc=obj.parent;
		if(!doc.is_dragging){return;}
		//TestSnappingCoords(obj,event, this.w*0.5,this.h*0.5,0,0);
		var x_scale=(event.x-this.drag_x_anchor)/this.dx_base;
		var y_scale=(event.y-this.drag_y_anchor)/this.dy_base;
		if(this.lock_aspect_ratio){x_scale=Math.min(x_scale,y_scale);y_scale=x_scale;}
		if(x_scale){
			x_scale=Math.max(x_scale,obj.w_min/this.drag_w);
			//obj.x=this.drag_x_anchor+this.drag_x0*x_scale;
			//obj.w=this.drag_w*x_scale;
		}else{
			x_scale=1.0;
		}
		if(y_scale){
			y_scale=Math.max(y_scale,obj.h_min/this.drag_h);
			//obj.y=this.drag_y_anchor+this.drag_y0*y_scale;
			//obj.h=this.drag_h*y_scale;
		}else{
			y_scale=1.0;
		}
		doc.SetTransform({"scale":[x_scale,y_scale],"relative_anchor":[this.x_anchor_rel,this.y_anchor_rel]});
		//obj.OnChange(obj);
		UI.Refresh()
	},
	OnMouseUp:function(event){
		var obj=this.owner;
		var doc=obj.parent;
		UI.ReleaseMouse(this);
		doc.FinalizeTransform()
		UI.Refresh();
	},
};
W.BoxDocumentItem=function(id,attrs0){
	var obj=UI.Keep(id,attrs0,BoxDocumentItem_prototype);
	UI.StdStyling(id,obj,attrs0, "box_document_item");
	obj.mouse_cursor=(obj.selected?"sizeall":undefined)
	W.Region(id,obj);//this does the anchoring
	obj.parent=UI.context_parent.parent;
	if(obj.selected){
		//draw the basic box
		if(obj.border_width){
			UI.RoundRect({x:obj.x,y:obj.y,w:obj.w,h:obj.h,color:0,border_color:obj.border_color,border_width:obj.width+obj.border_width});
		}
		UI.RoundRect({x:obj.x,y:obj.y,w:obj.w,h:obj.h,color:0,border_color:obj.color,border_width:obj.width});
		//draw the knobs and setup events
		if(!UI.IS_MOBILE){
			UI.Begin(obj);
				if(obj.can_rotate){
					//a rotation icon: control for potentially bmp/ttf iconed box
					//draw a connecting line
					var x=obj.x+obj.w*0.5;
					var y=obj.y-obj.rotation_arm_length;
					UI.DrawBitmap(0,x-obj.border_width*0.5,y,obj.border_width,obj.rotation_arm_length,obj.border_color);
					//draw the icon
					var knob=Object.create(obj.knob_rotation);
					knob.x=x-knob.w*0.5;knob.y=y-knob.h;UI.DrawIcon(knob);
				}
				if(obj.can_scale){
					//the classical 8-knob scaling
					var knob=Object.create(obj.knob_scale);
					var dx=knob.w*0.5;var dy=knob.h*0.5;
					var x0=obj.x-dx;
					var y0=obj.y-dy;
					var x2=x0+obj.w;
					var y2=y0+obj.h;
					var x1=(x0+x2)*0.5;
					var y1=(y0+y2)*0.5;
					knob.x=x0;knob.y=y0;UI.RoundRect(knob);W.Region("scale_knob00",{x_anchor_rel:2*0.5,y_anchor_rel:2*0.5,x:knob.x,y:knob.y,w:knob.w,h:knob.h,owner:obj,x_anchor:x2+dx,y_anchor:y2+dy,mouse_cursor:"sizenwse"},ScaleKnob_prototype);
					knob.x=x1;knob.y=y0;UI.RoundRect(knob);W.Region("scale_knob10",{x_anchor_rel:1*0.5,y_anchor_rel:2*0.5,x:knob.x,y:knob.y,w:knob.w,h:knob.h,owner:obj,y_anchor:y2+dy,mouse_cursor:"sizens"},ScaleKnob_prototype);
					knob.x=x2;knob.y=y0;UI.RoundRect(knob);W.Region("scale_knob20",{x_anchor_rel:0*0.5,y_anchor_rel:2*0.5,x:knob.x,y:knob.y,w:knob.w,h:knob.h,owner:obj,x_anchor:x0+dx,y_anchor:y2+dy,mouse_cursor:"sizenesw"},ScaleKnob_prototype);
					knob.x=x0;knob.y=y1;UI.RoundRect(knob);W.Region("scale_knob01",{x_anchor_rel:2*0.5,y_anchor_rel:1*0.5,x:knob.x,y:knob.y,w:knob.w,h:knob.h,owner:obj,x_anchor:x2+dx,mouse_cursor:"sizewe"},ScaleKnob_prototype);
					knob.x=x2;knob.y=y1;UI.RoundRect(knob);W.Region("scale_knob21",{x_anchor_rel:0*0.5,y_anchor_rel:1*0.5,x:knob.x,y:knob.y,w:knob.w,h:knob.h,owner:obj,x_anchor:x0+dx,mouse_cursor:"sizewe"},ScaleKnob_prototype);
					knob.x=x0;knob.y=y2;UI.RoundRect(knob);W.Region("scale_knob02",{x_anchor_rel:2*0.5,y_anchor_rel:0*0.5,x:knob.x,y:knob.y,w:knob.w,h:knob.h,owner:obj,x_anchor:x2+dx,y_anchor:y0+dy,mouse_cursor:"sizenesw"},ScaleKnob_prototype);
					knob.x=x1;knob.y=y2;UI.RoundRect(knob);W.Region("scale_knob12",{x_anchor_rel:1*0.5,y_anchor_rel:0*0.5,x:knob.x,y:knob.y,w:knob.w,h:knob.h,owner:obj,y_anchor:y0+dy,mouse_cursor:"sizens"},ScaleKnob_prototype);
					knob.x=x2;knob.y=y2;UI.RoundRect(knob);W.Region("scale_knob22",{x_anchor_rel:0*0.5,y_anchor_rel:0*0.5,x:knob.x,y:knob.y,w:knob.w,h:knob.h,owner:obj,x_anchor:x0+dx,y_anchor:y0+dy,mouse_cursor:"sizenwse"},ScaleKnob_prototype);
				}
			UI.End(obj);
		}
	}
	return obj;
}

W.BoxDocument_prototype={
	mouse_cursor:"arrow",
	OnMouseDown:function(event){
		this.is_selecting=1
		this.sel_anchor_x=event.x
		this.sel_anchor_y=event.y
		UI.CaptureMouse(this);
	},
	OnMouseMove:function(event){
		if(!this.is_selecting){return 0;}
		var x0=this.sel_anchor_x,x1=event.x;
		var y0=this.sel_anchor_y,y1=event.y;
		if(x0>x1){var tmp=x0;x0=x1;x1=tmp;}
		if(y0>y1){var tmp=y0;y0=y1;y1=tmp;}
		this.sel_rect={x:x0,y:y0,w:x1-x0,h:y1-y0,
			color:this.color,border_color:this.border_color,border_width:this.border_width};
		var sel={};
		for(var i=0;i<this.items.length;i++){
			var obj_id=this.group[this.items[i].id];
			if(obj_id){
				var ox0=obj_id.x, ox1=ox0+obj_id.w;
				var oy0=obj_id.y, oy1=oy0+obj_id.h;
				if(ox1<x1&&x0<ox0&&oy1<y1&&y0<oy0){
					sel[obj_id.id]=1;
				}
			}
		}
		this.group.selection=sel;
		this.OnSelectionChange()
		UI.Refresh()
	},
	OnMouseUp:function(event){
		UI.ReleaseMouse(this);
		this.is_selecting=0
		this.sel_rect=null;
		UI.Refresh()
	},
	AnchorTransform:function(){
		this.is_dragging=1;
		var group=this.group;
		var sel=group.selection;
		for(var id in sel){
			if(sel[id]){
				var obj_id=group[id];
				if(obj_id.AnchorTransform){obj_id.AnchorTransform.call(obj_id);}
			}
		}
	},
	SetTransform:function(tr){
		var group=this.group;
		var sel=group.selection;
		if(this.BeginTransform){this.BeginTransform.call(this);}
		for(var id in sel){
			if(sel[id]){
				var obj_id=group[id];
				//if(tr.relative_anchor){
				//	tr.anchor=[obj_id.x+tr.relative_anchor[0]*obj_id.w,obj_id.y+tr.relative_anchor[1]*obj_id.h];
				//}
				obj_id.SetTransform.call(obj_id,tr);
			}
		}
		if(this.EndTransform){this.EndTransform.call(this);}
	},
	FinalizeTransform:function(){
		var group=this.group;
		var sel=group.selection;
		for(var id in sel){
			if(sel[id]){
				var obj_id=group[id];
				if(obj_id.FinalizeTransform){obj_id.FinalizeTransform.call(obj_id);}
			}
		}
		this.is_dragging=0;
		this.snapping_rect_x=null;
		this.snapping_rect_y=null;
		UI.Refresh();
	},
	OnSelectionChange:function(){},
};
W.BoxDocument=function(id,attrs){
	var obj=UI.Keep(id,attrs,W.BoxDocument_prototype);
	UI.StdStyling(id,obj,attrs,"box_document");
	UI.StdAnchoring(id,obj);
	if(!obj.disable_region){W.PureRegion(id,obj)}
	UI.Begin(obj)
		W.Group("group",{
			layout_direction:'inside',layout_align:'left',layout_valign:'up',
			'x':obj.x,'y':obj.y,'w':obj.w,'h':obj.h,
			'snapping_coords':obj.snapping_coords,
			'color':obj.border_color,
			'item_template':{object_type:W.BoxDocumentItem},'items':obj.items,
			'parent':obj})
		//draw the snapping rects
		if(obj.is_dragging&&!(UI.IsPressed("LSHIFT")||UI.IsPressed("RSHIFT"))){
			if(obj.snapping_rect_x){UI.RoundRect(obj.snapping_rect_x);}
			if(obj.snapping_rect_y){UI.RoundRect(obj.snapping_rect_y);}
		}
		//draw the sel box
		if(obj.is_selecting){
			UI.RoundRect(obj.sel_rect);
		}
	UI.End(obj)
}

//todo: cursor system - UI.SDL_SetSystemCursor(UI.SDL_SYSTEM_CURSOR_IBEAM)
