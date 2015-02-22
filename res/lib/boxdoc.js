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
	rect.color=parent.snapping_coords.color;
	//print(JSON.stringify(rect))
	parent.snapping_coords["rect_"+dim]=rect;
}
var TestSnappingOneDim=function(parent,event,dim, dx,w){
	var coords=parent.snapping_coords;
	var coords_x=coords[dim];
	var x=event[dim];
	var tolerance=(coords.tolerance||8);
	parent.snapping_coords["rect_"+dim]=null;
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
		w:12,
		h:12,
		color:0xffffffff,
		border_color:0xff000000,
		border_width:2,
	},
	OnMouseDown:function(event){
		//toggle selection
		if(!this.parent.selection){
			this.parent.selection={};
		}
		if(!(UI.IsPressed("LCTRL")||UI.IsPressed("RCTRL"))){
			this.drag_cancel_selection=0;
			this.parent.selection={};
			this.parent.selection[this.id]=1;
		}else{
			if(this.parent.selection[this.id]){
				this.drag_cancel_selection=1;
			}else{
				this.drag_cancel_selection=0;
				this.parent.selection[this.id]=1;
			}
		}
		this.is_dragging=1;
		this.drag_x_anchor=this.x;
		this.drag_y_anchor=this.y;
		this.drag_x_base=event.x;
		this.drag_y_base=event.y;
		this.drag_initiated=0;
		if(this.OnDragStart){this.OnDragStart(this);}
		UI.Refresh();
		UI.CaptureMouse(this);
	},
	OnMouseMove:function(event){
		if(!this.is_dragging){return;}
		TestSnappingCoords(this,event, this.drag_x_anchor-this.drag_x_base,this.drag_y_anchor-this.drag_y_base, this.w,this.h);
		var dx=event.x-this.drag_x_base;
		var dy=event.y-this.drag_y_base;
		if(!this.drag_initiated&&(Math.abs(dx)>this.min_dragging_initiation||Math.abs(dy)>this.min_dragging_initiation)){
			this.drag_initiated=1;
			this.drag_cancel_selection=0;
		}
		if(!this.drag_initiated){return;}
		this.x=this.drag_x_anchor+dx;
		this.y=this.drag_y_anchor+dy;
		this.OnChange(this);
		UI.Refresh()
	},
	OnMouseUp:function(event){
		UI.ReleaseMouse(this);
		if(this.is_dragging){
			if(this.OnDragFinish){this.OnDragFinish(this);}
			this.is_dragging=0;
			if(this.drag_cancel_selection){
				this.parent.selection[this.id]=0;
			}
			this.parent.snapping_coords=null;
			UI.Refresh();
		}
	},
};
var ScaleKnob_prototype={
	OnMouseDown:function(event){
		var obj=this.owner;
		this.dx_base=(event.x-this.x_anchor);
		this.dy_base=(event.y-this.y_anchor);
		this.drag_x_anchor=this.x_anchor;
		this.drag_y_anchor=this.y_anchor;
		this.drag_x0=obj.x-this.x_anchor;
		this.drag_y0=obj.y-this.y_anchor;
		this.drag_w=obj.w;
		this.drag_h=obj.h;
		this.is_dragging=1;
		obj.is_dragging=1;
		if(obj.OnScaleStart){obj.OnScaleStart(obj);}
		UI.CaptureMouse(this);
	},
	OnMouseMove:function(event){
		if(!this.is_dragging){return;}
		var obj=this.owner;
		TestSnappingCoords(obj,event, this.w*0.5,this.h*0.5,0,0);
		var x_scale=(event.x-this.drag_x_anchor)/this.dx_base;
		var y_scale=(event.y-this.drag_y_anchor)/this.dy_base;
		if(this.lock_aspect_ratio){x_scale=Math.min(x_scale,y_scale);y_scale=x_scale;}
		if(x_scale){
			x_scale=Math.max(x_scale,obj.w_min/this.drag_w);
			obj.x=this.drag_x_anchor+this.drag_x0*x_scale;
			obj.w=this.drag_w*x_scale;
		}
		if(y_scale){
			y_scale=Math.max(y_scale,obj.h_min/this.drag_h);
			obj.y=this.drag_y_anchor+this.drag_y0*y_scale;
			obj.h=this.drag_h*y_scale;
		}
		obj.OnChange(obj);
		UI.Refresh()
	},
	OnMouseUp:function(event){
		var obj=this.owner;
		UI.ReleaseMouse(this);
		obj.is_dragging=0;
		obj.parent.snapping_coords=null;
		this.is_dragging=0;
		UI.Refresh();
		if(obj.OnScaleFinish){obj.OnScaleFinish(obj);}
	},
};
W.BoxDocumentItem=function(id,attrs0){
	var obj=UI.Keep(id,attrs0,BoxDocumentItem_prototype);
	UI.StdStyling(id,obj,attrs0, "box_document_item");
	W.Region(id,obj);//this does the anchoring
	obj.parent=UI.context_parent;
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
					knob.x=x0;knob.y=y0;UI.RoundRect(knob);W.Region("scale_knob00",{x:knob.x,y:knob.y,w:knob.w,h:knob.h,owner:obj,x_anchor:x2+dx,y_anchor:y2+dy},ScaleKnob_prototype);
					knob.x=x1;knob.y=y0;UI.RoundRect(knob);W.Region("scale_knob10",{x:knob.x,y:knob.y,w:knob.w,h:knob.h,owner:obj,y_anchor:y2+dy},ScaleKnob_prototype);
					knob.x=x2;knob.y=y0;UI.RoundRect(knob);W.Region("scale_knob20",{x:knob.x,y:knob.y,w:knob.w,h:knob.h,owner:obj,x_anchor:x0+dx,y_anchor:y2+dy},ScaleKnob_prototype);
					knob.x=x0;knob.y=y1;UI.RoundRect(knob);W.Region("scale_knob01",{x:knob.x,y:knob.y,w:knob.w,h:knob.h,owner:obj,x_anchor:x2+dx},ScaleKnob_prototype);
					knob.x=x2;knob.y=y1;UI.RoundRect(knob);W.Region("scale_knob21",{x:knob.x,y:knob.y,w:knob.w,h:knob.h,owner:obj,x_anchor:x0+dx},ScaleKnob_prototype);
					knob.x=x0;knob.y=y2;UI.RoundRect(knob);W.Region("scale_knob02",{x:knob.x,y:knob.y,w:knob.w,h:knob.h,owner:obj,x_anchor:x2+dx,y_anchor:y0+dy},ScaleKnob_prototype);
					knob.x=x1;knob.y=y2;UI.RoundRect(knob);W.Region("scale_knob12",{x:knob.x,y:knob.y,w:knob.w,h:knob.h,owner:obj,y_anchor:y0+dy},ScaleKnob_prototype);
					knob.x=x2;knob.y=y2;UI.RoundRect(knob);W.Region("scale_knob22",{x:knob.x,y:knob.y,w:knob.w,h:knob.h,owner:obj,x_anchor:x0+dx,y_anchor:y0+dy},ScaleKnob_prototype);
				}
			UI.End(obj);
		}
	}
	return obj;
}

W.BoxDocument=function(id,attrs){
	!? //todo: drag sel
}

//todo: cursor system - SDL_CreateSystemCursor, SDL_SetCursor
