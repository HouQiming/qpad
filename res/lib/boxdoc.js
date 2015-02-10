var UI=require("gui2d/ui");
var W=require("gui2d/widgets");

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
		if(this.parent.selection[this.id]){
			this.drag_cancel_selection=1;
		}else{
			this.drag_cancel_selection=0;
			this.parent.selection[this.id]=1;
			UI.Refresh();
		}
		this.is_dragging=1;
		this.drag_x_anchor=this.x;
		this.drag_y_anchor=this.y;
		this.drag_x_base=event.x;
		this.drag_y_base=event.y;
		this.drag_initiated=0;
		if(this.OnDragStart){this.OnDragStart(this);}
		UI.CaptureMouse(this);
	},
	OnMouseMove:function(event){
		if(!this.is_dragging){return;}
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
				UI.Refresh();
			}
		}
	},
};
var ScaleKnob_prototype={
	OnMouseDown:function(event){
		var attrs=this.owner;
		this.dx_base=(event.x-this.x_anchor);
		this.dy_base=(event.y-this.y_anchor);
		this.drag_x_anchor=this.x_anchor;
		this.drag_y_anchor=this.y_anchor;
		this.drag_x0=attrs.x-this.x_anchor;
		this.drag_y0=attrs.y-this.y_anchor;
		this.drag_w=attrs.w;
		this.drag_h=attrs.h;
		this.is_dragging=1;
		UI.CaptureMouse(this);
	},
	OnMouseMove:function(event){
		if(!this.is_dragging){return;}
		var attrs=this.owner;
		var x_scale=(event.x-this.drag_x_anchor)/this.dx_base;
		var y_scale=(event.y-this.drag_y_anchor)/this.dy_base;
		if(x_scale){
			x_scale=Math.max(x_scale,attrs.w_min/this.drag_w);
			attrs.x=this.drag_x_anchor+this.drag_x0*x_scale;
			attrs.w=this.drag_w*x_scale;
		}
		if(y_scale){
			y_scale=Math.max(y_scale,attrs.h_min/this.drag_h);
			attrs.y=this.drag_y_anchor+this.drag_y0*y_scale;
			attrs.h=this.drag_h*y_scale;
		}
		attrs.OnChange(attrs);
		UI.Refresh()
	},
	OnMouseUp:function(event){
		UI.ReleaseMouse(this);
		this.is_dragging=0;
		//todo: check for simple clicks?
	},
};
W.BoxDocumentItem=function(id,attrs0){
	var attrs=UI.Keep(id,attrs0,BoxDocumentItem_prototype);
	UI.StdStyling(id,attrs,attrs0, "box_document_item");
	W.Region(id,attrs);//this does the anchoring
	attrs.parent=UI.context_parent;
	if(attrs.selected){
		//draw the basic box
		if(attrs.border_width){
			UI.RoundRect({x:attrs.x,y:attrs.y,w:attrs.w,h:attrs.h,color:0,border_color:attrs.border_color,border_width:attrs.width+attrs.border_width});
		}
		UI.RoundRect({x:attrs.x,y:attrs.y,w:attrs.w,h:attrs.h,color:0,border_color:attrs.color,border_width:attrs.width});
		//draw the knobs and setup events
		if(!UI.IS_MOBILE){
			UI.Begin(attrs);
				if(attrs.can_rotate){
					//a rotation icon: control for potentially bmp/ttf iconed box
					//draw a connecting line
					var x=attrs.x+attrs.w*0.5;
					var y=attrs.y-attrs.rotation_arm_length;
					UI.DrawBitmap(0,x-attrs.border_width*0.5,y,attrs.border_width,attrs.rotation_arm_length,attrs.border_color);
					//draw the icon
					var knob=Object.create(attrs.knob_rotation);
					knob.x=x-knob.w*0.5;knob.y=y-knob.h;UI.DrawIcon(knob);
				}
				if(attrs.can_scale){
					//the classical 8-knob scaling
					var knob=Object.create(attrs.knob_scale);
					var dx=knob.w*0.5;var dy=knob.h*0.5;
					var x0=attrs.x-dx;
					var y0=attrs.y-dy;
					var x2=x0+attrs.w;
					var y2=y0+attrs.h;
					var x1=(x0+x2)*0.5;
					var y1=(y0+y2)*0.5;
					knob.x=x0;knob.y=y0;UI.RoundRect(knob);W.Region("scale_knob00",{x:knob.x,y:knob.y,w:knob.w,h:knob.h,owner:attrs,x_anchor:x2+dx,y_anchor:y2+dy},ScaleKnob_prototype);
					knob.x=x1;knob.y=y0;UI.RoundRect(knob);W.Region("scale_knob10",{x:knob.x,y:knob.y,w:knob.w,h:knob.h,owner:attrs,y_anchor:y2+dy},ScaleKnob_prototype);
					knob.x=x2;knob.y=y0;UI.RoundRect(knob);W.Region("scale_knob20",{x:knob.x,y:knob.y,w:knob.w,h:knob.h,owner:attrs,x_anchor:x0+dx,y_anchor:y2+dy},ScaleKnob_prototype);
					knob.x=x0;knob.y=y1;UI.RoundRect(knob);W.Region("scale_knob01",{x:knob.x,y:knob.y,w:knob.w,h:knob.h,owner:attrs,x_anchor:x2+dx},ScaleKnob_prototype);
					knob.x=x2;knob.y=y1;UI.RoundRect(knob);W.Region("scale_knob21",{x:knob.x,y:knob.y,w:knob.w,h:knob.h,owner:attrs,x_anchor:x0+dx},ScaleKnob_prototype);
					knob.x=x0;knob.y=y2;UI.RoundRect(knob);W.Region("scale_knob02",{x:knob.x,y:knob.y,w:knob.w,h:knob.h,owner:attrs,x_anchor:x2+dx,y_anchor:y0+dy},ScaleKnob_prototype);
					knob.x=x1;knob.y=y2;UI.RoundRect(knob);W.Region("scale_knob12",{x:knob.x,y:knob.y,w:knob.w,h:knob.h,owner:attrs,y_anchor:y0+dy},ScaleKnob_prototype);
					knob.x=x2;knob.y=y2;UI.RoundRect(knob);W.Region("scale_knob22",{x:knob.x,y:knob.y,w:knob.w,h:knob.h,owner:attrs,x_anchor:x0+dx,y_anchor:y0+dy},ScaleKnob_prototype);
				}
			UI.End(attrs);
		}
	}
	return attrs;
}

//todo: cursor system - SDL_CreateSystemCursor, SDL_SetCursor
